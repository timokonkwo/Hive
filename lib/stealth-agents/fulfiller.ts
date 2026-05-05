/**
 * Stealth Agent Fulfiller
 * 
 * When a stealth agent's bid is accepted, this module generates
 * actual deliverables using Gemini and submits them through the
 * standard work submission pipeline.
 */

import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { validateSubmission } from '@/lib/submission-validator';
import type { DeliverableSubmission } from '@/lib/submission-validator';
import { STEALTH_AGENTS, type StealthAgentConfig } from './config';
import { generateWithGemini } from './gemini';

/**
 * Check for accepted bids belonging to stealth agents and fulfill them.
 * Called periodically by the runner.
 */
export async function fulfillAcceptedBids(limit: number = 1): Promise<void> {
  const db = await getDb();

  // Find all platform agent IDs
  const stealthAgents = await db
    .collection(COLLECTIONS.AGENTS)
    .find({ isHiveOwned: true })
    .toArray();

  const stealthAgentMap = new Map(
    stealthAgents.map((a) => [a._id.toString(), a])
  );
  const stealthAgentIds = [...stealthAgentMap.keys()];

  if (stealthAgentIds.length === 0) return;

  // Find accepted bids from stealth agents that don't have a submission yet
  // Skip bids that have permanently failed fulfillment
  const acceptedBids = await db
    .collection(COLLECTIONS.BIDS)
    .find({
      agentId: { $in: stealthAgentIds },
      status: 'accepted',
    })
    .toArray();

  let fulfilled = 0;

  for (const bid of acceptedBids) {
    if (fulfilled >= limit) break;

    // Check if work has already been submitted for this bid
    const existingSubmission = await db
      .collection(COLLECTIONS.SUBMISSIONS)
      .findOne({ taskId: bid.taskId, agentId: bid.agentId });

    if (existingSubmission) continue; // Already submitted

    // Get the task details
    let task;
    try {
      task = await db
        .collection(COLLECTIONS.TASKS)
        .findOne({ _id: new ObjectId(bid.taskId) });
    } catch {
      continue;
    }

    if (!task || task.status === 'Completed') continue;

    // Find the agent config
    const agentConfig = STEALTH_AGENTS.find(
      (a) => a.name === bid.agentName
    );
    if (!agentConfig) continue;

    console.log(`[FULFILL] ${agentConfig.name} fulfilling "${task.title}" (${bid.taskId})`);

    try {
      await fulfillTask(bid, task, agentConfig);
      fulfilled++;
    } catch (error: any) {
      console.error(
        `[FULFILL] Error (${agentConfig.name}, ${bid.taskId}):`,
        error.message
      );
    }
  }
}

/**
 * Generate deliverables and submit work for a single task.
 */
async function fulfillTask(
  bid: any,
  task: any,
  agent: StealthAgentConfig
): Promise<void> {
  const db = await getDb();
  const specs = task.deliverableSpecs || [];

  // Generate work using Gemini
  const { summary, deliverables } = await generateWork(task, agent, specs);

  // Validate the submission against specs
  const validation = validateSubmission(specs, deliverables, summary);
  if (!validation.valid) {
    console.error(
      `[STEALTH] Validation failed for ${agent.name}:`,
      validation.errors
    );
    // Try once more with explicit spec instructions
    const retryResult = await generateWork(task, agent, specs, validation.errors);
    const retryValidation = validateSubmission(specs, retryResult.deliverables, retryResult.summary);
    if (!retryValidation.valid) {
      console.error(`[STEALTH] Retry also failed. Marking bid ${bid._id} as failed.`);

      // Track the failure so we don't retry this bid forever
      const currentAttempts = (bid.fulfillmentAttempts || 0) + 1;
      await db.collection(COLLECTIONS.BIDS).updateOne(
        { _id: bid._id },
        {
          $set: {
            fulfillmentAttempts: currentAttempts,
            lastFulfillmentError: retryValidation.errors.join('; '),
            updatedAt: new Date(),
            ...(currentAttempts >= 2 ? { status: 'FulfillmentFailed' } : {}),
          },
        }
      );

      if (currentAttempts >= 2) {
        console.warn(`[STEALTH] Bid ${bid._id} permanently failed after ${currentAttempts} attempts. Resetting task to Open.`);
        // Reset task to Open so a new bid cycle can happen
        await db.collection(COLLECTIONS.TASKS).updateOne(
          { _id: new ObjectId(bid.taskId) },
          { $set: { status: 'Open', updatedAt: new Date() } }
        );
      }

      return;
    }
    // Use retry result
    Object.assign(deliverables, retryResult.deliverables);
  }

  // Normalize deliverables
  const normalizedDeliverables: DeliverableSubmission[] = deliverables.map(
    (d: any) => ({
      specIndex: d.specIndex ?? 0,
      type: d.type,
      label: d.label || specs[d.specIndex]?.label || 'Deliverable',
      content: d.content,
      metadata: d.metadata || null,
    })
  );

  // Insert submission
  const submission = {
    taskId: bid.taskId,
    agentId: bid.agentId,
    agentName: agent.name,
    bidId: bid._id.toString(),
    summary: summary.trim(),
    deliverables: normalizedDeliverables,
    reportUri: null,
    status: 'Submitted',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection(COLLECTIONS.SUBMISSIONS).insertOne(submission);

  // Update task status
  await db.collection(COLLECTIONS.TASKS).updateOne(
    { _id: new ObjectId(bid.taskId) },
    { $set: { status: 'In Review', updatedAt: new Date() } }
  );

  // Update bid status
  await db.collection(COLLECTIONS.BIDS).updateOne(
    { _id: bid._id },
    { $set: { status: 'WorkSubmitted', updatedAt: new Date() } }
  );

  // Log activity
  await db.collection(COLLECTIONS.ACTIVITY).insertOne({
    type: 'WorkSubmitted',
    taskId: bid.taskId,
    agentId: bid.agentId,
    actorName: agent.name,
    metadata: {
      taskTitle: task.title,
      summary: summary.substring(0, 200),
      deliverableCount: normalizedDeliverables.length,
      deliverableTypes: normalizedDeliverables.map((d) => d.type),
    },
    createdAt: new Date(),
  });

  console.log(
    `[STEALTH] ${agent.name} submitted work for "${task.title}" — ${normalizedDeliverables.length} deliverable(s)`
  );
}

/**
 * Generate work deliverables using Gemini.
 */
async function generateWork(
  task: any,
  agent: StealthAgentConfig,
  specs: any[],
  previousErrors?: string[]
): Promise<{ summary: string; deliverables: any[] }> {
  // If no specs provided, infer them from the task category
  const effectiveSpecs = specs.length > 0 ? specs : inferSpecsFromCategory(task.category);

  const specDescriptions = effectiveSpecs
    .map(
      (s: any, i: number) =>
        `Deliverable ${i}: type="${s.type}", label="${s.label}", required=${s.required}, description="${s.description || ''}"`
    )
    .join('\n');

  const errorContext = previousErrors
    ? `\n\nPREVIOUS ATTEMPT FAILED WITH ERRORS:\n${previousErrors.join('\n')}\nFix these issues in your response.`
    : '';

  // Category-specific quality instructions
  const categoryInstructions = getCategoryInstructions(task.category);

  const prompt = `You are an autonomous AI agent completing a real freelance task. Produce professional, production-quality deliverables.

TASK:
Title: ${task.title}
Category: ${task.category}
Description: ${task.description}
Requirements: ${task.requirements || 'None specified'}
Budget: ${task.budget || 'Negotiable'}

DELIVERABLE SPECIFICATIONS:
${specDescriptions}
${errorContext}

CATEGORY-SPECIFIC INSTRUCTIONS:
${categoryInstructions}

TYPE-SPECIFIC FORMATTING RULES (follow strictly):
- For type "code": Write ACTUAL, COMPLETE, RUNNABLE source code. Include the programming language as a comment on line 1 (e.g. "// language: python" or "# language: bash"). Add inline comments explaining logic. Include error handling. The code must be production-quality, not pseudocode or snippets.
- For type "text": Use rich markdown formatting. Use ## headings to organize sections, **bold** for key terms, bullet lists for items, numbered steps for procedures, and markdown tables (| col1 | col2 |) where data comparison is involved. Include concrete data, specific numbers, and actionable recommendations. Never deliver a wall of unformatted plain text.
- For type "url": Provide a single valid URL.

RESPOND IN EXACTLY THIS JSON FORMAT (no markdown wrapping, no code fences, just raw JSON):
{
  "summary": "A 2-3 sentence summary of the completed work (min 20 characters)",
  "deliverables": [
    {
      "specIndex": 0,
      "type": "code",
      "label": "Source Code",
      "content": "# language: python\\nimport requests\\n\\ndef fetch_data():\\n    ..."
    },
    {
      "specIndex": 1,
      "type": "text",
      "label": "Documentation",
      "content": "## Setup Guide\\n\\n**Prerequisites:**\\n- Python 3.9+\\n..."
    }
  ]
}

CRITICAL RULES:
- For EACH deliverable spec, include a matching deliverable with the correct specIndex and type.
- The "type" field MUST match the spec's type exactly. Do not change "code" to "text" or vice versa.
- The summary must be at least 20 characters long.
- Content must be substantial, thorough, and demonstrate real professional work.
- Code deliverables must contain actual runnable code, not descriptions of code.
- Text deliverables must use markdown formatting with headers, tables, and structure.`;

  // Use 'fast' model (gemini-2.0-flash) for structured JSON output
  // This responds in 3-8s instead of 30-40s with 2.5-flash's thinking
  const responseText = await generateWithGemini(agent.workPersonality, prompt, 'fast');

  return parseGeminiResponse(responseText, task, effectiveSpecs);
}

/**
 * Parse Gemini's response into structured deliverables.
 * Handles: clean JSON, markdown-wrapped JSON, truncated JSON, and raw text fallback.
 */
function parseGeminiResponse(
  responseText: string,
  task: any,
  specs: any[]
): { summary: string; deliverables: any[] } {
  let cleaned = responseText.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  // Attempt 1: Direct JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.summary && Array.isArray(parsed.deliverables)) {
      console.log(`[STEALTH] Parsed ${parsed.deliverables.length} deliverable(s) from JSON`);
      return { summary: parsed.summary, deliverables: parsed.deliverables };
    }
  } catch {
    // Fall through to repair attempts
  }

  // Attempt 2: Try to repair truncated JSON (common with token limits)
  try {
    let repaired = cleaned;
    // Count open/close braces and brackets
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;

    // If truncated mid-string, close the string
    const lastQuote = repaired.lastIndexOf('"');
    const afterLastQuote = repaired.slice(lastQuote + 1).trim();
    if (lastQuote > 0 && !afterLastQuote.startsWith(':') && !afterLastQuote.startsWith(',') && !afterLastQuote.startsWith('}') && !afterLastQuote.startsWith(']')) {
      repaired = repaired.slice(0, lastQuote + 1);
    }

    // Close any unclosed structures
    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

    const parsed = JSON.parse(repaired);
    if (parsed.summary && Array.isArray(parsed.deliverables) && parsed.deliverables.length > 0) {
      console.log(`[STEALTH] Repaired truncated JSON, got ${parsed.deliverables.length} deliverable(s)`);
      return { summary: parsed.summary, deliverables: parsed.deliverables };
    }
  } catch {
    // Fall through to content extraction
  }

  // Attempt 3: Extract structured content from raw text
  console.warn('[STEALTH] JSON parsing failed, extracting content from raw text');
  return extractDeliverablesFromText(responseText, task, specs);
}

/**
 * Extract deliverables from raw text when JSON parsing fails.
 * Looks for code blocks, markdown sections, and structured content.
 */
function extractDeliverablesFromText(
  rawText: string,
  task: any,
  specs: any[]
): { summary: string; deliverables: any[] } {
  const deliverables: any[] = [];

  // Extract code blocks (```language ... ```)
  const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
  const codeBlocks: { language: string; content: string }[] = [];
  let match;
  while ((match = codeBlockRegex.exec(rawText)) !== null) {
    const lang = match[1] || '';
    const content = match[2].trim();
    // Skip JSON blocks (those are failed response format, not actual code)
    if (lang !== 'json' && content.length > 50) {
      codeBlocks.push({ language: lang, content: `// language: ${lang}\n${content}` });
    }
  }

  // Extract text content (everything outside code blocks)
  let textContent = rawText
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/^[\s\S]*?"summary"\s*:\s*"[^"]*"/, '') // Remove JSON artifacts
    .replace(/[{}[\]]/g, '') // Remove JSON brackets
    .replace(/"specIndex"\s*:\s*\d+\s*,?/g, '') // Remove JSON fields
    .replace(/"type"\s*:\s*"[^"]*"\s*,?/g, '')
    .replace(/"label"\s*:\s*"[^"]*"\s*,?/g, '')
    .replace(/"content"\s*:\s*/g, '')
    .replace(/"deliverables"\s*:\s*/g, '')
    .trim();

  // Remove leading/trailing quotes from extracted text
  if (textContent.startsWith('"')) textContent = textContent.slice(1);
  if (textContent.endsWith('"')) textContent = textContent.slice(0, -1);
  // Unescape JSON-encoded newlines
  textContent = textContent.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');

  // Map extracted content to specs
  let codeBlockIndex = 0;
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];

    if (spec.type === 'code' && codeBlockIndex < codeBlocks.length) {
      deliverables.push({
        specIndex: i,
        type: 'code',
        label: spec.label,
        content: codeBlocks[codeBlockIndex].content,
      });
      codeBlockIndex++;
    } else if (spec.type === 'code' && codeBlocks.length === 0) {
      // No code blocks found, use text content as code (Gemini didn't format properly)
      deliverables.push({
        specIndex: i,
        type: 'code',
        label: spec.label,
        content: `// Auto-extracted from response\n${textContent.slice(0, 3000)}`,
      });
    } else if (spec.type === 'text') {
      deliverables.push({
        specIndex: i,
        type: 'text',
        label: spec.label,
        content: textContent.length > 20 ? textContent.slice(0, 5000) : `Work completed for: ${task.title}\n\n${rawText.slice(0, 3000)}`,
      });
    } else {
      deliverables.push({
        specIndex: i,
        type: spec.type,
        label: spec.label,
        content: textContent.slice(0, 3000) || `Deliverable for: ${task.title}`,
      });
    }
  }

  // Generate a summary from the first 200 chars of text content
  const summary = textContent.length > 20
    ? textContent.replace(/[#*\-_]/g, '').trim().slice(0, 200)
    : `Work completed for: ${task.title}`;

  return { summary, deliverables };
}

/**
 * Infer deliverable specs from task category when none are provided.
 * Mirrors getDeliverableSpecs in auto-post-tasks.ts.
 */
function inferSpecsFromCategory(category: string): Array<{ type: string; label: string; description: string; required: boolean }> {
  switch (category) {
    case 'Development':
      return [
        { type: 'code', label: 'Source Code', description: 'Complete, runnable source code with inline comments', required: true },
        { type: 'text', label: 'Documentation', description: 'Setup instructions, dependencies, and usage guide', required: true },
      ];
    case 'Research':
      return [
        { type: 'text', label: 'Research Report', description: 'Structured report with findings, comparison tables, data, and citations', required: true },
      ];
    case 'Analysis':
      return [
        { type: 'text', label: 'Analysis Report', description: 'Data-driven analysis with methodology, findings, tables, and recommendations', required: true },
        { type: 'code', label: 'Data / Formulas', description: 'Supporting calculations, scripts, or raw data', required: false },
      ];
    case 'Content':
      return [
        { type: 'text', label: 'Content Deliverable', description: 'Final polished copy with proper formatting, ready to publish', required: true },
      ];
    case 'Social':
      return [
        { type: 'text', label: 'Content Calendar / Posts', description: 'Ready-to-publish posts with platform-specific formatting and schedule', required: true },
      ];
    case 'Design':
      return [
        { type: 'text', label: 'Design Specification', description: 'Complete spec with tokens, color values, typography, and component definitions', required: true },
        { type: 'code', label: 'Design Tokens', description: 'Design tokens as CSS custom properties or JSON', required: false },
      ];
    case 'Security':
      return [
        { type: 'text', label: 'Security Report', description: 'Vulnerability report with severity ratings and remediation steps', required: true },
        { type: 'code', label: 'Fix Patches', description: 'Code patches or configuration fixes for identified vulnerabilities', required: false },
      ];
    default:
      return [
        { type: 'text', label: 'Deliverable', description: 'Complete work product with structured formatting', required: true },
      ];
  }
}

/**
 * Get category-specific quality instructions for the fulfiller prompt.
 */
function getCategoryInstructions(category: string): string {
  switch (category) {
    case 'Development':
      return `This is a DEVELOPMENT task. Your primary deliverable must be actual source code.
- Write complete, runnable code -- not snippets or pseudocode
- Include proper imports, error handling, and edge cases
- Add inline comments explaining non-obvious logic
- Use consistent code style and meaningful variable names
- The documentation deliverable should include: how to install dependencies, how to run the code, and expected output`;

    case 'Research':
      return `This is a RESEARCH task. Deliver a structured, data-rich report.
- Use markdown tables for comparisons (| Feature | Tool A | Tool B |)
- Include specific data points, numbers, and pricing where relevant
- Cite sources or reference specific tools/products by name
- Organize with clear sections: Overview, Findings, Comparison, Recommendations
- End with actionable recommendations, not just observations`;

    case 'Analysis':
      return `This is an ANALYSIS task. Deliver data-driven insights with methodology.
- Show your analytical framework/methodology upfront
- Use markdown tables for data presentation
- Include specific metrics, calculations, and benchmarks
- Provide severity ratings or priority rankings where appropriate
- End with prioritized, actionable recommendations`;

    case 'Content':
      return `This is a CONTENT task. Deliver polished, publish-ready copy.
- Write in the appropriate tone for the target audience
- Use proper markdown formatting (headings, bold, lists)
- Include specific details, not generic filler
- If writing multiple pieces, clearly separate each one
- Follow any specified word counts or format requirements`;

    case 'Social':
      return `This is a SOCIAL MEDIA task. Deliver platform-specific, ready-to-post content.
- Write actual post copy, not descriptions of what to post
- Respect platform character limits (Twitter/X: 280 chars per tweet)
- Include hashtags, posting schedule, and content type labels
- If creating threads, write out every tweet in the thread
- Use a content calendar format with dates and times`;

    case 'Design':
      return `This is a DESIGN task. Deliver precise, implementable specifications.
- Include specific values: hex colors, font sizes in px/rem, spacing in px
- Use markdown tables for token documentation
- Provide CSS custom properties or JSON tokens as code deliverables
- Document component states (default, hover, active, disabled, error)
- Be precise enough that a developer could implement from your spec alone`;

    case 'Security':
      return `This is a SECURITY task. Deliver a structured vulnerability assessment.
- Rate each finding: Critical / High / Medium / Low severity
- Include: description, affected component, impact, and remediation steps
- Use a consistent format for each finding
- Provide code patches as separate code deliverables where applicable
- Include a prioritized remediation roadmap`;

    default:
      return `Deliver a thorough, well-structured response using markdown formatting.
- Use headers to organize sections
- Use tables for any comparative data
- Be specific and actionable, not generic`;
  }
}


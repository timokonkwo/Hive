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
      console.error(`[STEALTH] Retry also failed. Skipping task ${bid.taskId}.`);
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
  const specDescriptions =
    specs.length > 0
      ? specs
          .map(
            (s: any, i: number) =>
              `Deliverable ${i}: type="${s.type}", label="${s.label}", required=${s.required}, description="${s.description || ''}"`
          )
          .join('\n')
      : 'No specific deliverable specs. Provide a single text deliverable with your work.';

  const errorContext = previousErrors
    ? `\n\nPREVIOUS ATTEMPT FAILED WITH ERRORS:\n${previousErrors.join('\n')}\nFix these issues in your response.`
    : '';

  const prompt = `Complete the following task and provide deliverables.

TASK:
Title: ${task.title}
Category: ${task.category}
Description: ${task.description}
Requirements: ${task.requirements || 'None specified'}
Budget: ${task.budget || 'Negotiable'}

DELIVERABLE SPECIFICATIONS:
${specDescriptions}
${errorContext}

RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, no code blocks, just raw JSON):
{
  "summary": "A 2-3 sentence summary of the completed work (min 20 characters)",
  "deliverables": [
    {
      "specIndex": 0,
      "type": "text",
      "label": "Descriptive label",
      "content": "The actual deliverable content — be thorough and specific"
    }
  ]
}

For each deliverable spec, include a matching deliverable with the correct specIndex and type.
If there are no specs, provide a single text deliverable (specIndex: 0, type: "text").
The summary must be at least 20 characters long.
Content should be substantial and demonstrate real work.`;

  const responseText = await generateWithGemini(agent.workPersonality, prompt);

  // Parse the JSON response — handle potential markdown wrapping
  let cleaned = responseText.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary || 'Work completed as specified.',
      deliverables: Array.isArray(parsed.deliverables)
        ? parsed.deliverables
        : [{ specIndex: 0, type: 'text', label: 'Deliverable', content: parsed.summary || cleaned }],
    };
  } catch {
    // If JSON parsing fails, wrap the raw text as a single deliverable
    console.warn('[STEALTH] Could not parse Gemini response as JSON, wrapping as text deliverable');
    return {
      summary: `Work completed for: ${task.title}`,
      deliverables: [
        {
          specIndex: 0,
          type: 'text',
          label: 'Deliverable',
          content: cleaned.slice(0, 5000),
        },
      ],
    };
  }
}

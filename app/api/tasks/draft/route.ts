import { NextRequest, NextResponse } from 'next/server';
import { buildTaskDraft, validateAcceptanceRubric } from '@/lib/task-builder';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { generateWithGemini } from '@/lib/stealth-agents/gemini';
import { logger } from '@/lib/logger';

const CATEGORIES = [
  'Development',
  'Analysis',
  'Security',
  'Token Launch',
  'Research',
  'Content',
  'Design',
  'Social',
  'Legal',
  'Translation',
  'Other',
];

type TaskDraft = ReturnType<typeof buildTaskDraft>;

function stripCodeFence(value: string) {
  const cleaned = value.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenceMatch ? fenceMatch[1] : cleaned).trim();
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseAiDraft(responseText: string, fallbackDraft: TaskDraft) {
  const parsed = JSON.parse(stripCodeFence(responseText)) as Record<string, unknown>;
  const rawCategory = cleanString(parsed.category, 80);
  const category = CATEGORIES.includes(rawCategory) ? rawCategory : fallbackDraft.category;
  const tags = cleanStringArray(parsed.tags, 8, 32);
  const acceptanceRubric = cleanStringArray(parsed.acceptanceRubric, 8, 180);

  return {
    title: cleanString(parsed.title, 90) || fallbackDraft.title,
    description: cleanString(parsed.description, 4000) || fallbackDraft.description,
    category,
    requirements: cleanString(parsed.requirements, 3000) || fallbackDraft.requirements,
    tags: tags.length > 0 ? tags : fallbackDraft.tags,
    budget: cleanString(parsed.budget, 80) || fallbackDraft.budget,
    deliverableSpecs: Array.isArray(parsed.deliverableSpecs) && parsed.deliverableSpecs.length > 0
      ? parsed.deliverableSpecs.slice(0, 5).map((spec) => {
          const item = typeof spec === 'object' && spec !== null ? spec as Record<string, unknown> : {};
          return {
            type: ['text', 'code', 'url', 'token_launch'].includes(String(item.type)) ? String(item.type) : 'text',
            label: cleanString(item.label, 80) || 'Final deliverable',
            description: cleanString(item.description, 240) || 'Complete final output for client review.',
            required: item.required !== false,
          };
        })
      : fallbackDraft.deliverableSpecs,
    acceptanceRubric: acceptanceRubric.length > 0 ? acceptanceRubric : fallbackDraft.acceptanceRubric,
    confidence: 'high',
    source: 'ai',
  };
}

async function buildAiTaskDraft(input: {
  prompt: string;
  category?: string;
  budget?: string;
  acceptanceRubric?: unknown;
}) {
  const fallbackDraft = buildTaskDraft(input);
  const requestedCategory = CATEGORIES.includes(input.category || '') ? input.category : undefined;

  const systemPrompt = `You structure rough work requests into clear marketplace task drafts for autonomous AI agents.
Return only valid JSON. Do not include markdown fences or explanations.`;

  const userPrompt = `Convert this rough client intent into a structured Hive task draft.

Allowed categories: ${CATEGORIES.join(', ')}
Requested category, if useful: ${requestedCategory || 'not specified'}
Requested budget, if useful: ${input.budget || 'not specified'}

Rough intent:
${input.prompt}

Return exactly this JSON shape:
{
  "title": "Specific action-oriented title, 8-90 characters",
  "description": "Clear client-facing task description with context, goals, and expected outcome. Do not copy the rough intent verbatim.",
  "category": "One allowed category",
  "requirements": "Markdown with sections for Scope, Requirements, Constraints/Assumptions, and Review Notes",
  "tags": ["3-8 short useful tags, not a pasted sentence"],
  "budget": "$123 USDC or Negotiable",
  "deliverableSpecs": [
    { "type": "text", "label": "Final deliverable", "description": "What the agent must submit", "required": true }
  ],
  "acceptanceRubric": ["4-6 concrete pass/fail review criteria"]
}

Rules:
- Preserve the user's intent, but improve specificity and structure.
- Use "code" deliverables only when implementation/source code is clearly required.
- Use "token_launch" only for token launch work.
- Keep tags as short topical labels, never full sentences.
- If budget is unclear, use "Negotiable".
- Do not invent private credentials, URLs, datasets, or claims not implied by the prompt.`;

  try {
    const responseText = await generateWithGemini(systemPrompt, userPrompt, 'fast');
    return parseAiDraft(responseText, fallbackDraft);
  } catch (error) {
    logger.warn('[TASK DRAFT] AI draft failed; using deterministic fallback:', error);
    return { ...fallbackDraft, source: 'fallback' };
  }
}

/**
 * POST /api/tasks/draft
 *
 * Converts rough client intent into a structured task draft with AI and falls
 * back to deterministic parsing if the model provider is unavailable.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`draft-task:${ip}`, RATE_LIMITS.CREATE_TASK);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    if (prompt.length < 20) {
      return NextResponse.json({ error: 'prompt must be at least 20 characters.' }, { status: 400 });
    }
    if (prompt.length > 4000) {
      return NextResponse.json({ error: 'prompt must be 4000 characters or less.' }, { status: 400 });
    }

    const rubricResult = validateAcceptanceRubric(body.acceptanceRubric);
    if (!rubricResult.valid) {
      return NextResponse.json(
        { error: 'Invalid acceptanceRubric.', details: rubricResult.errors },
        { status: 400 }
      );
    }

    const draft = await buildAiTaskDraft({
      prompt,
      category: body.category,
      budget: body.budget,
      acceptanceRubric: body.acceptanceRubric,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    logger.error('POST /api/tasks/draft error:', error);
    return NextResponse.json({ error: 'Failed to draft task.' }, { status: 500 });
  }
}

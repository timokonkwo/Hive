import { NextRequest, NextResponse } from 'next/server';
import { buildTaskDraft, validateAcceptanceRubric } from '@/lib/task-builder';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/tasks/draft
 *
 * Converts rough client intent into a structured task draft. This deterministic
 * foundation keeps the workflow available without depending on an external LLM.
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

    const draft = buildTaskDraft({
      prompt,
      category: body.category,
      budget: body.budget,
      acceptanceRubric: body.acceptanceRubric,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    console.error('POST /api/tasks/draft error:', error);
    return NextResponse.json({ error: 'Failed to draft task.' }, { status: 500 });
  }
}

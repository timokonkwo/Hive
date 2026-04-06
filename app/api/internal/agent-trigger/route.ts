import { NextRequest, NextResponse } from 'next/server';
import { STEALTH_AGENT_SECRET } from '@/lib/stealth-agents/config';
import { handleNewTask } from '@/lib/stealth-agents/runner';
import { timingSafeEqual } from 'crypto';
import { ObjectId } from 'mongodb';

/**
 * POST /api/internal/agent-trigger
 * 
 * Internal endpoint called by the task creation route to trigger
 * stealth agent bidding on a new task. Protected by a shared secret.
 * 
 * This is NOT a public API — it's server-to-server only.
 */
export async function POST(req: NextRequest) {
  // Verify internal secret (timing-safe to prevent timing attacks)
  const secret = req.headers.get('x-stealth-secret') || '';
  try {
    const a = Buffer.from(secret);
    const b = Buffer.from(STEALTH_AGENT_SECRET);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { taskId, title, description, category, requirements, budget } = body;

    if (!taskId || !title || !category) {
      return NextResponse.json(
        { error: 'taskId, title, and category are required' },
        { status: 400 }
      );
    }

    // Validate taskId format
    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: 'Invalid taskId format' }, { status: 400 });
    }

    const result = await handleNewTask({
      taskId,
      title,
      description: description || '',
      category,
      requirements: requirements || '',
      budget: budget || 'Negotiable',
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[STEALTH] Trigger error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}

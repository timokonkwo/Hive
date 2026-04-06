import { NextRequest, NextResponse } from 'next/server';
import { STEALTH_AGENT_SECRET } from '@/lib/stealth-agents/config';
import { handleNewTask } from '@/lib/stealth-agents/runner';

/**
 * POST /api/internal/agent-trigger
 * 
 * Internal endpoint called by the task creation route to trigger
 * stealth agent bidding on a new task. Protected by a shared secret.
 * 
 * This is NOT a public API — it's server-to-server only.
 */
export async function POST(req: NextRequest) {
  // Verify internal secret
  const secret = req.headers.get('x-stealth-secret');
  if (secret !== STEALTH_AGENT_SECRET) {
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
      { error: error.message || 'Trigger failed' },
      { status: 500 }
    );
  }
}

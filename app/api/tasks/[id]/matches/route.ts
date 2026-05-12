import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { rankAgentsForTask } from '@/lib/smart-matching';

/**
 * GET /api/tasks/[id]/matches
 *
 * Returns explainable agent matches for a task. This is read-only and does not
 * assign an agent or submit bids, so existing automation paths remain unchanged.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`task-matches:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid task ID.' }, { status: 400 });
    }

    const db = await getDb();
    const task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(id) });
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10), 1), 25);
    const matches = await rankAgentsForTask(
      db,
      {
        id,
        title: task.title,
        description: task.description,
        category: task.category,
        requirements: task.requirements,
        tags: task.tags,
        budget: task.budget,
        budgetAmount: task.budgetAmount,
      },
      { limit, persist: true }
    );

    return NextResponse.json({
      taskId: id,
      category: task.category,
      matches: matches.map(({ agent, ...match }) => ({
        ...match,
        agent: {
          id: match.agentId,
          name: match.agentName,
          bio: agent.bio || '',
          reputation: agent.reputation || 0,
          avgSatisfaction: agent.avgSatisfaction || 0,
          reviewCount: agent.reviewCount || 0,
          capabilities: agent.capabilities || [],
          isVerified: !!agent.isVerified,
          isTokenized: !!agent.isTokenized,
          tokenSymbol: agent.tokenSymbol || null,
        },
      })),
    });
  } catch (error: any) {
    console.error('GET /api/tasks/[id]/matches error:', error);
    return NextResponse.json({ error: 'Failed to rank task matches.' }, { status: 500 });
  }
}

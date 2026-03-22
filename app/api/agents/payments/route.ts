import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * GET /api/agents/payments
 * Returns payment history for the authenticated agent.
 * Auth: x-hive-api-key header
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`agents-payments:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required. Provide x-hive-api-key header.' },
        { status: 401 }
      );
    }

    const { agent } = auth;

    // Build query matching both agentId and legacy walletAddress
    const agentMatchQuery: any = { $or: [{ assignedAgent: agent.id }] };
    if (agent.walletAddress) {
      const escaped = agent.walletAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      agentMatchQuery.$or.push({ assignedAgent: { $regex: new RegExp(`^${escaped}$`, 'i') } });
    }

    // Get completed tasks with payment info
    const completedTasks = await db.collection('tasks')
      .find({
        ...agentMatchQuery,
        status: 'Completed',
      })
      .sort({ completedAt: -1 })
      .limit(100)
      .toArray();

    const payments = completedTasks.map((task: any) => ({
      taskId: task._id.toString(),
      title: task.title || 'Untitled Task',
      amount: task.budget || task.bountyAmount || '0',
      txSignature: task.paymentTxSignature || null,
      solscanUrl: task.paymentTxSignature
        ? `https://solscan.io/tx/${task.paymentTxSignature}`
        : null,
      clientAddress: task.clientAddress || null,
      completedAt: task.completedAt || task.updatedAt || null,
    }));

    // Calculate totals
    const totalEarned = completedTasks.reduce((sum: number, t: any) => {
      const budgetStr = t.budget || t.bountyAmount || '0';
      const num = parseFloat(budgetStr.replace(/[^0-9.]/g, ''));
      return sum + (isNaN(num) ? 0 : num);
    }, 0);

    return NextResponse.json({
      payments,
      summary: {
        totalPayments: payments.length,
        totalEarned: totalEarned.toFixed(2),
        currency: 'USDC',
      },
    });
  } catch (error: any) {
    console.error('[HIVE] /api/agents/payments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments.' },
      { status: 500 }
    );
  }
}

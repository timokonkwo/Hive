import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { STAKING_TIERS, getStakingTierInfo } from '@/lib/token-utils';
import { isValidSolanaAddress } from '@/lib/solana-pay';
import { voteWindow } from '@/lib/dispute-view';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  const rl = checkRateLimit(`dispute-voter:${getClientIp(req)}`, RATE_LIMITS.READ);
  if (!rl.allowed) return reply({ error: 'Too many requests. Try again shortly.' }, 429);
  try {
    const { id } = await params, address = req.nextUrl.searchParams.get('address');
    if (!/^[a-f0-9]{24}$/i.test(id) || !address || !isValidSolanaAddress(address)) return reply({ error: 'Select a valid Solana wallet.' }, 400);
    const db = await getDb(), client = await authenticateClient(req), agent = !client ? await authenticateRequest(req.headers, db) : null, userId = client?.userId || agent?.agent?.id;
    if (!userId) return reply({ error: 'Sign in to check voting access.' }, 401);
    const dispute = await db.collection(COLLECTIONS.DISPUTES).findOne({ _id: new ObjectId(id) });
    if (!dispute) return reply({ error: 'Case not found.' }, 404);
    const [vote, stake] = await Promise.all([db.collection(COLLECTIONS.DISPUTE_VOTES).findOne({ disputeId: id, $or: [{ userId }, { solanaAddress: address }] }), db.collection(COLLECTIONS.STAKES).findOne({ solanaAddress: address })]);
    const active = typeof stake?.activeAmount === 'number' && Number.isFinite(stake.activeAmount) && stake.activeAmount > 0 ? stake.activeAmount : 0;
    const weight = active >= STAKING_TIERS.staker.threshold ? active * (getStakingTierInfo(active)?.governanceMultiplier || 1) : 0;
    // Other accounts' vote details are private. A shared wallet can still block a duplicate.
    return reply({ disputeId: id, address, minimum: STAKING_TIERS.staker.threshold, weight, eligible: !vote && voteWindow(dispute) && weight > 0, alreadyVoted: !!vote, vote: vote && vote.userId === userId ? { choice: vote.vote, weight: vote.weight, address: vote.solanaAddress, timestamp: vote.timestamp } : null });
  } catch { return reply({ error: 'Voting access could not be checked.' }, 503); }
}

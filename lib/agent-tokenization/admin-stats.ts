import type { Db } from 'mongodb';
import { readAssociation } from './association';
import { ponsTokenUrl } from './policy';

/** Read the verified launch journal; never infer a launch from an unsigned draft. */
export async function ponsAdminStats(db: Db, monthStart: Date, todayStart: Date) {
  const intents = db.collection('pons_launch_intents');
  const confirmed = { chainId: 4663, phase: 'confirmed' };
  const [totalLaunched, totalQueued, totalFailed, launchesThisMonth, launchesToday, recent] = await Promise.all([
    intents.countDocuments(confirmed),
    intents.countDocuments({ chainId: 4663, active: true, phase: { $in: ['awaiting-signature', 'submitted', 'confirming'] } }),
    intents.countDocuments({ chainId: 4663, phase: 'reverted' }),
    intents.countDocuments({ ...confirmed, createdAt: { $gte: monthStart } }),
    intents.countDocuments({ ...confirmed, createdAt: { $gte: todayStart } }),
    intents.find(confirmed, { projection: { _id: 1, agentId: 1, 'preview.metadata.name': 1, token: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(20).toArray(),
  ]);
  const recentLaunches = recent.flatMap(intent => {
    const token = readAssociation(intent.token);
    return token ? [{ id: intent._id.toString(), agentId: intent.agentId, agentName: intent.preview?.metadata?.name || 'Agent',
      tokenSymbol: token.symbol, mintAddress: token.address, transactionId: token.transactionHash,
      chain: 'Robinhood', tradeUrl: ponsTokenUrl(token.address), status: 'launched', error: null, createdAt: intent.createdAt }] : [];
  });
  return { totalLaunched, totalQueued, totalFailed, launchesThisMonth, launchesToday, recentLaunches };
}

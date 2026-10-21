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
    intents.countDocuments({ ...confirmed, launchedAt: { $gte: monthStart } }),
    intents.countDocuments({ ...confirmed, launchedAt: { $gte: todayStart } }),
    intents.find(confirmed, { projection: { _id: 1, agentId: 1, 'preview.metadata.name': 1, token: 1, launchedAt: 1 } }).sort({ launchedAt: -1 }).limit(20).toArray(),
  ]);
  const recentLaunches = recent.flatMap(intent => {
    const token = readAssociation(intent.token);
    return token ? [{ id: intent._id.toString(), agentId: intent.agentId, agentName: intent.preview?.metadata?.name || 'Agent',
      tokenSymbol: token.symbol, mintAddress: token.address, transactionId: token.transactionHash,
      chain: 'Robinhood', tradeUrl: ponsTokenUrl(token.address), status: 'launched', error: null, createdAt: intent.launchedAt || null }] : [];
  });
  return { totalLaunched, totalQueued, totalFailed, launchesThisMonth, launchesToday, recentLaunches };
}

/** New Solana journals are independent of legacy Bags fields; Pons remains counted by its original journal. */
export async function solanaSessionStats(db: Db, monthStart: Date, todayStart: Date) {
  const catalog = db.collection('agent_token_catalog');
  const query = { platform: { $in: ['bags', 'pump'] } };
  const [bags, pump, month, today, recent, pending] = await Promise.all([
    catalog.countDocuments({ platform: 'bags' }), catalog.countDocuments({ platform: 'pump' }),
    catalog.countDocuments({ ...query, 'token.launchedAt': { $gte: monthStart.toISOString() } }),
    catalog.countDocuments({ ...query, 'token.launchedAt': { $gte: todayStart.toISOString() } }),
    catalog.find(query).sort({ 'token.launchedAt': -1, _id: -1 }).limit(50).toArray(),
    db.collection('agent_launch_sessions').aggregate<{ _id: string; count: number }>([
      { $unwind: '$session.targets' }, { $match: { 'session.targets.terms.platform': { $in: ['bags', 'pump'] } } },
      { $group: { _id: '$session.targets.phase', count: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const { ObjectId } = await import('mongodb');
  const agents = await db.collection('agents').find({ _id: { $in: [...new Set(recent.map(r => r.agentId))].filter(id => /^[a-f0-9]{24}$/.test(id)).map(id => new ObjectId(id)) } }).project({ name: 1 }).toArray();
  const names = new Map(agents.map(agent => [agent._id.toString(), agent.name]));
  const { readAgentToken, tradeUrl, platforms } = await import('./platforms');
  const recentLaunches = recent.flatMap(row => {
    const token = readAgentToken(row.token); if (!token) return [];
    return [{ id: String(row._id), agentId: row.agentId, agentName: names.get(row.agentId) || 'Agent', tokenSymbol: token.symbol,
      mintAddress: token.address, transactionId: token.transactionHash, chain: 'Solana', platform: platforms[token.platform].name,
      tradeUrl: tradeUrl(token), status: 'launched', error: null, createdAt: token.launchedAt || null }];
  });
  return { totalLaunched: bags + pump, bags, pump, launchesThisMonth: month, launchesToday: today,
    totalFailed: pending.find(p => p._id === 'failed')?.count || 0,
    totalQueued: pending.filter(p => ['queued', 'preparing', 'awaiting-signature', 'submitted', 'confirming', 'blocked'].includes(p._id)).reduce((s, p) => s + p.count, 0), recentLaunches };
}

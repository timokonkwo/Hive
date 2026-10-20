// Read-only by default. --apply updates only dates for receipt-verified launches.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { MongoClient, ObjectId } from 'mongodb';
import { createPublicClient, http } from 'viem';
import { worker, policy } from './modules.mjs';

const apply = process.argv.includes('--apply');
const local = parseEnv(readFileSync(new URL('../../.env.local', import.meta.url), 'utf8'));
const mongo = new MongoClient(local.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
const client = createPublicClient({
  transport: http(process.env.HIVE_PONS_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', { timeout: 20000, retryCount: 1 }),
});
try {
  await mongo.connect();
  const db = mongo.db('hive');
  const intents = db.collection('pons_launch_intents');
  const rows = await intents.find({ chainId: policy.PONS_CHAIN_ID, phase: 'confirmed', launchedAt: { $exists: false } }).toArray();
  for (const intent of rows) {
    const verified = await worker.recoverLaunch(client, intent);
    if (verified.phase !== 'confirmed' || !verified.token?.launchedAt
      || !policy.sameAddress(verified.token.address, intent.token?.address || '')
      || verified.token.transactionHash !== intent.transactionHash) throw Error('Launch identity or receipt date could not be verified.');
    if (apply) {
      const result = await intents.updateOne({
        _id: intent._id, phase: 'confirmed', revision: intent.revision,
        transactionHash: verified.token.transactionHash, launchedAt: { $exists: false },
      }, { $set: { launchedAt: new Date(verified.token.launchedAt), 'token.launchedAt': verified.token.launchedAt } });
      if (result.matchedCount !== 1) throw Error('Launch changed during backfill; no further records updated.');
      await db.collection('agents').updateOne({
        _id: new ObjectId(intent.agentId), 'ponsToken.transactionHash': verified.token.transactionHash,
      }, { $set: { 'ponsToken.launchedAt': verified.token.launchedAt } });
    }
    console.log(JSON.stringify({ agentId: intent.agentId, transactionHash: verified.token.transactionHash, launchedAt: verified.token.launchedAt, applied: apply }));
  }
  console.log(JSON.stringify({ verified: rows.length, applied: apply }));
} catch {
  // Provider errors may contain credential-bearing URLs.
  console.error('Launch date backfill could not complete. No unverified dates were written.');
  process.exitCode = 1;
} finally {
  await mongo.close();
}

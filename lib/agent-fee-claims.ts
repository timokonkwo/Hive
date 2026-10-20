import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import type { AgentBagsClient } from './bags-agent';
import { claimAgentFees, type FeeTransaction } from './agent-fees';

type ClaimRecord = { _id: string; requestId?: string; leaseId?: string; leaseUntil: Date; transactions: FeeTransaction[]; message?: string; error?: string | null; updatedAt: Date };
const collection = (db: Db) => db.collection<ClaimRecord>('agent_fee_claims');

/** A signed transaction is journaled before broadcast, so response loss is recoverable. */
export async function feeClaimStatus(db: Db, bags: AgentBagsClient) {
  const record = await collection(db).findOne({ _id: bags.getWalletAddress() });
  if (!record) return null;
  const transactions = record.transactions.map(tx => ({ ...tx }));
  const unresolved = transactions.filter(tx => !tx.confirmed && !tx.failed);
  if (unresolved.length) {
    const [statuses, height] = await Promise.all([
      bags.connection.getSignatureStatuses(unresolved.map(tx => tx.signature), { searchTransactionHistory: true }),
      bags.connection.getBlockHeight('finalized'),
    ]);
    unresolved.forEach((tx, index) => {
      const status = statuses.value[index];
      if (status?.err) tx.failed = true;
      else if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') tx.confirmed = true;
      else if (!status && height > tx.lastValidBlockHeight) tx.failed = true;
    });
  }
  const running = record.leaseUntil.getTime() > Date.now();
  const pending = running || transactions.some(tx => !tx.confirmed && !tx.failed);
  const confirmed = transactions.filter(tx => tx.confirmed).length;
  const failed = transactions.filter(tx => tx.failed).length;
  const summary = pending ? 'Confirming fee claims…' : failed ? `${confirmed} confirmed; ${failed} failed or expired.`
    : confirmed ? `${confirmed} fee claim${confirmed === 1 ? '' : 's'} confirmed.` : record.message || 'No claimable fees found.';
  const error = !pending ? record.error || null : null;
  const message = error ? `${confirmed ? summary + ' ' : ''}${error}` : summary;
  return { requestId: record.requestId, pending, confirmed, failed, error, message, transactions };
}

export async function runFeeClaim(db: Db, bags: AgentBagsClient, requestId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(requestId)) throw Error('Invalid fee claim request.');
  const rows = collection(db), wallet = bags.getWalletAddress(), now = new Date();
  try { await rows.updateOne({ _id: wallet }, { $setOnInsert: { leaseUntil: new Date(0), transactions: [], updatedAt: now } }, { upsert: true }); }
  catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 11000) throw error; }
  const leaseId = randomUUID();
  const saved = await rows.findOneAndUpdate({ _id: wallet, leaseUntil: { $lte: now } }, { $set: { leaseId, leaseUntil: new Date(now.getTime() + 120000) } }, { returnDocument: 'before' });
  if (!saved) return feeClaimStatus(db, bags);
  const fence = { _id: wallet, leaseId };
  try {
    // Read the saved transactions while holding the wallet lease. Other tabs cannot start a competing batch.
    const previous = await feeClaimStatus(db, bags);
    if (saved.requestId !== requestId && !previous?.transactions.some(tx => !tx.confirmed && !tx.failed)) {
      await rows.updateOne(fence, { $set: { requestId, transactions: [], error: null, message: 'Preparing fee claims…', updatedAt: now } });
      const result = await claimAgentFees(bags, {
        beforeSend: async tx => {
          const result = await rows.updateOne({ ...fence, leaseUntil: { $gt: new Date() } }, { $push: { transactions: tx }, $set: { updatedAt: new Date() } });
          if (!result.matchedCount) throw Error('Fee claim lease expired before broadcast.');
        },
        settled: async tx => { await rows.updateOne({ ...fence, 'transactions.signature': tx.signature }, { $set: { 'transactions.$': tx, updatedAt: new Date() } }); },
      });
      // Submission timeouts are resolved by their saved signatures. Preparation
      // failures have no receipt and must remain visible alongside successful claims.
      const error = result.failed > result.transactions.filter(tx => !tx.confirmed).length
        ? 'Some fees could not be claimed. Refresh balances and try again.' : null;
      await rows.updateOne(fence, { $set: { message: result.message, error, updatedAt: new Date() } });
    }
  } catch {
    await rows.updateOne(fence, { $set: { message: 'Fee claims could not finish. Check transaction status before retrying.', updatedAt: new Date() } });
    throw Error('Fee claims could not finish. Check status before retrying.');
  } finally {
    await rows.updateOne(fence, { $set: { leaseUntil: new Date(0) }, $unset: { leaseId: '' } });
  }
  return feeClaimStatus(db, bags);
}

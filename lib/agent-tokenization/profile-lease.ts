import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { LaunchConflict } from './store';

/** Serialize profile saves with launch preparation, including slow image uploads. */
export async function withAgentProfileLease<T>(db: Db, agentId: string, operation: (assertHeld: () => Promise<void>) => Promise<T>) {
  const locks = db.collection<{ _id: string; token: string; until: Date }>('pons_profile_leases');
  const token = randomUUID(), now = new Date();
  try {
    await locks.findOneAndUpdate({ _id: agentId, until: { $lte: now } },
      { $set: { token, until: new Date(now.getTime() + 120_000) } }, { upsert: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      throw new LaunchConflict('This agent is being updated or prepared. Try again shortly.');
    }
    throw error;
  }
  const assertHeld = async () => {
    if (!await locks.findOne({ _id: agentId, token, until: { $gt: new Date() } })) {
      throw new LaunchConflict('This operation expired. Refresh the agent and try again.');
    }
  };
  try { return await operation(assertHeld); }
  finally { await locks.deleteOne({ _id: agentId, token }); }
}

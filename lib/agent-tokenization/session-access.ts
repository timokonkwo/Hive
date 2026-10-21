import type { Db } from 'mongodb';
import type { LaunchPreview } from './types';
import { SessionConflict, type LaunchSession } from './session';
import { sessionComplete } from './session';
import { sameAddress, purchaseWei } from './policy';

/** Called while holding the profile lease, as well as at the authenticated HTTP boundary. */
export async function sessionPonsPreview(db: Db, preview: LaunchPreview, sessionId?: string): Promise<LaunchPreview> {
  const record = await db.collection<{ _id: string; session: LaunchSession }>('agent_launch_sessions').findOne({ _id: preview.agentId });
  if (!record || sessionComplete(record.session)) {
    if (sessionId) throw new SessionConflict('This launch session has ended. Refresh its status.');
    return preview;
  }
  const session = record.session;
  if (session.id !== sessionId || session.role !== preview.role) throw new SessionConflict('Resume this agent’s multi-platform launch.');
  const index = session.targets.findIndex(t => t.terms.platform === 'pons');
  const target = session.targets[index];
  if (!target || session.targets.slice(0, index).some(t => !['confirmed', 'skipped'].includes(t.phase))) {
    throw new SessionConflict('Finish the earlier platform before launching on Pons.');
  }
  return { ...preview, sessionId, metadata: session.metadata, recipient: target.terms.recipient,
    requiredSigner: session.role === 'owner' ? target.terms.signer : null, feePolicyVersion: 2 };
}

export async function assertSessionPonsTerms(db: Db, preview: LaunchPreview, signer: string, mode: string, symbol: string, purchase: string) {
  const frozen = await sessionPonsPreview(db, preview, preview.sessionId);
  if (!frozen.sessionId) return;
  const record = await db.collection<{ _id: string; session: LaunchSession }>('agent_launch_sessions').findOne({ _id: preview.agentId });
  const target = record?.session.targets.find(t => t.terms.platform === 'pons');
  if (!target || !['preparing', 'awaiting-signature'].includes(target.phase) || target.terms.mode !== mode || !sameAddress(target.terms.signer, signer)
    || record!.session.metadata.symbol !== symbol || target.terms.purchase !== purchaseWei(purchase).toString()) {
    throw new SessionConflict('The Pons launch must match this session’s reviewed settings.');
  }
}

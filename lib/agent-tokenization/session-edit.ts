import type { Db } from 'mongodb';
import { createHash } from 'node:crypto';
import { SessionConflict, type LaunchSession } from './session';
import type { PlatformId } from './platforms';
import { LaunchStore } from './store';
import { discardManagedLaunch } from './managed';

export async function editablePlatforms(db: Db, session: LaunchSession): Promise<PlatformId[]> {
  const editable: PlatformId[] = [];
  for (const target of session.targets) {
    if (target.phase === 'confirmed') continue;
    if (!target.intentId) { editable.push(target.terms.platform); continue; }
    if (target.terms.platform === 'pons') {
      const intent = await new LaunchStore(db).current(session.agentId);
      if (!intent || ['cancelled', 'reverted'].includes(intent.phase) || (intent.mode === 'managed' && !intent.managedSubmission && ['draft', 'awaiting-signature'].includes(intent.phase))) editable.push('pons');
    } else {
      // Submitted setup can still spend. Do not discard its tracking while its result is unknown.
      const unresolved = await db.collection('agent_launch_solana_steps').findOne({ intentId: target.intentId, phase: 'submitted' });
      const launched = await db.collection<{ _id: string; phase: string }>('agent_launch_solana_steps').findOne({ _id: `${target.intentId}:launch`, phase: 'confirmed' });
      if (!unresolved && !launched) editable.push(target.terms.platform);
    }
  }
  return editable;
}

/** Called under the session lease. Archive attempts before replacing any unsigned work. */
export async function reviseSession(db: Db, previous: LaunchSession, draft: LaunchSession) {
  if (!previous.editing || !previous.paused || previous.approval) throw new SessionConflict('Pause the launch before editing.');
  const editable = await editablePlatforms(db, previous);
  const sameMetadata = JSON.stringify(previous.metadata) === JSON.stringify(draft.metadata);
  const targets = [...draft.targets];
  for (const old of previous.targets) {
    const index = targets.findIndex(t => t.terms.platform === old.terms.platform);
    const next = targets[index];
    if (!editable.includes(old.terms.platform) && old.phase !== 'skipped') {
      if (next && JSON.stringify(old.terms) !== JSON.stringify(next.terms)) throw new SessionConflict('A submitted launch is still settling. You can edit the other platforms.');
      const frozen = { ...old, metadata: old.metadata || previous.metadata };
      if (index >= 0) targets[index] = frozen; else targets.push(frozen);
      continue;
    }
    const unchanged = next && sameMetadata && JSON.stringify(next.terms) === JSON.stringify(old.terms) && old.phase !== 'skipped';
    if (unchanged) { targets[index] = { ...old, error: undefined }; continue; }
    if (next && old.terms.platform === 'bags' && old.intentId && await db.collection('agent_launch_solana_steps').findOne({ intentId: old.intentId, phase: 'confirmed' })) {
      targets[index] = { ...next, replacementSetup: true };
    }
    if (old.terms.platform === 'pons' && old.intentId) {
      const intent = await new LaunchStore(db).current(previous.agentId);
      if (intent?.active && intent.mode === 'managed') await discardManagedLaunch(db, intent);
    }
    // Old Solana journals and reservations remain intact for audit. No new mint is allocated here.
    if (!next) targets.push({ ...old, phase: 'skipped', error: undefined });
  }
  draft = { ...draft, digest: createHash('sha256').update(JSON.stringify({ draft: draft.digest,
    targets: targets.map(t => ({ terms: t.terms, metadata: t.metadata || draft.metadata, removed: t.phase === 'skipped' })) })).digest('hex') };
  if (!targets.some(t => !['confirmed', 'skipped'].includes(t.phase))) {
    // A completely deselected draft is a valid cancellation, not a reason to re-enable old targets.
    return { ...draft, targets, paused: true, editing: true, revision: previous.revision + 1 };
  }
  return { ...draft, targets: targets.sort((a, b) => ['bags', 'pump', 'pons'].indexOf(a.terms.platform) - ['bags', 'pump', 'pons'].indexOf(b.terms.platform)),
    paused: true, editing: true, revision: previous.revision + 1 };
}

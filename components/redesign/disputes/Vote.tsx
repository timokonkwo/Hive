"use client";
import { Select } from '@/components/redesign/Select';
import { useRef, useState } from 'react';
import { useWalletChoices } from '../wallet/useWalletChoices';
import { TaskDialog } from '../task/TaskDialog';
import { useGuard } from '../tools/useGuard';
import { write, WriteError } from '../tools/model';
import { useAccess } from './Account';
import { useRead } from './useRead';
import { ReadState } from './controls';
import { object, count, voteMessage, newRequestId, stamp, type Case } from './model';
import { casePhase } from '@/lib/dispute-view';
import styles from './disputes.module.css';
function readVoter(v: unknown) { const d = object(v); if (typeof d.disputeId !== 'string' || typeof d.address !== 'string' || typeof d.eligible !== 'boolean' || typeof d.alreadyVoted !== 'boolean' || typeof d.minimum !== 'number' || typeof d.weight !== 'number' || !Number.isFinite(d.minimum) || !Number.isFinite(d.weight) || d.weight < 0) throw Error('Voting access could not be read.'); return { id: d.disputeId as string, address: d.address as string, minimum: d.minimum as number, weight: d.weight as number, eligible: d.eligible as boolean, alreadyVoted: d.alreadyVoted as boolean, vote: d.vote ? object(d.vote) : null }; }
export function Vote({ dispute, now }: { dispute: Case; now: number }) {
  const access = useAccess(), wallets = useWalletChoices(), [address, setAddress] = useState('');
  if (!access) return <p className={styles.hint}>Sign in to check whether you can vote.</p>;
  if (casePhase(dispute, now) !== 'voting') return <p className={styles.hint}>Voting is not open for this case.</p>;
  return <><p className={styles.hint}>Select the Solana wallet with your active HIVE stake.</p><label className={styles.field}>Voting wallet<Select value={address} onChange={e => setAddress(e.target.value)} disabled={!!access.pending}><option value="">Select a wallet</option>{wallets.choices.solana.map(w => <option key={w.address} value={w.address}>{w.address}</option>)}</Select></label><button className={styles.secondary} disabled={!wallets.ready || !!access.pending} onClick={() => wallets.connect('solana')}>Connect Solana wallet</button>{address && wallets.choices.solana.some(w => w.address === address) && <Voter key={address} dispute={dispute} address={address} />}</>;
}
function Voter({ dispute, address }: { dispute: Case; address: string }) {
  const access = useAccess()!, wallets = useWalletChoices(); const walletRef = useRef(wallets.choices.solana); walletRef.current = wallets.choices.solana;
  const [revision, setRevision] = useState(0), [choice, setChoice] = useState<'slash' | 'dismiss' | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''); const lock = useRef(false);
  const url = `/api/disputes/${dispute.id}/voter?address=${encodeURIComponent(address)}`;
  const r = useRead(url, revision, readVoter, access.request), voter = r.data?.id === dispute.id && r.data.address === address ? r.data : null;
  useGuard(busy, () => setError('Finish or cancel the wallet request first.'));
  async function submit() {
    if (!choice || !voter?.eligible || access.pending || lock.current) return;
    lock.current = true; setBusy(true); setError(''); let sent = false;
    try {
      const res = await access.request(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) }); if (!res.ok) throw Error('Voting access could not be checked. Try again.');
      const fresh = readVoter(await res.json());
      if (!access.active()) return;
      if (fresh.id !== dispute.id || fresh.address !== address || !fresh.eligible || fresh.weight !== voter.weight || casePhase(dispute) !== 'voting') throw Error('Voting access changed. Close this review and refresh the case.');
      const wallet = walletRef.current.find(w => w.address === address); if (!wallet) throw Error('Connect the selected Solana wallet again.');
      const message = voteMessage(dispute.id, choice, address);
      const signature = await wallet.sign(message);
      if (!access.active()) return;
      if (!walletRef.current.some(w => w.address === address) || casePhase(dispute) !== 'voting') throw Error('The wallet or voting window changed. No vote was sent.');
      access.remember({ kind: 'vote', id: newRequestId(), caseId: dispute.id, address, choice });
      sent = true;
      const d = await write(access.request, '/api/disputes/vote', { disputeId: dispute.id, vote: choice, solanaAddress: address, walletProof: { message, signature } });
      if (!access.active()) return;
      if (d.success !== true || d.disputeId !== dispute.id || d.vote !== choice || d.solanaAddress !== address) throw Error('The vote result could not be confirmed.');
      access.clear(); setChoice(null); setNotice('Your vote is recorded.'); setRevision(v => v + 1); access.refresh();
    } catch (e) {
      if (!access.active()) return;
      if (sent && (!(e instanceof WriteError) || e.status >= 500 || e.status === 409)) { setChoice(null); return; }
      if (sent) access.clear(); setError(e instanceof Error ? e.message : 'The wallet request was not completed.');
    } finally { lock.current = false; if (access.active()) setBusy(false); }
  }
  return <><ReadState {...r} retry={() => setRevision(v => v + 1)} />{notice && <p role="status">{notice}</p>}{voter && <div className={styles.voter}>
    {voter.alreadyVoted ? <><h3>Vote recorded</h3><p>{voter.vote ? `${voter.vote.choice === 'slash' ? 'Remove stake' : 'Dismiss case'} · ${count(voter.vote.weight)} vote weight` : 'This account or wallet has already voted.'}</p>{voter.vote && <p className={styles.hint}>{stamp(voter.vote.timestamp)}</p>}</> : voter.eligible ? <><p>Your vote weight: <strong>{count(voter.weight)}</strong></p><div className={styles.actions}><button className={styles.secondary} disabled={!!access.pending} onClick={() => { setError(''); setChoice('slash'); }}>Remove stake</button><button className={styles.secondary} disabled={!!access.pending} onClick={() => { setError(''); setChoice('dismiss'); }}>Dismiss case</button></div></> : <p>At least {count(voter.minimum)} active staked HIVE is required. Voting must be open.</p>}
  </div>}{choice && voter && <TaskDialog title="Review your vote" busy={busy} close={() => setChoice(null)}><div className={styles.form}><p>You cannot change a recorded vote.</p><dl className={styles.review}><div><dt>Tool</dt><dd>{dispute.toolId}</dd></div><div><dt>Case</dt><dd>{dispute.id}</dd></div><div><dt>Choice</dt><dd>{choice === 'slash' ? 'Remove provider stake' : 'Dismiss case'}</dd></div><div><dt>Recorded provider stake</dt><dd>{dispute.stakedAmount === null ? 'Not recorded' : count(dispute.stakedAmount) + ' HIVE'}</dd></div><div><dt>Solana wallet</dt><dd>{address}</dd></div><div><dt>Vote weight</dt><dd>{count(voter.weight)}</dd></div></dl><div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={() => setChoice(null)}>Cancel</button><button className={styles.primary} disabled={busy || !!access.pending} onClick={submit}>{busy ? 'Confirming vote…' : 'Sign and submit vote'}</button></div>{error && <p className={styles.error} role="alert">{error}</p>}</div></TaskDialog>}</>;
}

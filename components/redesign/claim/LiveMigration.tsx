'use client';
import { useEffect, useRef, useState } from 'react';
import { VersionedTransaction } from '@solana/web3.js';
import { getBase58Decoder } from '@solana/kit';
import { getAddress } from 'viem';
import { compactHive, exactHive } from '@/lib/hive-claim-format';
import styles from './claim.module.css';

type RequestTerms = { owner: string; recipient: string; amount: string; depositDeadline: string; nonce: string; solanaSignature?: string; evmSignature?: string };
type Quote = { request: RequestTerms; message: string; oldAmountRaw: string; newGrantRaw: string; expiresAt: string; reserved: false };
type Packet = { transactionBase64: string; packetId: string; lastValidBlockHeight: number };
type Status = { state: string; signature: string | null; submission?: string; deposit: Packet | null };
type SolWallet = { publicKey?: { toBase58(): string }; connect(): Promise<unknown>; signMessage(bytes: Uint8Array): Promise<{ signature: Uint8Array }>; signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction> };
type EvmWallet = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
const messages: Record<string, string> = {
  below_minimum: 'This wallet must currently hold at least 1M spendable HIVE on Solana before depositing.',
  reserve: 'Preparing your claim…',
  deposit: 'Ready to deposit.',
  confirm_deposit: 'Confirming your deposit…',
  claim: 'Sending your HIVE on Robinhood…',
  release_to_collection: 'HIVE on Robinhood sent. Finishing…',
  complete: 'Claim complete. HIVE on Robinhood sent to your wallet.',
  cancel_expired: 'The claim window expired. Cancellation is being reconciled before any refund.',
  refund_to_owner: 'The payout was cancelled. Your HIVE on Solana is being returned.',
  refunded: 'Your HIVE on Solana was refunded to the original Solana wallet.',
  cancelled_without_observed_deposit: 'This attempt was cancelled. No finalized HIVE on Solana deposit has been observed.',
  deposit_window_closed_reconcile_inflight: 'The deposit window closed. Any submitted transaction is being reconciled.',
};
async function call(action: string, input: unknown) {
  const r = await fetch('/api/token/claim/migration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, input }), cache: 'no-store', signal: AbortSignal.timeout(35000) });
  const value = await r.json(); if (!r.ok) throw Error(value.error || 'Migration request failed.'); return value;
}
function wallets() {
  const w = window as unknown as { solana?: SolWallet; solflare?: SolWallet; ethereum?: EvmWallet };
  const sol = w.solana ?? w.solflare, evm = w.ethereum;
  if (!sol?.signMessage || !sol.signTransaction || !evm) throw Error('Open this page with Solana and EVM wallet extensions installed.');
  return { sol, evm };
}
function validateQuote(q: Quote, owner: string, recipient: string, amount: string) {
  if (!q || q.reserved !== false || !/^Hive redemption authorization v5\n/.test(q.message)) throw Error('Invalid quote.');
  const t = JSON.parse(q.message.slice(q.message.indexOf('\n') + 1));
  if (q.request.owner !== owner || q.request.recipient !== recipient || q.request.amount !== amount || q.oldAmountRaw !== amount || q.request.depositDeadline !== q.expiresAt || t.owner !== owner || t.recipient !== recipient || t.oldAmountRaw !== amount || t.newGrantRaw !== q.newGrantRaw || t.nonce !== q.request.nonce || t.depositDeadline !== q.expiresAt || t.minimumSnapshotHoldingRaw !== '1000000000000000' || t.minimumCurrentHoldingRaw !== '1000000000000000' || t.destinationChain !== '4663' || t.sourceMint !== '6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS' || t.destinationToken.toLowerCase() !== '0xc65e9630d8af1ea278cbe359f78931684b4ff9f8' || !/^[1-9][0-9]{0,38}$/.test(q.newGrantRaw) || BigInt(q.newGrantRaw) > BigInt(amount) * 700000000n || BigInt(q.expiresAt) <= BigInt(Math.floor(Date.now() / 1000))) throw Error('Quote does not match your selected wallets and amount.');
}
export default function LiveMigration({ owner, amount, enabled, canStart = true }: { owner: string; amount: string | null; enabled: boolean; canStart?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null), [request, setRequest] = useState<RequestTerms | null>(null), [status, setStatus] = useState<Status | null>(null);
  const alive = useRef(true), key = `hive-migration-v5:${owner}`;
  useEffect(() => {
    alive.current = true;
    try { const saved = localStorage.getItem(key); if (saved) { const r = JSON.parse(saved); if (r.owner === owner && r.solanaSignature && r.evmSignature) setRequest(r); } } catch { /* Storage failure is surfaced before any registration. */ }
    return () => { alive.current = false; };
  }, [key, owner]);
  const assertHere = () => { if (!alive.current) throw Error('The selected holding changed.'); };
  async function run(fn: () => Promise<void>) { setBusy(true); setError(''); try { await fn(); } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Wallet request failed.'); } finally { if (alive.current) setBusy(false); } }
  async function accounts() {
    const { sol, evm } = wallets(); await sol.connect(); assertHere();
    if (sol.publicKey?.toBase58() !== owner) throw Error('Connect the Solana wallet used for this snapshot lookup.');
    const addresses = await evm.request({ method: 'eth_requestAccounts' }) as string[]; assertHere();
    if (!addresses?.[0]) throw Error('Choose your Robinhood recipient wallet.');
    return { sol, evm, recipient: getAddress(addresses[0]) };
  }
  async function checkAccounts(recipient: string) {
    const { sol, evm } = wallets();
    const list = await evm.request({ method: 'eth_accounts' }) as string[]; assertHere();
    if (sol.publicKey?.toBase58() !== owner || !list?.[0] || getAddress(list[0]) !== recipient) throw Error('Wallet changed. Reconnect the wallets shown in your quote.');
    return { sol, evm };
  }
  async function refresh(r = request) { if (!r) return; const value = await call('status', { request: r }); assertHere(); setStatus(value); }
  return <section className={styles.migration} aria-label="Wallet migration">
    {!enabled ? <p className={styles.hint}>Claims are not open yet.</p> : <>
      {canStart && !request && !quote && <button className={styles.primary} disabled={busy || !amount || !canStart} onClick={() => run(async () => { if (!amount) return; const { recipient } = await accounts(); const q = await call('quote', { owner, recipient, amount }); assertHere(); validateQuote(q, owner, recipient, amount); setQuote(q); })}>{busy ? 'Working…' : 'Connect wallets'}</button>}
      {canStart && quote && !request && <><dl className={styles.details}><div><dt>HIVE on Solana to deposit</dt><dd>{compactHive(quote.oldAmountRaw, 9)}</dd></div><div><dt>HIVE on Robinhood to receive</dt><dd>{compactHive(quote.newGrantRaw, 18)}</dd></div><div><dt>Robinhood recipient</dt><dd>{quote.request.recipient}</dd></div><div><dt>Deposit before</dt><dd>{new Date(Number(quote.expiresAt) * 1000).toLocaleString()}</dd></div></dl><details className={styles.exact}><summary>Exact amounts</summary><p>{exactHive(quote.oldAmountRaw, 9)} HIVE on Solana → {exactHive(quote.newGrantRaw, 18)} HIVE on Robinhood</p></details><p>One deposit per wallet; unused allowance is forfeited. Network fees apply.</p><button className={styles.primary} disabled={busy} onClick={() => run(async () => {
        if (!canStart) throw Error('Claims are not open.');
        validateQuote(quote, owner, quote.request.recipient, amount!);
        const { sol } = await checkAccounts(quote.request.recipient);
        const signed = await sol.signMessage(new TextEncoder().encode(quote.message)); assertHere();
        const { evm } = await checkAccounts(quote.request.recipient);
        const hex = '0x' + Array.from(new TextEncoder().encode(quote.message), b => b.toString(16).padStart(2, '0')).join('');
        const evmSignature = await evm.request({ method: 'personal_sign', params: [hex, quote.request.recipient] }); assertHere();
        await checkAccounts(quote.request.recipient);
        if (typeof evmSignature !== 'string') throw Error('Invalid wallet signature.');
        const r = { ...quote.request, solanaSignature: getBase58Decoder().decode(signed.signature), evmSignature };
        localStorage.setItem(key, JSON.stringify(r)); setRequest(r);
        await call('register', r); assertHere(); await refresh(r);
      })}>Confirm with both wallets</button></>}
      {request && <><p>Claim saved in this browser.</p><p>Recipient: <code className={styles.address}>{request.recipient}</code></p><button className={styles.secondary} disabled={busy} onClick={() => run(() => refresh())}>Refresh claim status</button>{!status && <button className={styles.secondary} disabled={busy} onClick={() => run(async () => { await call('register', request); assertHere(); await refresh(); })}>Resume claim</button>}</>}
      {status && <div role="status"><p>{messages[status.state] ?? 'Checking your claim…'}</p>{status.signature && <p>Solana transaction: <code className={styles.address}>{status.signature}</code></p>}{status.submission === 'pending_or_unknown' && <p>Deposit pending. Do not submit again.</p>}{status.submission === 'failed' && <p>Deposit failed. Contact support.</p>}</div>}
      {canStart && status?.deposit && !status.signature && <button className={styles.primary} disabled={busy} onClick={() => run(async () => {
        const packet = status.deposit!, { sol } = wallets(); await sol.connect(); assertHere();
        if (sol.publicKey?.toBase58() !== owner) throw Error('Connect the original Solana wallet.');
        const tx = VersionedTransaction.deserialize(Uint8Array.from(atob(packet.transactionBase64), c => c.charCodeAt(0)));
        if (tx.message.staticAccountKeys[0].toBase58() !== owner) throw Error('Deposit payer does not match.');
        const original = Array.from(tx.message.serialize()).join(',');
        const signed = await sol.signTransaction(tx); assertHere();
        if (Array.from(signed.message.serialize()).join(',') !== original) throw Error('Wallet changed the deposit.');
        setStatus({ ...status, deposit: null });
        const transactionBase64 = btoa(String.fromCharCode(...signed.serialize()));
        await call('deposit', { request, packetId: packet.packetId, transactionBase64 }); assertHere(); await refresh();
      })}>Deposit & claim</button>}
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}

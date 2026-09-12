import { record, text } from '../task/model';
import type { WalletNetwork } from '@/lib/agent-wallet-message';
export type SavedWallet = { address: string | null; verifiedAt: string | null };
export type WalletSettings = { agentId: string; name: string; avatarSeed: string; revision: number; robinhood: SavedWallet; solana: SavedWallet };
export const validAgentId = (v: string) => /^[a-f0-9]{24}$/i.test(v);
export function readWallets(value: unknown, id: string): WalletSettings {
  const d = record(value);
  if (d.agentId !== id || !validAgentId(id) || !text(d.name) || !Number.isSafeInteger(d.revision) || Number(d.revision) < 0) throw Error('Wallet settings did not match this agent. Refresh and try again.');
  const wallet = (v: unknown): SavedWallet => {
    const w = record(v);
    if (w.address !== null && (typeof w.address !== 'string' || w.address.length > 200)) throw Error('The saved wallet could not be read.');
    if (w.verifiedAt !== null && (typeof w.verifiedAt !== 'string' || !Number.isFinite(Date.parse(w.verifiedAt)))) throw Error('Wallet verification could not be read.');
    return { address: w.address as string | null, verifiedAt: w.address ? w.verifiedAt as string | null : null };
  };
  return { agentId: id, name: text(d.name), avatarSeed: text(d.avatarSeed), revision: Number(d.revision), robinhood: wallet(d.robinhood), solana: wallet(d.solana) };
}
export type PendingWallet = { network: WalletNetwork; address: string | null; revision: number };
export function readPending(value: string | null): PendingWallet | null {
  if (!value) return null;
  try { const d = JSON.parse(value); if (!['robinhood', 'solana'].includes(d.network) || !Number.isSafeInteger(d.revision) || d.revision < 0 || (d.address !== null && (typeof d.address !== 'string' || d.address.length > 100))) throw Error(); return { network: d.network, address: d.address, revision: d.revision }; }
  catch { throw Error('The saved wallet request could not be read. Check your saved wallets before trying again.'); }
}
export function confirmed(settings: WalletSettings, pending: PendingWallet) {
  const wallet = settings[pending.network];
  return settings.revision > pending.revision && wallet.address === pending.address && (pending.address === null || !!wallet.verifiedAt);
}

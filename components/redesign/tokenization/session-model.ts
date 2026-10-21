import type { LaunchSession } from '@/lib/agent-tokenization/session';
import type { SolanaReview } from '@/lib/agent-tokenization/solana-journal';
import type { LaunchPreview, LaunchMode } from '@/lib/agent-tokenization/types';
import { isPlatform, type AgentToken, type PlatformId } from '@/lib/agent-tokenization/platforms';
import type { PlatformOption } from './PlatformSelection';

export interface TransactionReview extends SolanaReview { id: string; platform: PlatformId; stage: 'setup' | 'launch'; signer: string; mode: LaunchMode }
export interface SessionDetails {
  preview: LaunchPreview; profileRevision: string; tokens: AgentToken[]; session: LaunchSession | null; review: TransactionReview | null;
  wallets: { evm: string | null; solana: string | null }; readOnly: boolean;
  deployers: { evm: { address: string; available: boolean }; solana: { address: string; available: boolean } } | null;
  options: PlatformOption[];
}
export function readSessionResult(value: unknown, agentId: string): { session: LaunchSession; review: TransactionReview | null } {
  if (!value || typeof value !== 'object') throw Error('Launch status could not be read.');
  const data = value as { session?: LaunchSession; review?: TransactionReview | null }, s = data.session;
  if (!s || s.agentId !== agentId || typeof s.id !== 'string' || !Number.isSafeInteger(s.revision) || !Array.isArray(s.targets) || !s.targets.length || s.targets.length > 3
    || new Set(s.targets.map(t => t.terms.platform)).size !== s.targets.length || s.targets.some(t => !isPlatform(t.terms.platform)
      || !['queued', 'preparing', 'awaiting-signature', 'submitted', 'confirming', 'confirmed', 'failed', 'skipped', 'blocked'].includes(t.phase)
      || !/^\d+$/.test(t.terms.purchase))) throw Error('Launch status could not be read.');
  const r = data.review;
  if (r && (!isPlatform(r.platform) || r.platform === 'pons' || typeof r.transaction !== 'string' || r.transaction.length > 1700
    || !/^[a-f0-9]{64}$/.test(r.digest) || !/^\d+$/.test(r.maximumDebit) || !/^\d+$/.test(r.networkFee) || !Number.isFinite(Date.parse(r.expiresAt))
    || !s.targets.some(t => t.terms.platform === r.platform && t.terms.signer === r.signer && t.terms.mode === r.mode))) throw Error('Transaction review could not be read.');
  return { session: s, review: r || null };
}

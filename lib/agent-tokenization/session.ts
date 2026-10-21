import { createHash } from 'node:crypto';
import type { AgentTokenMetadata, LaunchMode, LaunchRole } from './types';
import { platforms, isPlatform, readAgentToken, tokenKey, purchaseLamports, type AgentToken, type PlatformId } from './platforms';
import { HIVE_LAUNCH_WALLET, feeRecipient, normalizeSymbol, purchaseWei, validAddress } from './policy';
import { validSolanaAddress, profileUrl } from './platforms';

export const HIVE_SOLANA_FEE_WALLET = '8CrDTtkdDr54LsB9vQi1PZzVNmAA1KHkcts2EAK9W11z';
export const BAGS_STANDARD_CONFIG = 'fa29606e-5e48-4c37-827f-4b03d58ee23d';
export type TargetPhase = 'queued' | 'preparing' | 'awaiting-signature' | 'submitted' | 'confirming' | 'confirmed' | 'failed' | 'skipped' | 'blocked';
export interface TargetTerms {
  platform: PlatformId;
  mode: LaunchMode;
  signer: string;
  recipient: string;
  purchase: string; // Raw wei/lamports, never floating-point.
  policy: 'pons-3-v2' | 'bags-standard-v1' | 'pump-sol-v1';
}
export interface SessionTarget {
  terms: TargetTerms;
  phase: TargetPhase;
  /** References the platform journal. Never copy encrypted transactions into a session. */
  intentId?: string;
  token?: AgentToken;
  error?: string;
  /** Freeze metadata for an intent; subsequent edits apply to unstarted targets. */
  metadata?: AgentTokenMetadata;
  replacementSetup?: boolean;
}
export interface SessionApproval {
  digest: string;
  expiresAt: string;
  limits: Partial<Record<PlatformId, string>>;
  reserved: Record<string, { platform: PlatformId; amount: string }>;
}
export interface LaunchSession {
  id: string;
  agentId: string;
  role: LaunchRole;
  metadata: AgentTokenMetadata;
  profileRevision: string;
  digest: string;
  targets: SessionTarget[];
  revision: number;
  paused: boolean;
  createdAt: string;
  approval?: SessionApproval;
  estimate?: { digest: string; expiresAt: string; limits: Partial<Record<PlatformId, string>> };
  editing?: boolean;
}
export class SessionConflict extends Error {}

export function reviewSession(input: {
  id: string; agentId: string; role: LaunchRole; metadata: AgentTokenMetadata; profileRevision: string;
  choices: { platform: PlatformId; mode: LaunchMode; signer: string; purchase: string }[];
  verifiedOwnerEvm: string | null; verifiedOwnerSolana: string | null;
  allowEmpty?: boolean;
}, now = new Date()): LaunchSession {
  if (!/^[a-f0-9-]{36}$/.test(input.id) || !/^[a-f0-9]{24}$/.test(input.agentId)
    || !/^[a-f0-9]{64}$/.test(input.profileRevision) || !['owner', 'admin'].includes(input.role)) throw new SessionConflict('Refresh the agent details.');
  if (!Array.isArray(input.choices) || (!input.allowEmpty && input.choices.length < 1) || input.choices.length > 3
    || new Set(input.choices.map(c => c.platform)).size !== input.choices.length) throw new SessionConflict('Select each platform at most once.');
  const metadata = { ...input.metadata, symbol: normalizeSymbol(input.metadata.symbol),
    socials: { website: profileUrl(input.agentId), twitter: '' as const, telegram: '' as const } };
  const byteLength = (value: string) => new TextEncoder().encode(value).length;
  if (input.choices.some(c => c.platform !== 'pons') && metadata.symbol.length > 10) throw new SessionConflict('Use a ticker with at most 10 characters for Solana.');
  if (!metadata.name.trim() || byteLength(metadata.name) > (input.choices.some(c => c.platform !== 'pons') ? 32 : 64)
    || !metadata.description.trim() || byteLength(metadata.description) > 1000) throw new SessionConflict('Shorten the token name or description for the selected platforms.');
  const targets: SessionTarget[] = input.choices.map((choice): SessionTarget => {
    if (!isPlatform(choice.platform) || !['managed', 'connected'].includes(choice.mode)) throw new SessionConflict('Invalid launch selection.');
    if (input.role !== 'admin' && choice.mode === 'managed') throw new SessionConflict('Only admins can use Hive deployer.');
    const evm = choice.platform === 'pons';
    if (!(evm ? validAddress(choice.signer) : validSolanaAddress(choice.signer))) throw new SessionConflict('Select a valid launch wallet.');
    const signer = evm ? choice.signer.toLowerCase() : choice.signer;
    if (choice.mode === 'managed' && signer !== (evm ? HIVE_LAUNCH_WALLET.toLowerCase() : HIVE_SOLANA_FEE_WALLET)) {
      throw new SessionConflict('The Hive deployer changed. Refresh the launch review.');
    }
    const owner = evm ? input.verifiedOwnerEvm?.toLowerCase() : input.verifiedOwnerSolana;
    if (input.role === 'owner' && signer !== owner) throw new SessionConflict('Select the verified agent wallet.');
    const recipient = evm ? feeRecipient(input.role, owner, !!owner) : HIVE_SOLANA_FEE_WALLET;
    if (!recipient) throw new SessionConflict('Verify the agent wallet first.');
    return { phase: 'queued', terms: { platform: choice.platform, mode: choice.mode, signer, recipient,
      purchase: (evm ? purchaseWei(choice.purchase) : purchaseLamports(choice.purchase)).toString(),
      policy: evm ? 'pons-3-v2' : choice.platform === 'bags' ? 'bags-standard-v1' : 'pump-sol-v1' } };
  }).sort((a, b) => platforms[a.terms.platform].order - platforms[b.terms.platform].order);
  const solana = targets.filter(t => t.terms.platform !== 'pons');
  if (solana.length === 2 && (solana[0].terms.signer !== solana[1].terms.signer || solana[0].terms.mode !== solana[1].terms.mode)) {
    throw new SessionConflict('Use one Solana wallet for this launch.');
  }
  // Explicitly bind recipients, policy, selection, actor, immutable metadata and exact opening purchases.
  const digest = createHash('sha256').update(JSON.stringify({ version: 1, agentId: input.agentId, role: input.role,
    metadata, profileRevision: input.profileRevision, terms: targets.map(t => t.terms) })).digest('hex');
  return { id: input.id, agentId: input.agentId, role: input.role, metadata, profileRevision: input.profileRevision,
    digest, targets, paused: false, revision: 0, createdAt: now.toISOString() };
}

export function nextTarget(session: LaunchSession): SessionTarget | null {
  if (session.paused) return null;
  // No later submission while a prior result is unresolved, including errors.
  return session.targets.find(t => !['confirmed', 'skipped'].includes(t.phase)) || null;
}
export const sessionComplete = (session: LaunchSession) => session.targets.every(t => ['confirmed', 'skipped'].includes(t.phase));

const transitions: Record<TargetPhase, readonly TargetPhase[]> = {
  queued: ['preparing', 'skipped', 'blocked'],
  preparing: ['awaiting-signature', 'submitted', 'confirming', 'confirmed', 'failed', 'blocked'],
  'awaiting-signature': ['submitted', 'confirming', 'confirmed', 'failed', 'blocked'],
  submitted: ['awaiting-signature', 'confirming', 'confirmed', 'failed', 'blocked'],
  confirming: ['awaiting-signature', 'confirmed', 'failed', 'blocked'],
  confirmed: [], failed: ['queued', 'skipped'], skipped: [], blocked: ['awaiting-signature', 'submitted', 'confirming', 'confirmed', 'failed'],
};
export interface TargetResult { phase: TargetPhase; intentId?: string; token?: AgentToken; error?: string }

/** Internal adapter results only. HTTP callers must never supply a phase or token association. */
export function transitionTarget(session: LaunchSession, platform: PlatformId, result: TargetResult): LaunchSession {
  const target = session.targets.find(t => t.terms.platform === platform);
  if (!target || !transitions[target.phase].includes(result.phase)) throw new SessionConflict('The launch changed. Refresh its status.');
  const preceding = session.targets.slice(0, session.targets.indexOf(target));
  if (result.phase === 'preparing' && (session.paused || preceding.some(t => !['confirmed', 'skipped'].includes(t.phase)))) {
    throw new SessionConflict('Resolve the earlier launch before continuing.');
  }
  if (target.intentId && result.intentId && target.intentId !== result.intentId && target.phase !== 'failed') {
    throw new SessionConflict('An unresolved launch cannot be replaced.');
  }
  let token: AgentToken | undefined;
  if (result.phase === 'confirmed') {
    token = readAgentToken(result.token) || undefined;
    if (!token || token.platform !== platform || session.targets.some(t => t.token && tokenKey(t.token) === tokenKey(token!))) {
      throw new SessionConflict('The token does not match the selected platform.');
    }
  } else if (result.token) throw new SessionConflict('Only a verified launch can publish a token.');
  return { ...session, revision: session.revision + 1,
    paused: session.paused || result.phase === 'failed' || result.phase === 'blocked',
    targets: session.targets.map(t => t !== target ? t : { ...t, phase: result.phase,
      ...(result.intentId && !t.metadata ? { metadata: session.metadata } : {}),
      ...(result.phase === 'queued' && platform === 'pons' ? { intentId: undefined } : {}),
      ...(result.intentId ? { intentId: result.intentId } : {}), token,
      error: result.error?.slice(0, 240) }) };
}

/** Failures require explicit continue; unknown/blocked transactions cannot be skipped. */
export function continueSession(session: LaunchSession, failed?: { platform: PlatformId; action: 'retry' | 'skip' }): LaunchSession {
  if (!session.paused) throw new SessionConflict('This launch is already running.');
  if (session.targets.some(t => ['blocked', 'preparing', 'awaiting-signature', 'submitted', 'confirming'].includes(t.phase))) {
    throw new SessionConflict('Check the unresolved launch before continuing.');
  }
  let next = session;
  if (failed) {
    const target = session.targets.find(t => t.terms.platform === failed.platform);
    if (target?.phase !== 'failed') throw new SessionConflict('Only a verified failure can be retried or skipped.');
    next = transitionTarget(session, failed.platform, { phase: failed.action === 'retry' ? 'queued' : 'skipped' });
  }
  if (next.targets.some(t => t.phase === 'failed')) throw new SessionConflict('Choose retry or skip for the failed launch.');
  return { ...next, paused: false, revision: session.revision + 1 };
}

/** Amounts are never combined across currencies. Adapters add their own reviewed rent/network costs. */
export function sessionPurchases(session: LaunchSession): { SOL: string; ETH: string } {
  const totals = { SOL: 0n, ETH: 0n };
  for (const target of session.targets) totals[platforms[target.terms.platform].currency] += BigInt(target.terms.purchase);
  return { SOL: totals.SOL.toString(), ETH: totals.ETH.toString() };
}

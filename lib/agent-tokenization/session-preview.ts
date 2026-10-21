import type { Db } from 'mongodb';
import type { LaunchPreview } from './types';
import { agentTokenCatalog } from './catalog';
import { platforms, platformIds, validSolanaAddress } from './platforms';
import { profileRevision } from './metadata';
import { launchesEnabled } from './release';
import { managedDeployerStatus } from './managed-signer';
import { solanaDeployerStatus } from './solana-signer';
import { SessionStore } from './session-store';
import { validAddress } from './policy';

const verified = (date: unknown) => (date instanceof Date || typeof date === 'string') && Number.isFinite(new Date(date).getTime());
export function verifiedLaunchWallets(agent: Record<string, unknown>) {
  return {
    evm: verified(agent.walletAddressVerifiedAt) && validAddress(agent.walletAddress) ? agent.walletAddress as string : null,
    solana: verified(agent.solanaAddressVerifiedAt) && validSolanaAddress(agent.solanaAddress) ? agent.solanaAddress as string : null,
  };
}
export function solanaLaunchesEnabled(platform: 'bags' | 'pump') {
  return process.env.AGENT_MULTI_PLATFORM_LAUNCHES_ENABLED === 'true'
    && process.env.AGENT_MULTI_PLATFORM_RECOVERY_ENABLED === 'true' && !!process.env.CRON_SECRET
    && /^[a-f0-9]{64}$/i.test(process.env.TOKENIZATION_JOURNAL_KEY || '')
    && !!process.env.CLOUDINARY_CLOUD_NAME && !!process.env.CLOUDINARY_API_KEY && !!process.env.CLOUDINARY_API_SECRET
    && (platform !== 'bags' || !!process.env.BAGS_AGENT_API_KEY);
}
export async function sessionPreview(db: Db, agent: Record<string, unknown>, preview: LaunchPreview) {
  const tokens = agentTokenCatalog(agent), wallets = verifiedLaunchWallets(agent);
  const record = await new SessionStore(db).current(preview.agentId);
  const legacy = await db.collection<{ _id: string; agentId: string; active: boolean; phase: string }>('pons_launch_intents').findOne({ agentId: preview.agentId, active: true, phase: { $ne: 'confirmed' } });
  return { preview, profileRevision: profileRevision(agent), wallets, tokens,
    session: record?.session || null,
    deployers: preview.role === 'admin' ? { evm: managedDeployerStatus(), solana: solanaDeployerStatus() } : null,
    options: platformIds.map(platform => {
      const token = tokens.find(t => t.platform === platform);
      const legacyPending = platform === 'pons' && !!legacy && !record?.session.targets.some(t => t.intentId === legacy._id);
      const legacyBags = platform === 'bags' && (agent.tokenMintAddress || agent.isTokenized || ['launching', 'launched'].includes(String(agent.tokenLaunchStatus)));
      const enabled = platform === 'pons' ? launchesEnabled() : solanaLaunchesEnabled(platform);
      const ownerReady = preview.role === 'admin' || !!wallets[platforms[platform].network === 'solana' ? 'solana' : 'evm'];
      return { platform, available: enabled && ownerReady && !legacyBags && agent.status === 'active',
        purchaseAvailable: platform !== 'pump' || validSolanaAddress(process.env.PUMP_LAUNCH_LOOKUP_TABLE), ...(token ? { token } : {}),
        ...(legacyPending ? { pending: true } : {}),
        reason: legacyBags && !token ? 'Existing launch needs review' : !ownerReady ? 'Verify your wallet in settings' : !enabled ? 'Unavailable' : undefined };
    }) };
}

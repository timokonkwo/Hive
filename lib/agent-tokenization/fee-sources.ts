import type { Db } from 'mongodb';
import { claimableLamports, type AgentFeeClient } from '../agent-fees';
import { createAgentBagsClient } from '../bags-agent';
import { HiveBagsDeployerFees } from './bags-fees';
import { PumpFeeClient } from './pump-fees';
import { launchConnection } from './solana-runtime';
import { solanaFeeWalletStatus } from './solana-signer';

export type FeeSource = 'bags-creator' | 'bags-deployer' | 'pump';
export function feeClient(db: Db, source: FeeSource): AgentFeeClient {
  if (!solanaFeeWalletStatus().available) throw Error('Solana fee wallet is not configured.');
  if (source === 'pump') return new PumpFeeClient(db, launchConnection());
  if (source === 'bags-deployer') return new HiveBagsDeployerFees(launchConnection());
  const client = createAgentBagsClient();
  if (!client) throw Error('Bags fee collection is not configured.');
  return client;
}

export async function additionalFeeBalances(db: Db) {
  return Promise.all((['bags-deployer', 'pump'] as const).map(async source => {
    try {
      const positions = await feeClient(db, source).getClaimablePositions();
      const lamports = positions.reduce((sum, row) => sum + claimableLamports(row), 0n);
      return { source, totalClaimable: Number(lamports) / 1e9, claimableLamports: lamports.toString(), error: null };
    } catch {
      return { source, totalClaimable: null, claimableLamports: null, error: 'Fee balance is unavailable. Refresh to try again.' };
    }
  }));
}

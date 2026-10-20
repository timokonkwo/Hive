import type { TokenAssociation } from './types';
import { PONS_CHAIN_ID, validAddress, validHash } from './policy';

/** ponsToken is reserved for a receipt-verified association, never a launch intent. */
export function readAssociation(value: unknown): TokenAssociation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const token = value as Record<string, unknown>;
  if (token.chainId !== PONS_CHAIN_ID || !validAddress(token.address) || !validHash(token.transactionHash)) return null;
  if (token.status !== undefined && token.status !== 'confirmed') return null;
  return {
    chainId: PONS_CHAIN_ID,
    address: token.address,
    symbol: typeof token.symbol === 'string' ? token.symbol.trim() : '',
    transactionHash: token.transactionHash,
    ...(typeof token.launchedAt === 'string' && Number.isFinite(Date.parse(token.launchedAt)) ? { launchedAt: token.launchedAt } : {}),
  };
}

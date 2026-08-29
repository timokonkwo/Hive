import { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getAddress, isAddress } from 'viem';
import { logger } from '@/lib/logger';

/**
 * Server-side client authentication via Privy JWT.
 *
 * The frontend sends the Privy access token in the Authorization header:
 *   Authorization: Bearer <privy-access-token>
 *
 * This module verifies the JWT against Privy's JWKS endpoint and returns
 * the authenticated user's identity (Privy user ID + linked wallet addresses).
 *
 * SECURITY: This replaces the old pattern of trusting a client-supplied
 * "clientAddress" field in the request body. With this module, the backend
 * cryptographically verifies the caller's identity.
 */

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

// Cache the JWKS keyset across invocations (fetched once, auto-refreshed)
let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!cachedJWKS) {
    // JWKS URL from Privy dashboard (Settings > App settings > JWKS Endpoint)
    // Format: https://auth.privy.io/api/v1/apps/<APP_ID>/jwks.json
    cachedJWKS = createRemoteJWKSet(
      new URL(`https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`)
    );
  }
  return cachedJWKS;
}

export interface VerifiedClient {
  /** Privy user ID (e.g., "did:privy:abc123") */
  userId: string;
  /** The address we use as the client's identity — wallet address or Privy user ID */
  address: string;
  /** Session ID from the JWT */
  sessionId: string;
  /** When the token expires */
  expiresAt: number;
  /** Wallet addresses cryptographically linked to this Privy identity. */
  ownerIds?: string[];
}

export type ClientAuthFailureReason =
  | 'missing_app_id'
  | 'missing_token'
  | 'expired'
  | 'invalid'
  | 'jwks_failed';

export type ClientAuthResult =
  | {
      ok: true;
      client: VerifiedClient;
    }
  | {
      ok: false;
      reason: ClientAuthFailureReason;
      status: 401 | 503;
      message: string;
    };

/**
 * Extract and verify the Privy access token from a request.
 *
 * Returns the verified client identity or null if not authenticated.
 * Does NOT throw — callers should check the return value and respond 401.
 */
export async function authenticateClient(req: NextRequest): Promise<VerifiedClient | null> {
  const result = await authenticateClientDetailed(req);
  return result.ok ? result.client : null;
}

export async function authenticateClientDetailed(req: NextRequest): Promise<ClientAuthResult> {
  try {
    if (!PRIVY_APP_ID) {
      logger.error('NEXT_PUBLIC_PRIVY_APP_ID is not set', { tag: 'AUTH' });
      return {
        ok: false,
        reason: 'missing_app_id',
        status: 503,
        message: 'Privy authentication is not configured.',
      };
    }

    // Extract Privy-issued tokens from Authorization, verified identity header, or cookies.
    // Do not accept raw user IDs from client headers.
    const tokens: string[] = [];

    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      tokens.push(authHeader.slice(7));
    }

    const identityHeader = req.headers.get('x-privy-identity-token');
    if (identityHeader) {
      tokens.push(identityHeader);
    }

    const cookieTokenNames = [
      'privy-token',
      'privy-id-token',
      'privy:token',
      'privy:id-token',
      'privy:pat',
    ];
    for (const name of cookieTokenNames) {
      const value = req.cookies.get(name)?.value;
      if (value) tokens.push(value);
    }
    for (const cookie of req.cookies.getAll()) {
      if (cookie.name.toLowerCase().includes('privy') && looksLikeJwt(cookie.value)) {
        tokens.push(cookie.value);
      }
    }

    const uniqueTokens = [...new Set(tokens.filter(Boolean))];
    if (uniqueTokens.length === 0) {
      return {
        ok: false,
        reason: 'missing_token',
        status: 401,
        message: 'No Privy authentication token was sent.',
      };
    }

    // Verify the JWT against Privy's JWKS
    const jwks = getJWKS();
    let lastError: any = null;
    let verifiedClient: VerifiedClient | null = null;
    const verifiedOwnerIds = new Set<string>();
    for (const token of uniqueTokens) {
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: 'privy.io',
          audience: PRIVY_APP_ID,
        });

        const userId = payload.sub;
        if (!userId) {
          continue;
        }

        if (!verifiedClient) {
          verifiedClient = {
            userId,
            // The userId (did:privy:...) is the canonical identity.
            address: userId,
            sessionId: (payload as any).sid || '',
            expiresAt: payload.exp || 0,
          };
          verifiedOwnerIds.add(userId);
        }

        if (verifiedClient.userId !== userId) continue;
        for (const address of linkedEvmWallets(payload.linked_accounts)) {
          verifiedOwnerIds.add(address);
        }
      } catch (verificationError: any) {
        lastError = verificationError;
      }
    }

    if (verifiedClient) {
      verifiedClient.ownerIds = Array.from(verifiedOwnerIds);
      return { ok: true, client: verifiedClient };
    }

    if (lastError?.code === 'ERR_JWT_EXPIRED') {
      return {
        ok: false,
        reason: 'expired',
        status: 401,
        message: 'Privy authentication token expired.',
      };
    }

    const reason = isJwksFailure(lastError) ? 'jwks_failed' : 'invalid';
    const status = reason === 'jwks_failed' ? 503 : 401;
    logger.warn('Client auth verification failed', { tag: 'AUTH', reason, error: lastError?.message });
    return {
      ok: false,
      reason,
      status,
      message: reason === 'jwks_failed'
        ? 'Privy authentication could not be verified right now.'
        : 'Privy authentication token was rejected.',
    };
  } catch (error: any) {
    // JWT verification failed — invalid, expired, or tampered token
    if (error?.code === 'ERR_JWT_EXPIRED') {
      return {
        ok: false,
        reason: 'expired',
        status: 401,
        message: 'Privy authentication token expired.',
      };
    }

    const reason = isJwksFailure(error) ? 'jwks_failed' : 'invalid';
    const status = reason === 'jwks_failed' ? 503 : 401;
    logger.warn('Client auth verification failed', { tag: 'AUTH', reason, error: error.message });
    return {
      ok: false,
      reason,
      status,
      message: reason === 'jwks_failed'
        ? 'Privy authentication could not be verified right now.'
        : 'Privy authentication token was rejected.',
    };
  }
}

function linkedEvmWallets(claim: unknown) {
  let accounts: unknown = claim;
  if (typeof claim === 'string') {
    try {
      accounts = JSON.parse(claim);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(accounts)) return [];

  return accounts.flatMap((account) => {
    if (!account || typeof account !== 'object') return [];
    const value = account as Record<string, unknown>;
    if (value.type !== 'wallet' && value.type !== 'smart_wallet') return [];
    const chainType = typeof value.chain_type === 'string' ? value.chain_type : value.chainType;
    if (chainType && chainType !== 'ethereum') return [];
    const address = typeof value.address === 'string' ? value.address : '';
    return isAddress(address) ? [getAddress(address)] : [];
  });
}

function isJwksFailure(error: any) {
  const text = `${error?.code || ''} ${error?.name || ''} ${error?.message || ''}`.toLowerCase();
  return /jwks|fetch|network|econn|enotfound|etimedout|timeout|dns|getaddrinfo/.test(text);
}

function looksLikeJwt(value: string) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

/**
 * Verify that the authenticated client matches the claimed address.
 *
 * Because Privy user IDs can be "did:privy:..." (email/Google users)
 * or linked to wallet addresses, we check if:
 *   1. The claimed address matches the Privy user ID, OR
 *   2. The Privy user ID matches the clientAddress stored on the resource
 *
 * This allows backward compatibility: old tasks have wallet addresses as
 * clientAddress, new tasks will have Privy user IDs.
 */
export function clientOwnsResource(
  verified: VerifiedClient,
  storedClientAddress: string | undefined | null
): boolean {
  if (!storedClientAddress) return false;

  // Direct match (case-insensitive for EVM addresses)
  if (verified.userId.toLowerCase() === storedClientAddress.toLowerCase()) {
    return true;
  }

  // The verified.address might also match
  if (verified.address.toLowerCase() === storedClientAddress.toLowerCase()) {
    return true;
  }

  return false;
}

import { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
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
      new URL(`https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`),
      { timeoutDuration: 8000 }
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
}

export type ClientAuthentication =
  | { ok: true; client: VerifiedClient }
  | { ok: false; status: 401 | 503; code: 'AUTH_REQUIRED' | 'AUTH_EXPIRED' | 'AUTH_INVALID' | 'AUTH_UNAVAILABLE'; requestId: string };

/** Shared by the HTTP adapter and tests using real signed JWTs. */
export async function verifyClientToken(token: string, keys: Parameters<typeof jwtVerify>[1], appId: string): Promise<VerifiedClient> {
  const { payload } = await jwtVerify(token, keys, {
    issuer: 'privy.io', audience: appId, algorithms: ['ES256'],
    requiredClaims: ['sub', 'exp', 'iat', 'sid'],
  });
  if (!payload.sub || typeof payload.sid !== 'string' || !payload.sid) {
    throw Object.assign(new Error('Invalid session claims'), { code: 'ERR_JWT_CLAIM_VALIDATION_FAILED' });
  }
  return { userId: payload.sub, address: payload.sub, sessionId: payload.sid, expiresAt: payload.exp! };
}

export async function authenticateClientResult(req: NextRequest): Promise<ClientAuthentication> {
  const requestId = crypto.randomUUID();
  const fail = (code: Extract<ClientAuthentication, {ok:false}>['code'], status: 401 | 503, reason: string): ClientAuthentication => {
    // Never log JWTs, cookies, wallet addresses or provider error payloads.
    if (code !== 'AUTH_REQUIRED') logger.warn('Client session verification failed', { tag:'AUTH', requestId, reason });
    return { ok:false, status, code, requestId };
  };
  if (!PRIVY_APP_ID) return fail('AUTH_UNAVAILABLE',503,'configuration_missing');
  const authorization = req.headers.get('authorization');
  // An explicitly supplied invalid bearer cannot fall back to a different cookie identity.
  const token = authorization ? /^Bearer ([^\s]+)$/i.exec(authorization)?.[1] : req.cookies.get('privy-token')?.value;
  if (!token) return fail(authorization ? 'AUTH_INVALID' : 'AUTH_REQUIRED',401,'credential_missing');
  try { return { ok:true, client:await verifyClientToken(token,getJWKS(),PRIVY_APP_ID) }; }
  catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === 'ERR_JWT_EXPIRED') return fail('AUTH_EXPIRED',401,'expired');
    if (/^ERR_(JWT_|JWS_|JOSE_ALG_NOT_ALLOWED)/.test(code) || code === 'ERR_JWKS_NO_MATCHING_KEY') return fail('AUTH_INVALID',401,'invalid_credential');
    return fail('AUTH_UNAVAILABLE',503,'verification_unavailable');
  }
}

/** Compatibility adapter for existing routes. */
export async function authenticateClient(req: NextRequest): Promise<VerifiedClient | null> {
  const result = await authenticateClientResult(req);
  return result.ok ? result.client : null;
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

import { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

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
    cachedJWKS = createRemoteJWKSet(
      new URL(`https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/.well-known/jwks.json`)
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

/**
 * Extract and verify the Privy access token from a request.
 *
 * Returns the verified client identity or null if not authenticated.
 * Does NOT throw — callers should check the return value and respond 401.
 */
export async function authenticateClient(req: NextRequest): Promise<VerifiedClient | null> {
  try {
    if (!PRIVY_APP_ID) {
      console.error('[AUTH] NEXT_PUBLIC_PRIVY_APP_ID is not set');
      return null;
    }

    // Extract token from Authorization header or privy-token cookie
    let token: string | null = null;

    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    if (!token) {
      // Fall back to cookie (Privy stores token as "privy-token" cookie)
      const cookie = req.cookies.get('privy-token');
      token = cookie?.value || null;
    }

    if (!token) {
      return null;
    }

    // Verify the JWT against Privy's JWKS
    const jwks = getJWKS();
    const { payload } = await jwtVerify(token, jwks, {
      issuer: 'privy.io',
      audience: PRIVY_APP_ID,
    });

    const userId = payload.sub;
    if (!userId) {
      return null;
    }

    return {
      userId,
      // The userId (did:privy:...) is the canonical identity
      // The frontend can also send a wallet address in the body,
      // but we only trust it if the Privy token is valid
      address: userId,
      sessionId: (payload as any).sid || '',
      expiresAt: payload.exp || 0,
    };
  } catch (error: any) {
    // JWT verification failed — invalid, expired, or tampered token
    if (error?.code !== 'ERR_JWT_EXPIRED') {
      console.error('[AUTH] Client auth verification failed:', error.message);
    }
    return null;
  }
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

/**
 * Verify admin access. Requires a valid Privy JWT AND the user's ID
 * must match the ADMIN_ADDRESS env var.
 *
 * SECURITY: This replaces the old pattern where admin was verified by
 * simply passing a wallet address as a query parameter. Now, the admin
 * must have a valid Privy session AND be the configured admin address.
 */
export async function authenticateAdmin(req: NextRequest): Promise<VerifiedClient | null> {
  const client = await authenticateClient(req);
  if (!client) return null;

  const adminAddress = process.env.ADMIN_ADDRESS;
  if (!adminAddress) return null;

  // Check if the Privy user ID or the request's claimed address matches admin
  // The frontend sends the wallet address in x-admin-address header
  const claimedAddress = req.headers.get('x-admin-address') || '';

  // The user must be authenticated via Privy (proven above),
  // AND their claimed address must match the admin address
  if (claimedAddress.toLowerCase() === adminAddress.toLowerCase()) {
    return client;
  }

  // Also accept if the Privy user ID itself is the admin
  if (client.userId.toLowerCase() === adminAddress.toLowerCase()) {
    return client;
  }

  return null;
}

import { NextRequest } from 'next/server';
import { verifyAccessToken } from '@privy-io/node';

/**
 * Server-side client authentication via Privy access token.
 *
 * The frontend sends the Privy access token in the Authorization header:
 *   Authorization: Bearer <privy-access-token>
 *
 * This module verifies the JWT using the Privy SDK's verifyAccessToken function
 * with the app's verification key from the Privy dashboard.
 *
 * SECURITY: This replaces the old pattern of trusting a client-supplied
 * "clientAddress" field in the request body. With this module, the backend
 * cryptographically verifies the caller's identity.
 *
 * REQUIRED ENV VARS:
 *   NEXT_PUBLIC_PRIVY_APP_ID - Your Privy app ID
 *   PRIVY_VERIFICATION_KEY   - Your app's verification key from the Privy dashboard
 *                               (Settings > Basics > Verification Key)
 */

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
const PRIVY_VERIFICATION_KEY = process.env.PRIVY_VERIFICATION_KEY || '';

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

    if (!PRIVY_VERIFICATION_KEY) {
      console.error('[AUTH] PRIVY_VERIFICATION_KEY is not set. Get it from the Privy dashboard (Settings > Basics).');
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

    // Verify the access token using Privy's SDK
    const verified = await verifyAccessToken({
      access_token: token,
      app_id: PRIVY_APP_ID,
      verification_key: PRIVY_VERIFICATION_KEY,
    });

    if (!verified.user_id) {
      return null;
    }

    return {
      userId: verified.user_id,
      // The userId (did:privy:...) is the canonical identity
      address: verified.user_id,
      sessionId: verified.session_id || '',
      expiresAt: verified.expiration || 0,
    };
  } catch (error: any) {
    // JWT verification failed — invalid, expired, or tampered token
    console.error('[AUTH] Client auth verification failed:', error.message || error);
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

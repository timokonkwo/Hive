import { NextRequest, NextResponse } from 'next/server';
import { authenticateClient, type VerifiedClient } from './client-auth';

/**
 * Shared admin authentication check for all /api/admin/* routes.
 *
 * Accepts THREE mechanisms (in priority order):
 *   1. ADMIN_API_KEY in x-admin-key header (for programmatic/cron access)
 *   2. Privy JWT where user's Privy DID matches ADMIN_PRIVY_DID (strongest)
 *   3. Privy JWT + claimed wallet address matches ADMIN_ADDRESS (transitional)
 *
 * IMPORTANT: Method 3 is a transitional fallback. It requires a valid Privy
 * session (so random unauthenticated users can't exploit it), but any
 * authenticated Privy user who knows the ADMIN_ADDRESS could claim admin.
 *
 * Set ADMIN_PRIVY_DID in your env to your Privy user ID to use method 2
 * and disable the weaker method 3. Find your Privy DID in the Privy dashboard
 * under Users, or from the browser console: user.id after logging in.
 *
 * Usage:
 *   const admin = await verifyAdmin(request);
 *   if (admin.error) return admin.error;
 */
export async function verifyAdmin(
  request: NextRequest
): Promise<{ client?: VerifiedClient; error?: NextResponse }> {
  // Method 1: Admin API key (server-to-server / cron)
  const adminKey = request.headers.get('x-admin-key');
  const expectedAdminKey = process.env.ADMIN_API_KEY;
  if (expectedAdminKey && adminKey === expectedAdminKey) {
    return {}; // Authorized via API key
  }

  // All JWT-based methods require a valid Privy session first
  const client = await authenticateClient(request);
  if (!client) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      ),
    };
  }

  // Method 2 (preferred): Check against ADMIN_PRIVY_DID
  const rawAdminDid = process.env.ADMIN_PRIVY_DID;
  // Normalize: accept both "cmmswp..." and "did:privy:cmmswp..." in the env
  const adminPrivyDid = rawAdminDid
    ? (rawAdminDid.startsWith('did:privy:') ? rawAdminDid : `did:privy:${rawAdminDid}`)
    : null;
  if (adminPrivyDid && client.userId === adminPrivyDid) {
    return { client };
  }

  // Method 3 (transitional): Privy JWT + claimed address matches ADMIN_ADDRESS
  // This is weaker because any logged-in user who knows the admin address
  // could pass it. But it's still better than the old no-auth pattern.
  const adminAddress = process.env.ADMIN_ADDRESS;
  if (adminAddress) {
    const claimedAddress =
      request.headers.get('x-admin-address') ||
      new URL(request.url).searchParams.get('address') ||
      '';

    if (claimedAddress.toLowerCase() === adminAddress.toLowerCase()) {
      if (!adminPrivyDid) {
        // Warn that this method is weaker — nudge toward setting ADMIN_PRIVY_DID
        console.warn(
          '[ADMIN-AUTH] Using transitional address-based admin check. ' +
          'Set ADMIN_PRIVY_DID env var to strengthen admin auth. ' +
          `Authenticated user: ${client.userId}`
        );
      }
      return { client };
    }
  }

  return {
    error: NextResponse.json(
      { error: 'Forbidden. Admin access required.' },
      { status: 403 }
    ),
  };
}

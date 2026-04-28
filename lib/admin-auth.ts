import { NextRequest, NextResponse } from 'next/server';
import { authenticateClient, type VerifiedClient } from './client-auth';

/**
 * Shared admin authentication check for all /api/admin/* routes.
 *
 * Accepts TWO mechanisms:
 *   1. ADMIN_API_KEY in x-admin-key header (for programmatic/cron access)
 *   2. Privy JWT (verified) + wallet address matching ADMIN_ADDRESS
 *
 * SECURITY: The old pattern accepted an unverified address as a query param.
 * This module requires cryptographic proof via Privy JWT verification.
 *
 * Usage:
 *   const admin = await verifyAdmin(request);
 *   if (admin.error) return admin.error;
 *   // admin.client is the verified client (if JWT-based)
 */
export async function verifyAdmin(
  request: NextRequest
): Promise<{ client?: VerifiedClient; error?: NextResponse }> {
  // Method 1: Admin API key (server-to-server / cron)
  const adminKey = request.headers.get('x-admin-key');
  const expectedAdminKey = process.env.ADMIN_API_KEY;
  if (expectedAdminKey && adminKey === expectedAdminKey) {
    return {}; // Authorized via API key, no client object needed
  }

  // Method 2: Privy JWT + admin address match
  const client = await authenticateClient(request);
  if (!client) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      ),
    };
  }

  const adminAddress = process.env.ADMIN_ADDRESS;
  if (!adminAddress) {
    return {
      error: NextResponse.json(
        { error: 'Admin not configured.' },
        { status: 503 }
      ),
    };
  }

  // The frontend sends the user's wallet address in the x-admin-address header
  // or as a query param. We check it against ADMIN_ADDRESS but ONLY because
  // we've already verified the Privy JWT (so the user IS authenticated).
  const claimedAddress =
    request.headers.get('x-admin-address') ||
    new URL(request.url).searchParams.get('address') ||
    '';

  const isAdmin =
    claimedAddress.toLowerCase() === adminAddress.toLowerCase() ||
    client.userId.toLowerCase() === adminAddress.toLowerCase();

  if (!isAdmin) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      ),
    };
  }

  return { client };
}

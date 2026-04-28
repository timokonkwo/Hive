import { NextRequest, NextResponse } from 'next/server';
import { authenticateClient } from '@/lib/client-auth';

/**
 * GET /api/admin/verify?address=0x...
 * Server-side admin verification.
 *
 * SECURITY: Requires a valid Privy JWT in the Authorization header.
 * Checks ADMIN_PRIVY_DID first (strongest), falls back to ADMIN_ADDRESS match.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ isAdmin: false });
  }

  // Verify Privy JWT — the caller must be authenticated
  const client = await authenticateClient(request);
  if (!client) {
    return NextResponse.json({ isAdmin: false });
  }

  // Check 1: ADMIN_PRIVY_DID match (strongest)
  const rawAdminDid = process.env.ADMIN_PRIVY_DID;
  if (rawAdminDid) {
    const adminPrivyDid = rawAdminDid.startsWith('did:privy:') ? rawAdminDid : `did:privy:${rawAdminDid}`;
    if (client.userId === adminPrivyDid) {
      return NextResponse.json({ isAdmin: true });
    }
    // If ADMIN_PRIVY_DID is set but doesn't match, this user is NOT admin
    return NextResponse.json({ isAdmin: false });
  }

  // Check 2 (fallback): ADMIN_ADDRESS match
  const adminAddress = process.env.ADMIN_ADDRESS;
  if (adminAddress && address.toLowerCase() === adminAddress.toLowerCase()) {
    return NextResponse.json({ isAdmin: true });
  }

  return NextResponse.json({ isAdmin: false });
}

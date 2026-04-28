import { NextRequest, NextResponse } from 'next/server';
import { authenticateClient } from '@/lib/client-auth';

/**
 * GET /api/admin/verify?address=0x...
 * Server-side admin verification.
 *
 * SECURITY: Requires a valid Privy JWT in the Authorization header.
 * Simply knowing the admin address is no longer sufficient.
 * The caller must prove they are authenticated via Privy AND
 * their claimed address must match the ADMIN_ADDRESS env var.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ isAdmin: false });
  }

  const adminAddress = process.env.ADMIN_ADDRESS;
  if (!adminAddress) {
    return NextResponse.json({ isAdmin: false });
  }

  // Quick check: does the address even match? (Before expensive JWT verify)
  if (address.toLowerCase() !== adminAddress.toLowerCase()) {
    return NextResponse.json({ isAdmin: false });
  }

  // Verify Privy JWT — the caller must be authenticated
  const client = await authenticateClient(request);
  if (!client) {
    return NextResponse.json({ isAdmin: false });
  }

  // Authenticated + address matches admin = admin
  return NextResponse.json({ isAdmin: true });
}

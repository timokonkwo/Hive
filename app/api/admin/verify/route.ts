import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';

/**
 * GET /api/admin/verify?address=0x...
 * Server-side admin verification.
 *
 * SECURITY: Requires ADMIN_API_KEY or a valid Privy JWT whose DID matches
 * ADMIN_PRIVY_DID. Legacy ADMIN_ADDRESS matching is disabled unless explicitly
 * enabled with ENABLE_LEGACY_ADMIN_ADDRESS_AUTH=true.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  return NextResponse.json({ isAdmin: !admin.error });
}

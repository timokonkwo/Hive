import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';

/**
 * GET /api/admin/verify?address=0x...
 * Server-side admin verification.
 *
 * SECURITY: Requires a valid Privy JWT in the Authorization header.
 * Checks ADMIN_PRIVY_DID first (strongest), falls back to ADMIN_ADDRESS match.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  return NextResponse.json({ isAdmin: !admin.error });
}

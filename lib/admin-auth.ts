import { NextRequest, NextResponse } from 'next/server';
import { authenticateClient, type VerifiedClient } from './client-auth';
import { verifyAdminWallet } from './admin-wallet-auth';

/** Admin API keys, a verified configured DID, or a signed linked admin wallet. */
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
  const rawAdminDid = process.env.ADMIN_PRIVY_DID?.trim();
  // Normalize: accept both "cmmswp..." and "did:privy:cmmswp..." in the env
  const adminPrivyDid = rawAdminDid
    ? (rawAdminDid.startsWith('did:privy:') ? rawAdminDid : `did:privy:${rawAdminDid}`)
    : null;
  if (adminPrivyDid && client.userId === adminPrivyDid) {
    return { client };
  }

  // Never authorize a wallet supplied in a query, body or unsigned header.
  const identityToken=request.headers.get('privy-id-token')||request.cookies.get('privy-id-token')?.value||'';
  if(await verifyAdminWallet(identityToken,client.userId,process.env.ADMIN_ADDRESS||'',process.env.NEXT_PUBLIC_PRIVY_APP_ID||''))return {client};

  return {
    error: NextResponse.json(
      { error: 'Forbidden. Admin access required.' },
      { status: 403 }
    ),
  };
}

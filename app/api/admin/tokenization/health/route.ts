import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';
import { solanaLaunchesEnabled } from '@/lib/agent-tokenization/session-preview';
import { solanaDeployerStatus } from '@/lib/agent-tokenization/solana-signer';
import { managedDeployerStatus } from '@/lib/agent-tokenization/managed-signer';
import { launchesEnabled } from '@/lib/agent-tokenization/release';

export const dynamic = 'force-dynamic';
/** Authenticated, read-only deployment check. Never signs, reserves or broadcasts. */
export async function GET(request:NextRequest) {
  const admin=await verifyAdmin(request);
  if(admin.error) return admin.error;
  try {
    await (await getDb()).command({ping:1});
    return NextResponse.json({database:true,platforms:{pons:launchesEnabled(),bags:solanaLaunchesEnabled('bags'),pump:solanaLaunchesEnabled('pump')},
      recovery:process.env.AGENT_MULTI_PLATFORM_RECOVERY_ENABLED==='true',deployers:{solana:solanaDeployerStatus(),evm:managedDeployerStatus()}},
      {headers:{'Cache-Control':'private, no-store'}});
  } catch { return NextResponse.json({error:'Tokenization health check could not complete.'},{status:503}); }
}

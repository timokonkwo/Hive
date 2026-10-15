import { NextRequest, NextResponse } from 'next/server';
import type { Db } from 'mongodb';
import { authenticateRequest } from '@/lib/api-key';
import { verifyAdmin } from '@/lib/admin-auth';
import type { LaunchRole } from './types';

export async function authorizeTokenization(req: NextRequest, db: Db, agentId: string, role: LaunchRole) {
  if (role === 'admin') {
    const auth = await verifyAdmin(req);
    return auth.error || null;
  }
  const auth = await authenticateRequest(req.headers, db);
  if (!auth) return NextResponse.json({ error: 'Sign in to manage this agent.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  if (auth.agent.id !== agentId) return NextResponse.json({ error: 'This account cannot manage this agent.' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  return null;
}

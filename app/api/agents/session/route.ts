import { NextResponse } from 'next/server';
import { clearAgentSessionCookie } from '@/lib/agent-session';

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearAgentSessionCookie(response);
  return response;
}

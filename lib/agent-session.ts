import { createHmac, timingSafeEqual } from 'crypto';
import type { NextResponse } from 'next/server';

export const AGENT_SESSION_COOKIE = 'hive_agent_session';

const AGENT_SESSION_TTL_SECONDS = 12 * 60 * 60;

export type AgentSessionClaims = {
  v: 1;
  agentId: string;
  apiKeyHash: string;
  exp: number;
};

type CreateAgentSessionInput = {
  agentId: string;
  apiKeyHash: string;
};

export function createAgentSessionToken(input: CreateAgentSessionInput) {
  const now = Math.floor(Date.now() / 1000);
  const claims: AgentSessionClaims = {
    v: 1,
    agentId: input.agentId,
    apiKeyHash: input.apiKeyHash,
    exp: now + AGENT_SESSION_TTL_SECONDS,
  };
  const payload = base64UrlEncode(JSON.stringify(claims));
  return `${payload}.${signAgentSessionPayload(payload)}`;
}

export function verifyAgentSessionToken(token: string | null | undefined): AgentSessionClaims | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  let expectedSignature: string;
  try {
    expectedSignature = signAgentSessionPayload(payload);
  } catch {
    return null;
  }
  if (!constantTimeEqual(signature, expectedSignature)) return null;

  try {
    const claims = JSON.parse(base64UrlDecode(payload)) as Partial<AgentSessionClaims>;
    if (claims.v !== 1) return null;
    if (!claims.agentId || typeof claims.agentId !== 'string') return null;
    if (!claims.apiKeyHash || typeof claims.apiKeyHash !== 'string') return null;
    if (!/^[a-f0-9]{64}$/.test(claims.apiKeyHash)) return null;
    if (!claims.exp || typeof claims.exp !== 'number') return null;
    if (claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims as AgentSessionClaims;
  } catch {
    return null;
  }
}

export function readAgentSessionCookie(headers: Headers) {
  const cookieHeader = headers.get('cookie');
  if (!cookieHeader) return null;
  for (const segment of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = segment.trim().split('=');
    if (rawName === AGENT_SESSION_COOKIE) {
      try {
        return decodeURIComponent(rawValue.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function setAgentSessionCookie(response: NextResponse, input: CreateAgentSessionInput) {
  response.cookies.set(AGENT_SESSION_COOKIE, createAgentSessionToken(input), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AGENT_SESSION_TTL_SECONDS,
  });
}

export function clearAgentSessionCookie(response: NextResponse) {
  response.cookies.set(AGENT_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

function signAgentSessionPayload(payload: string) {
  return createHmac('sha256', agentSessionSecret()).update(payload).digest('base64url');
}

function agentSessionSecret() {
  const secret = process.env.AGENT_SESSION_SECRET || process.env.BNB_AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AGENT_SESSION_SECRET, BNB_AUTH_SECRET, NEXTAUTH_SECRET, or AUTH_SECRET is required for agent dashboard sessions');
  }
  return 'hive-agent-session-dev';
}

function constantTimeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

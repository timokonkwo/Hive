import { NextRequest } from 'next/server';
import { getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type HumanVerificationResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; status: number; error: string };

/**
 * Verifies that a task-writing request came through an interactive human
 * challenge. In local development the check is skipped unless a secret is set;
 * in production a missing secret fails closed.
 */
export async function requireHumanVerification(
  req: NextRequest,
  token: unknown,
  action: string
): Promise<HumanVerificationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('TURNSTILE_SECRET_KEY is not configured; refusing human-gated request.', {
        tag: 'HUMAN-VERIFICATION',
        action,
      });
      return { ok: false, status: 503, error: 'Human verification is temporarily unavailable.' };
    }
    return { ok: true, skipped: true };
  }

  if (typeof token !== 'string' || token.trim().length < 20 || token.length > 4096) {
    return { ok: false, status: 403, error: 'Human verification required. Please complete the challenge and try again.' };
  }

  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token.trim());
    body.set('remoteip', getClientIp(req));

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await response.json().catch(() => null) as {
      success?: boolean;
      'error-codes'?: unknown;
    } | null;
    if (!response.ok || !data?.success) {
      logger.warn('Human verification failed.', {
        tag: 'HUMAN-VERIFICATION',
        action,
        errorCodes: Array.isArray(data?.['error-codes']) ? data['error-codes'] : [],
      });
      return { ok: false, status: 403, error: 'Human verification failed. Please retry the challenge.' };
    }

    return { ok: true };
  } catch (error: unknown) {
    logger.error('Human verification provider error.', {
      tag: 'HUMAN-VERIFICATION',
      action,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return { ok: false, status: 503, error: 'Human verification is temporarily unavailable.' };
  }
}

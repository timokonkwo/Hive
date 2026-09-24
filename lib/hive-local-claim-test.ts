import { supplementalClaim } from './hive-reimbursement';

/** Early access exists only in a development server reached over loopback. */
export function localClaimTestOwner(requestUrl: string): string | null {
  if (process.env.NODE_ENV !== 'development' || process.env.HIVE_LOCAL_CLAIM_TEST_OWNER !== supplementalClaim.owner) return null;
  try {
    const url = new URL(requestUrl);
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? supplementalClaim.owner : null;
  } catch { return null; }
}

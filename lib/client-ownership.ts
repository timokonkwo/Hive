import type { VerifiedClient } from './client-auth';

interface ClientOwnedResource {
  [key: string]: unknown;
  clientAddress?: string | null;
  clientPrivyUserId?: string | null;
}

function sameIdentity(a: string | null | undefined, b: string | null | undefined) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/**
 * Verifies ownership for client-owned resources.
 *
 * New records should carry clientPrivyUserId, which is cryptographically tied
 * to the Privy JWT. The claimedAddress fallback is only for legacy task records
 * that predate server-side Privy ownership storage.
 */
export function verifiedClientOwnsResource(
  verified: VerifiedClient,
  resource: ClientOwnedResource,
  claimedAddress?: string | null
): boolean {
  if (sameIdentity(resource.clientPrivyUserId, verified.userId)) return true;
  if (sameIdentity(resource.clientAddress, verified.userId)) return true;

  if (!resource.clientPrivyUserId && claimedAddress) {
    return sameIdentity(resource.clientAddress, claimedAddress);
  }

  return false;
}

export function getClientActorAddress(
  verified: VerifiedClient,
  resource?: ClientOwnedResource,
  claimedAddress?: string | null
): string {
  return resource?.clientPrivyUserId || verified.userId || claimedAddress || 'unknown';
}

import { keccak256, stringToHex } from 'viem';
import { HIVE_AGENT_ATTRIBUTION, AGENT_BIO_LIMIT } from './profile-fields';
import { validTokenLogo } from './policy';
export { HIVE_AGENT_ATTRIBUTION } from './profile-fields';
import type { LaunchPreview, LaunchRole } from './types';
import { feeRecipient, suggestSymbol } from './policy';
import { readAssociation } from './association';

const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const DESCRIPTION_LIMIT = 1000;
const BIO_LIMIT = AGENT_BIO_LIMIT;

export function profileRevision(agent: Record<string, unknown>) {
  return keccak256(stringToHex(JSON.stringify([agent.name,agent.bio,agent.avatarSeed,agent.avatarUrl]))).slice(2);
}

/** Pure projection: never mutate profile data or accept launch settings from callers. */
export function profilePreview(agentId: string, agent: Record<string, unknown>, role: LaunchRole): LaunchPreview {
  const name = text(agent.name), bio = text(agent.bio);
  const description = [bio, HIVE_AGENT_ATTRIBUTION].filter(Boolean).join('\n\n');
  const issues: string[] = [];
  // Conservative product limits. Verified contract limits remain a release gate.
  if (!name || name.length > 64) issues.push('Use an agent name between 1 and 64 characters in your profile.');
  if (bio.length < 10 || description.length > DESCRIPTION_LIMIT) issues.push(`Use a profile bio between 10 and ${BIO_LIMIT} characters to leave room for the Hive attribution.`);
  if (agent.status !== 'active') issues.push('Activate this agent before launching a token.');
  const verifiedAt = agent.walletAddressVerifiedAt;
  const verified = verifiedAt instanceof Date ? Number.isFinite(verifiedAt.getTime())
    : typeof verifiedAt === 'string' && Number.isFinite(Date.parse(verifiedAt));
  const recipient = feeRecipient(role, agent.walletAddress, verified);
  if (!recipient) issues.push('Verify your Robinhood wallet in wallet settings first.');
  if (new TextEncoder().encode(name).length > 64) issues.push('Shorten the agent name to fit the token.');
  if (new TextEncoder().encode(description).length > 2048) issues.push('Shorten the bio to fit the token.');
  const website = `https://uphive.xyz/agent/${encodeURIComponent(name)}`;
  if (new TextEncoder().encode(website).length > 256) issues.push('Shorten the agent name to fit the profile link.');
  const existingToken = readAssociation(agent.ponsToken);
  if (agent.ponsToken && !existingToken) issues.push('The existing Robinhood token needs review. Contact Hive support.');
  return {
    agentId, role, recipient, feePolicyVersion: 2,
    ...(role === 'admin' ? { adminProfile: { name, bio, imageUrl: text(agent.avatarUrl), revision: profileRevision(agent) } } : {}),
    requiredSigner: role === 'owner' ? recipient : null,
    metadata: {
      name, description, symbol: suggestSymbol(name, text(agent.tokenSymbol)),
      avatarSeed: text(agent.avatarSeed) || agentId,
      ...(validTokenLogo(text(agent.avatarUrl)) ? { imageUrl: text(agent.avatarUrl) } : {}),
      socials: { website, twitter: '', telegram: '' },
    },
    issues, existingToken, signingEnabled: false,
  };
}

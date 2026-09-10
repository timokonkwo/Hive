/**
 * Dicebear avatar utilities for Hive Protocol AI agents and users.
 * Generates deterministic SVG avatar URLs based on identifier and style.
 */

export type AvatarStyle = 
  | 'bottts-neutral' 
  | 'bottts' 
  | 'shapes' 
  | 'identicon' 
  | 'thumbs';

/**
 * Returns a Dicebear SVG avatar URL for an agent or address.
 * @param seed - Unique identifier (agent name, address, or ID).
 * @param style - Dicebear style preset (default: 'bottts-neutral').
 */
export function getAgentAvatarUrl(
  seed: string, 
  style: AvatarStyle = 'bottts-neutral'
): string {
  const safeSeed = encodeURIComponent(seed || 'hive-agent');
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${safeSeed}&radius=50&backgroundColor=0d0d10`;
}

/**
 * Returns a human user avatar URL for clients and wallet holders.
 * @param seed - Wallet address or username.
 */
export function getUserAvatarUrl(seed: string): string {
  const safeSeed = encodeURIComponent(seed || 'hive-user');
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${safeSeed}&radius=50`;
}

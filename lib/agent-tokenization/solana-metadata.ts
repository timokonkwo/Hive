import { createHash } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import type { AgentTokenMetadata } from './types';
import { validTokenLogo } from './policy';
import { profileUrl } from './platforms';

export function solanaMetadata(agentId: string, metadata: AgentTokenMetadata, image: string) {
  if (!validTokenLogo(image) || metadata.socials.website !== profileUrl(agentId)
    || metadata.socials.twitter || metadata.socials.telegram) throw Error('Token metadata does not match the agent.');
  return { name: metadata.name, symbol: metadata.symbol, description: metadata.description, image,
    external_url: profileUrl(agentId), website: profileUrl(agentId),
    properties: { category: 'image', files: [{ uri: image, type: 'image/png' }] } };
}

/** Existing provider, content-addressed ID, no mutable overwrite or third-party image fetch. */
export async function persistSolanaMetadata(agentId: string, metadata: AgentTokenMetadata, image: string) {
  const body = JSON.stringify(solanaMetadata(agentId, metadata, image));
  const digest = createHash('sha256').update(body).digest('hex');
  const cloud = process.env.CLOUDINARY_CLOUD_NAME, apiKey = process.env.CLOUDINARY_API_KEY, apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !/^[a-z0-9_-]+$/i.test(cloud) || !apiKey || !apiSecret) throw Error('The token metadata service is unavailable.');
  const publicId = `hive-agent-tokens/${digest}.json`;
  const result = await cloudinary.uploader.upload(`data:application/json;base64,${Buffer.from(body).toString('base64')}`, {
    cloud_name: cloud, api_key: apiKey, api_secret: apiSecret, public_id: publicId,
    resource_type: 'raw', type: 'upload', overwrite: false, unique_filename: false, timeout: 20_000,
  });
  const uri = `https://res.cloudinary.com/${cloud}/raw/upload/v${result.version}/${publicId}`;
  if (result.public_id !== publicId || result.resource_type !== 'raw' || result.type !== 'upload'
    || !Number.isSafeInteger(result.version) || result.version < 1 || result.secure_url !== uri || new TextEncoder().encode(uri).length > 200) {
    throw Error('The stored token metadata could not be verified.');
  }
  return { uri, digest };
}

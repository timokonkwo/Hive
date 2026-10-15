import { createHash } from 'node:crypto';
import { createAvatar } from '@dicebear/core';
import * as bottts from '@dicebear/bottts';
import { v2 as cloudinary } from 'cloudinary';
import type { LaunchPreview } from './types';
import { validTokenLogo } from './policy';
import { AGENT_IMAGE_LIMIT } from './profile-fields';

export function uploadedImage(value: unknown): { data: string; digest: string } {
  if (typeof value !== 'string') throw Error('Choose a PNG, JPEG or WebP image.');
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length > Math.ceil(AGENT_IMAGE_LIMIT / 3) * 4) throw Error('Choose a PNG, JPEG or WebP image up to 2 MB.');
  const bytes = Buffer.from(match[2], 'base64');
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!bytes.length || bytes.length > AGENT_IMAGE_LIMIT || bytes.toString('base64') !== match[2]
    || !({ 'image/png': png, 'image/jpeg': jpeg, 'image/webp': webp }[match[1]])) throw Error('This file is not a supported image.');
  return { data: value, digest: createHash('sha256').update('profile-image-v1:').update(bytes).digest('hex') };
}

export async function persistUploadedAvatar(value: unknown): Promise<string> {
  const image = uploadedImage(value);
  return uploadAvatar(image.data, `hive-agent-tokens/${image.digest}`, true);
}

export function tokenAvatar(preview: LaunchPreview) {
  const seed = preview.metadata.avatarSeed;
  if (!seed || seed.length > 256) throw Error('The profile avatar needs review.');
  // Match AgentAvatar's style/background; only the output resolution differs.
  const svg = createAvatar(bottts, { seed, backgroundColor: ['e9eddf'], size: 512 }).toString();
  const digest = createHash('sha256').update(svg).digest('hex');
  return { svg, publicId: `hive-agent-tokens/${digest}` };
}

/** Uses the configured Cloudinary account, with deterministic IDs and no overwrite. */
export async function persistTokenAvatar(preview: LaunchPreview): Promise<string> {
  if (preview.metadata.imageUrl) {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (!validTokenLogo(preview.metadata.imageUrl) || !preview.metadata.imageUrl.startsWith(`https://res.cloudinary.com/${cloud}/`)) throw Error('The profile image needs review.');
    return preview.metadata.imageUrl;
  }
  const { svg, publicId } = tokenAvatar(preview);
  return uploadAvatar(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, publicId);
}

async function uploadAvatar(data: string, publicId: string, crop = false): Promise<string> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !/^[a-z0-9_-]+$/i.test(cloud) || !apiKey || !apiSecret) throw Error('The token image service is unavailable.');
  const result = await cloudinary.uploader.upload(data, {
    cloud_name: cloud, api_key: apiKey, api_secret: apiSecret,
    public_id: publicId, resource_type: 'image', type: 'upload', format: 'png',
    overwrite: false, unique_filename: false, timeout: 20_000,
    ...(crop ? { transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'center' }] } : {}),
  });
  if (result.public_id !== publicId || result.resource_type !== 'image' || result.type !== 'upload'
    || result.format !== 'png' || !Number.isSafeInteger(result.version) || result.version < 1
    || result.width !== 512 || result.height !== 512) throw Error('The stored token image could not be verified.');
  const expected = `https://res.cloudinary.com/${cloud}/image/upload/v${result.version}/${publicId}.png`;
  if (result.secure_url !== expected) throw Error('The image service returned an unexpected URL.');
  return expected;
}

import { createHash, createPublicKey, verify as cryptoVerify } from 'crypto';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { COLLECTIONS } from './db';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function buildSolanaAuthMessage(input: {
  action: string;
  address: string;
  nonce: string;
  timestamp: number;
}): string {
  return [
    'Hive Solana Wallet Proof',
    `Action: ${input.action}`,
    `Address: ${input.address}`,
    `Nonce: ${input.nonce}`,
    `Timestamp: ${input.timestamp}`,
  ].join('\n');
}

export function verifySolanaMessageSignature(input: {
  address: string;
  action: string;
  message: string;
  signature: string;
  maxAgeMs?: number;
}): { verified: boolean; error?: string } {
  try {
    const publicKey = new PublicKey(input.address);
    const normalizedAddress = publicKey.toBase58();
    const lines = input.message.split('\n');
    const expectedPrefix = [
      'Hive Solana Wallet Proof',
      `Action: ${input.action}`,
      `Address: ${normalizedAddress}`,
    ];

    if (lines.length !== 5 || expectedPrefix.some((line, index) => lines[index] !== line)) {
      return { verified: false, error: 'Invalid wallet proof message.' };
    }

    const nonce = lines[3]?.replace(/^Nonce: /, '');
    const timestampRaw = lines[4]?.replace(/^Timestamp: /, '');
    const timestamp = Number(timestampRaw);
    if (!nonce || !Number.isFinite(timestamp)) {
      return { verified: false, error: 'Invalid wallet proof metadata.' };
    }

    const maxAgeMs = input.maxAgeMs ?? 5 * 60 * 1000;
    const ageMs = Math.abs(Date.now() - timestamp);
    if (ageMs > maxAgeMs) {
      return { verified: false, error: 'Wallet proof has expired. Sign again.' };
    }

    const signature = bs58.decode(input.signature);
    if (signature.length !== 64) {
      return { verified: false, error: 'Invalid wallet proof signature.' };
    }

    const derPublicKey = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey.toBytes())]);
    const keyObject = createPublicKey({ key: derPublicKey, format: 'der', type: 'spki' });
    const verified = cryptoVerify(null, Buffer.from(input.message, 'utf8'), keyObject, signature);

    return verified
      ? { verified: true }
      : { verified: false, error: 'Wallet proof signature does not match the claimed address.' };
  } catch {
    return { verified: false, error: 'Invalid wallet proof.' };
  }
}

export async function verifyAndConsumeSolanaMessageSignature(
  db: any,
  input: {
    address: string;
    action: string;
    message: string;
    signature: string;
    maxAgeMs?: number;
  }
): Promise<{ verified: boolean; error?: string }> {
  const verification = verifySolanaMessageSignature(input);
  if (!verification.verified) return verification;

  const maxAgeMs = input.maxAgeMs ?? 5 * 60 * 1000;
  const digest = createHash('sha256')
    .update([input.action, input.address, input.message, input.signature].join('\n'))
    .digest('hex');

  try {
    const collection = db.collection(COLLECTIONS.WALLET_PROOFS);
    await collection.createIndex({ digest: 1 }, { unique: true, background: true });
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true });
    await collection.insertOne({
      digest,
      action: input.action,
      address: new PublicKey(input.address).toBase58(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + maxAgeMs),
    });
    return { verified: true };
  } catch (error: any) {
    if (error?.code === 11000) {
      return { verified: false, error: 'Wallet proof has already been used. Sign again.' };
    }
    return { verified: false, error: 'Wallet proof replay protection is not ready. Try again shortly.' };
  }
}

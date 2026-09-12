import { createHash, createPublicKey, verify } from 'crypto';
import { isAddress, verifyMessage } from 'viem';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import type { Db } from 'mongodb';
import { agentWalletMessage, type WalletChange, type WalletNetwork } from './agent-wallet-message';

export function normalizeAgentWallet(network: WalletNetwork, address: unknown): string {
  if (typeof address !== 'string') throw Error('Choose a valid wallet address.');
  if (network === 'robinhood') {
    if (!isAddress(address)) throw Error('Choose a valid EVM wallet address.');
    return address.toLowerCase();
  }
  const key = new PublicKey(address);
  if (!PublicKey.isOnCurve(key.toBytes())) throw Error('Choose a wallet that can sign messages.');
  return key.toBase58();
}

export async function verifyAgentWalletProof(change: WalletChange, proof: unknown) {
  if (!proof || typeof proof !== 'object') throw Error('Sign the wallet ownership message.');
  const p = proof as Record<string, unknown>;
  if (typeof p.message !== 'string' || typeof p.signature !== 'string') throw Error('Sign the wallet ownership message.');
  const lines = p.message.split('\n'), nonce = lines[7]?.slice(7), timestamp = Number(lines[8]?.slice(11));
  if (!nonce || !/^[a-f0-9]{32}$/.test(nonce) || !Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > 300000) throw Error('The wallet proof expired or is invalid. Sign again.');
  if (p.message !== agentWalletMessage(change, nonce, timestamp)) throw Error('The wallet proof does not match this agent or change.');
  let valid = false;
  if (change.network === 'robinhood') {
    if (/^0x[a-f0-9]{130}$/i.test(p.signature)) valid = await verifyMessage({ address: change.address as `0x${string}`, message: p.message, signature: p.signature as `0x${string}` });
  } else {
    const sig = bs58.decode(p.signature);
    if (sig.length === 64) {
      const der = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(new PublicKey(change.address).toBytes())]);
      valid = verify(null, Buffer.from(p.message), createPublicKey({ key: der, format: 'der', type: 'spki' }), sig);
    }
  }
  if (!valid) throw Error('The signature does not match the selected wallet.');
  return createHash('sha256').update(p.message).digest('hex');
}

export async function consumeAgentWalletProof(db: Db, digest: string) {
  // Mongo's _id index provides uniqueness without a deployment-time index race.
  try { await db.collection<{ _id: string; digest: string; createdAt: Date; expiresAt: Date }>('wallet_proofs').insertOne({ _id: digest, digest, createdAt: new Date(), expiresAt: new Date(Date.now() + 600000) }); }
  catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 11000) throw Error('This wallet proof was already used. Refresh and sign again.'); throw error; }
}

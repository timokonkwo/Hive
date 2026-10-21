import type { LaunchRole } from './types';

export const HIVE_LAUNCH_WALLET = '0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2';
export const PONS_CHAIN_ID = 4663;
export const PONS_FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
export const HIVE_CREATOR_FEE_WALLET = '0x4a7c1d6872c6B7D0AAC1ab2311F15b2D750A9B19';
export const CREATOR_TAX_BPS = 200;
/** Version 1 remains the default for persisted records written before versioning. */
export function creatorTaxBps(version: 1 | 2 = 1): number {
  if (version === 1) return CREATOR_TAX_BPS;
  if (version === 2) return 300;
  throw Error('Unrecognized Pons fee policy.');
}
export const BASE_FEE_BPS = 100;
export const PURCHASE_SLIPPAGE_BPS = 100;

export function validAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value)
    && !/^0x0{40}$/i.test(value);
}

export function validHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);
}

export function sameAddress(a: string, b: string): boolean {
  return validAddress(a) && validAddress(b) && a.toLowerCase() === b.toLowerCase();
}

export function feeRecipient(role: LaunchRole, primaryWallet: unknown, verified: boolean): string | null {
  if (role === 'admin') return HIVE_CREATOR_FEE_WALLET;
  return verified && validAddress(primaryWallet) ? primaryWallet : null;
}

/** No floating point, exponent notation, rounding, negative or ambiguous inputs. */
export function purchaseWei(input: string): bigint {
  const value = input.trim() || '0';
  if (!/^(0|[1-9][0-9]{0,17})(\.[0-9]{1,18})?$/.test(value)) {
    throw new Error('Enter an ETH amount with up to 18 decimal places.');
  }
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
}

export function normalizeSymbol(input: string): string {
  const symbol = input.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,10}$/.test(symbol)) throw new Error('Use 1–10 letters or numbers for the ticker.');
  return symbol;
}

export function suggestSymbol(name: string, existing?: string): string {
  if (existing) {
    try { return normalizeSymbol(existing); } catch { /* Suggest from profile name. */ }
  }
  return name.replace(/[^a-z0-9]/gi, '').slice(0, 10).toUpperCase();
}

export function ponsTokenUrl(address: string): string {
  if (!validAddress(address)) throw new Error('Invalid token address.');
  return `https://www.ponsfamily.com/launchpad/${address}`;
}

export function explorerTransactionUrl(hash: string): string {
  if (!validHash(hash)) throw new Error('Invalid transaction hash.');
  return `https://robinhoodchain.blockscout.com/tx/${hash}`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Server-produced IPFS content or a versioned, content-named Cloudinary avatar. */
export function validTokenLogo(value: string): boolean {
  return /^ipfs:\/\/(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})(?:\/[a-zA-Z0-9._-]+)?$/.test(value)
    || /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\/v[1-9][0-9]*\/hive-agent-tokens\/[a-f0-9]{64}\.png$/.test(value);
}

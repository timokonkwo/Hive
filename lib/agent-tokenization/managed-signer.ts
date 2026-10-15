import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { HIVE_LAUNCH_WALLET, sameAddress } from './policy';
import type { LaunchIntent } from './store';

/** Never import into client components. No key value is returned by status/errors. */
export function managedAccount() {
  const key = process.env.PONS_MANAGED_PRIVATE_KEY?.trim();
  if (!key || !/^0x[a-f0-9]{64}$/i.test(key)) throw Error('Hive deployer is not configured. Use a connected wallet.');
  try {
    const account = privateKeyToAccount(key as Hex);
    if (!sameAddress(account.address, HIVE_LAUNCH_WALLET)) throw Error();
    return account;
  } catch { throw Error('Hive deployer configuration does not match its wallet. Use a connected wallet.'); }
}
export function managedDeployerStatus() {
  try {
    if (process.env.PONS_MANAGED_LAUNCH_ENABLED !== 'true') throw Error('Hive deployer is not enabled. Use a connected wallet.');
    managedAccount();
    return { address: HIVE_LAUNCH_WALLET, available: true };
  } catch (error) {
    return { address: HIVE_LAUNCH_WALLET, available: false, reason: (error as Error).message };
  }
}
// Domain-separated encryption protects the authorized raw transaction at rest.
// The same key must remain available until all authorized submissions resolve.
function journalKey() {
  managedAccount();
  return Buffer.from(hkdfSync('sha256', Buffer.from(process.env.PONS_MANAGED_PRIVATE_KEY!.trim().slice(2), 'hex'),
    Buffer.from('hive-pons-managed-v1'), Buffer.from('transaction-journal'), 32));
}
export function sealSubmission(raw: Hex, intentId: string): NonNullable<LaunchIntent['managedSubmission']> {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', journalKey(), iv);
  cipher.setAAD(Buffer.from(intentId));
  const ciphertext = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}
export function openSubmission(record: NonNullable<LaunchIntent['managedSubmission']>, intentId: string): Hex {
  const decipher = createDecipheriv('aes-256-gcm', journalKey(), Buffer.from(record.iv, 'base64'));
  decipher.setAAD(Buffer.from(intentId));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8') as Hex;
}

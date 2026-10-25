import { Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { HIVE_SOLANA_FEE_WALLET, HIVE_SOLANA_LAUNCH_WALLET, SessionConflict } from './session';
import { requiresSigner } from './solana-journal';

function account(address: string) {
  const raw = (address === HIVE_SOLANA_LAUNCH_WALLET ? process.env.HIVE_LAUNCH_KEYPAIR
    : address === HIVE_SOLANA_FEE_WALLET ? process.env.HIVE_AGENT_LAUNCH_KEYPAIR : undefined)?.trim();
  if (!raw) throw new SessionConflict('Hive’s Solana deployer is not configured.');
  try {
    const bytes = raw.startsWith('[') ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw);
    const key = Keypair.fromSecretKey(bytes);
    if (key.publicKey.toBase58() !== address) throw Error();
    return key;
  } catch { throw new SessionConflict('Hive’s Solana deployer needs configuration.'); }
}
export function solanaDeployerStatus() {
  return signerStatus(HIVE_SOLANA_LAUNCH_WALLET);
}
export function solanaFeeWalletStatus() { return signerStatus(HIVE_SOLANA_FEE_WALLET); }
function signerStatus(address: string) {
  try { account(address); return { address, available: true }; }
  catch { return { address, available: false }; }
}
/** The saved launch/fee terms choose the signer; rotating the default never rewrites them. */
export function signManagedSolana(transaction: VersionedTransaction, signer = HIVE_SOLANA_FEE_WALLET) {
  if (!requiresSigner(transaction, signer)) throw new SessionConflict('The deployer does not match this review.');
  transaction.sign([account(signer)]);
  return transaction.serialize();
}

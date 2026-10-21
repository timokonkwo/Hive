import { Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { HIVE_SOLANA_FEE_WALLET, SessionConflict } from './session';
import { requiresSigner } from './solana-journal';

function account() {
  const raw = process.env.HIVE_AGENT_LAUNCH_KEYPAIR?.trim();
  if (!raw) throw new SessionConflict('Hive’s Solana deployer is not configured.');
  try {
    const bytes = raw.startsWith('[') ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw);
    const key = Keypair.fromSecretKey(bytes);
    if (key.publicKey.toBase58() !== HIVE_SOLANA_FEE_WALLET) throw Error();
    return key;
  } catch { throw new SessionConflict('Hive’s Solana deployer needs configuration.'); }
}
export function solanaDeployerStatus() {
  try { account(); return { address: HIVE_SOLANA_FEE_WALLET, available: true }; }
  catch { return { address: HIVE_SOLANA_FEE_WALLET, available: false }; }
}
export function signManagedSolana(transaction: VersionedTransaction) {
  if (!requiresSigner(transaction, HIVE_SOLANA_FEE_WALLET)) throw new SessionConflict('The deployer does not match this review.');
  transaction.sign([account()]);
  return transaction.serialize();
}

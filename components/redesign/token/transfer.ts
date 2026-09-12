import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction } from '@solana/spl-token';
import { solanaHive } from '@/lib/hive-launch';
import { base58 } from '../task/payment';
import { decimal, sig } from './model';
const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
export const connection = () => new Connection(new URL('/api/solana/rpc', location.origin).toString(), 'confirmed');
export async function prepareStake(address: string, treasury: string, amount: string) {
  const rpc = connection();
  if (await rpc.getGenesisHash() !== MAINNET_GENESIS) throw Error('The connection is not Solana mainnet. No transaction was prepared.');
  const sender = new PublicKey(address), recipient = new PublicKey(treasury), mint = new PublicKey(solanaHive.mint), raw = decimal(amount);
  if (raw === null || raw <= 0n) throw Error('Invalid amount.');
  const [from, to] = await Promise.all([getAssociatedTokenAddress(mint, sender), getAssociatedTokenAddress(mint, recipient)]);
  const balance = await rpc.getTokenAccountBalance(from);
  if (balance.value.decimals !== 9 || BigInt(balance.value.amount) < raw) throw Error('The wallet does not have enough HIVE.');
  const latest = await rpc.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: sender, ...latest }).add(createAssociatedTokenAccountIdempotentInstruction(sender, to, recipient, mint), createTransferCheckedInstruction(from, mint, to, sender, raw, 9));
  const fee = await rpc.getFeeForMessage(tx.compileMessage(), 'confirmed');
  if (fee.value === null) throw Error('The network fee could not be checked.');
  const [ata, sol] = await Promise.all([rpc.getAccountInfo(to, 'confirmed'), rpc.getBalance(sender, 'confirmed')]);
  const rent = ata ? 0 : await rpc.getMinimumBalanceForRentExemption(165);
  if (sol < fee.value + rent) throw Error('The wallet needs more SOL to pay the network cost.');
  return { tx, rent, bytes: tx.serialize({ requireAllSignatures: false }), fee: fee.value, address, treasury, amount, blockHeight: latest.lastValidBlockHeight };
}
export type Prepared = Awaited<ReturnType<typeof prepareStake>>;
export function signedReference(bytes: Uint8Array, prepared: Prepared) {
  const tx = Transaction.from(bytes);
  const actual = tx.serializeMessage(), expected = prepared.tx.serializeMessage();
  if (actual.length !== expected.length || actual.some((byte, i) => byte !== expected[i]) || !tx.verifySignatures() || !tx.signature) throw Error('The signed transaction does not match your reviewed stake.');
  const reference = base58(tx.signature); if (!sig(reference)) throw Error('The wallet did not return a signed transaction.'); return reference;
}
export async function broadcastStake(bytes: Uint8Array, reference: string) { const result = await connection().sendRawTransaction(bytes, { skipPreflight: false, maxRetries: 0, preflightCommitment: 'confirmed' }); if (result !== reference) throw Error('The transaction result could not be confirmed.'); }
export async function checkTransfer(reference: string) { const r = await connection().getSignatureStatuses([reference], { searchTransactionHistory: true }); const status = r.value[0]; if (status?.err) return 'failed'; if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') return 'confirmed'; return 'unknown'; }

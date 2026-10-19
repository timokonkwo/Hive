import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import type { AgentBagsClient } from './bags-agent';

/** The total includes fees already swept into a user's vault. Pool-only fields do not. */
export function claimableLamports(position: Record<string, unknown>): bigint {
  const amount = position.totalClaimableLamportsUserShare;
  if ((typeof amount !== 'string' && typeof amount !== 'number') || !/^\d+$/.test(String(amount))) {
    throw Error('Bags returned an invalid claimable balance.');
  }
  return BigInt(amount);
}

async function confirmationWithin<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Error('Confirmation is still pending.')), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}

function feeError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/insufficient.*(funds|lamports)/i.test(message)) return 'The Solana fee wallet needs SOL for transaction fees.';
  if (/blockhash|expired/i.test(message)) return 'The claim transaction expired. Refresh balances and try again.';
  if (/failed on Solana/.test(message)) return 'The fee claim transaction failed on Solana.';
  return 'The claim could not be confirmed. Refresh balances before retrying.';
}

type ClaimTransaction = { tx: string; blockhash: { blockhash: string; lastValidBlockHeight: number } };

export async function claimAgentFees(bags: AgentBagsClient) {
  const positions = await bags.getClaimablePositions(); // An outage must not look like an empty balance.
  const mints = [...new Set(positions.filter(p => claimableLamports(p) > 0n).map(p => new PublicKey(p.baseMint).toBase58()))];
  const transactions: Array<{ mint: string; signature: string; confirmed: boolean }> = [];
  const errors: string[] = [];
  let claimed = 0, failed = 0, processed = 0;
  const deadline = Date.now() + 35000;
  for (const mint of mints.slice(0, 5)) {
    if (Date.now() >= deadline) break;
    processed++;
    try {
      const rows = await bags.sdk.bagsApiClient.post<ClaimTransaction[]>('/token-launch/claim-txs/v3', {
        feeClaimer: bags.keypair.publicKey.toBase58(), tokenMint: mint,
      });
      if (!Array.isArray(rows)) throw Error('Bags returned invalid claim transactions.');
      for (const row of rows) {
        const tx = VersionedTransaction.deserialize(bs58.decode(row.tx));
        if (!row.blockhash || tx.message.recentBlockhash !== row.blockhash.blockhash || !Number.isSafeInteger(row.blockhash.lastValidBlockHeight)) {
          throw Error('Claim transaction expiry could not be verified.');
        }
        // Preserve sponsor signatures and the exact blockhash supplied by Bags.
        tx.sign([bags.keypair]);
        const signature = await bags.connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
        const submitted = { mint, signature, confirmed: false };
        transactions.push(submitted);
        const result = await confirmationWithin(bags.connection.confirmTransaction({ signature, ...row.blockhash }, 'confirmed'), Math.max(1000, Math.min(15000, deadline - Date.now())));
        if (result.value.err) throw Error('The fee claim transaction failed on Solana.');
        submitted.confirmed = true;
      }
      if (rows.length) claimed++;
    } catch (error) {
      failed++;
      errors.push(`${mint}: ${feeError(error)}`);
      if (transactions.some(tx => !tx.confirmed)) break;
    }
  }
  const remaining = mints.length - processed;
  const pending = transactions.some(tx => !tx.confirmed);
  const message = failed
    ? `${claimed} position(s) claimed; ${failed} could not be confirmed.${pending ? ' Check the transaction before retrying.' : ' Refresh balances and try again.'}`
    : claimed ? `Claimed ${claimed} position(s).${remaining ? ' Claim again for the remaining fees.' : ''}` : 'No claimable fees found.';
  return { message, claimed, failed, remaining, transactions, errors, ...(failed && !claimed ? { error: message } : {}) };
}

import 'server-only';
import { createHash } from 'node:crypto';
import snapshot from '@/data/hive-reimbursement-snapshot.json';
import { lookupReimbursement, publicSolanaAddress, reimbursementCampaign, validateCheckerSnapshot, type CurrentBalance } from './hive-reimbursement';

export function validateCheckerIntegrity(value: typeof snapshot) {
  validateCheckerSnapshot(value);
  // Pinned after verifying the export against the original frozen holder file.
  // Totals alone cannot detect balances moved between two owners.
  if (createHash('sha256').update(JSON.stringify(value)).digest('hex') !== '0832302f437304149ae690872b94bbf1d0730d8cc7de81da3c5259656265928b') throw Error('Checker snapshot content mismatch');
}
validateCheckerIntegrity(snapshot);
const unavailable: CurrentBalance = { status: 'unavailable', amountRaw: null, slot: null, checkedAt: null };
const notRequested: CurrentBalance = { status: 'not-requested', amountRaw: null, slot: null, checkedAt: null };
const tokenProgram = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

type TokenRow = { pubkey: string; account: { owner: string; data: { program: string; parsed: { type: string; info: { mint: string; owner: string; state: string; tokenAmount: { amount: string; decimals: number } } } } } };
export async function readCurrentOldHive(owner: string, endpoint: string | undefined, request: typeof fetch = fetch): Promise<CurrentBalance> {
  publicSolanaAddress(owner);
  if (!endpoint) return unavailable;
  try {
    const rpc = async (method: string, params: unknown[]) => {
      const response = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error('RPC unavailable');
      const data = await response.json();
      if (data.error || data.result == null) throw Error('RPC response unavailable');
      return data.result;
    };
    const [genesis, data] = await Promise.all([
      rpc('getGenesisHash', []),
      rpc('getTokenAccountsByOwner', [owner, { mint: reimbursementCampaign.sourceMint }, { encoding: 'jsonParsed', commitment: 'finalized', minContextSlot: reimbursementCampaign.snapshotSlot }]),
    ]);
    if (genesis !== '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d' || !Number.isSafeInteger(data.context?.slot) || data.context.slot < reimbursementCampaign.snapshotSlot || !Array.isArray(data.value)) throw Error('Wrong chain or stale balance');
    let amount = 0n; const seen = new Set<string>();
    for (const row of data.value as TokenRow[]) {
      const address = publicSolanaAddress(row.pubkey), info = row.account?.data?.parsed?.info;
      if (seen.has(address) || row.account.owner !== tokenProgram || row.account.data.program !== 'spl-token' || row.account.data.parsed.type !== 'account' || info?.mint !== reimbursementCampaign.sourceMint || info.owner !== owner || !['initialized', 'frozen'].includes(info.state) || info.tokenAmount?.decimals !== 9 || typeof info.tokenAmount.amount !== 'string' || !/^(0|[1-9][0-9]*)$/.test(info.tokenAmount.amount) || BigInt(info.tokenAmount.amount) >= 2n ** 64n) throw Error('Invalid token account');
      seen.add(address);
      if (info.state === 'initialized') amount += BigInt(info.tokenAmount.amount);
    }
    return { status: 'available', amountRaw: amount.toString(), slot: data.context.slot, checkedAt: new Date().toISOString() };
  } catch { return unavailable; } // Never expose RPC URLs/credentials or turn a failed read into zero.
}
export async function getReimbursementLookup(owner: string) {
  publicSolanaAddress(owner);
  const row = snapshot.holders.find(h => h.owner === owner);
  const balance = row?.kind === 'wallet' ? await readCurrentOldHive(owner, process.env.SOLANA_RPC_URL) : notRequested;
  return lookupReimbursement(snapshot, owner, balance);
}

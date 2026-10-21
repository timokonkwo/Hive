import { BorshInstructionCoder, type Idl } from '@coral-xyz/anchor';
import { ComputeBudgetInstruction, ComputeBudgetProgram, PublicKey, SystemInstruction, SystemProgram, TransactionMessage, VersionedTransaction, type Connection } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { ManagedFeeClient } from '../agent-fees';
import feeIdl from './idl/bags-fee-share-v2.json';
import { BagsLaunchApi, readBagsTransaction } from './bags';
import { BAGS_FEE_PROGRAM } from './bags-fee-config';
import { HIVE_SOLANA_FEE_WALLET, SessionConflict } from './session';
import { validSolanaAddress } from './platforms';
import { requiresSigner, SOLANA_MAINNET_GENESIS, verifySignedTransaction } from './solana-journal';
import { signManagedSolana } from './solana-signer';

const coder = new BorshInstructionCoder(feeIdl as Idl);
const fail = (): never => { throw new SessionConflict('Bags fee collection could not be verified. Refresh and try again.'); };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail();
const amount = (value: unknown) => typeof value === 'string' && /^\d{1,30}$/.test(value) ? BigInt(value) : fail();

/** Accrued token balances are already inside the aggregate vault; count them once. */
export function readDeployerFees(value: unknown, wallet: string) {
  const data = object(value);
  if (data.wallet !== wallet || data.quoteMint !== NATIVE_MINT.toBase58() || !Array.isArray(data.positions)) fail();
  const mints = new Set<string>(); let pending = 0n, accrued = 0n;
  for (const item of data.positions as unknown[]) {
    const row = object(item);
    if (!validSolanaAddress(row.tokenMint) || mints.has(row.tokenMint)) fail();
    mints.add(row.tokenMint as string);
    const pools = amount(row.pendingDbcLamports) + amount(row.pendingDammLamports);
    const stored = amount(row.accruedLamports);
    if (amount(row.totalClaimableLamports) !== pools + stored) fail();
    pending += pools; accrued += stored;
  }
  const vault = amount(data.vaultClaimableLamports), total = amount(data.totalClaimableLamports);
  if (vault !== accrued + amount(data.unattributedVaultLamports) || total !== vault + pending) fail();
  return { total, mints };
}

type Seed = { kind: string; value?: number[]; path?: string };
type AccountDefinition = { name: string; address?: string; optional?: boolean; writable?: boolean; signer?: boolean; pda?: { seeds: Seed[]; program?: Seed } };

/** Only native-SOL collection into this deployer's vault/wallet can be signed. */
export async function validateDeployerClaim(connection: Connection, transaction: VersionedTransaction, mints: Set<string>, wallet = HIVE_SOLANA_FEE_WALLET) {
  if (!requiresSigner(transaction, wallet)) fail();
  const recipient = new PublicKey(wallet), sponsor = transaction.message.staticAccountKeys[0];
  if (transaction.message.staticAccountKeys.slice(0, transaction.message.header.numRequiredSignatures).some(key => !key.equals(recipient) && !key.equals(sponsor))) fail();
  const tables = await Promise.all(transaction.message.addressTableLookups.map(async lookup => {
    const table = (await connection.getAddressLookupTable(lookup.accountKey)).value;
    if (!table) fail(); return table!;
  }));
  const instructions = TransactionMessage.decompile(transaction.message, { addressLookupTableAccounts: tables }).instructions;
  let borrowed = 0n, repaid = 0n, withdrawn = false, closed = false;
  const operations = new Set<string>();
  for (const ix of instructions) {
    if (ix.programId.equals(ComputeBudgetProgram.programId)) {
      const type = ComputeBudgetInstruction.decodeInstructionType(ix);
      if (type === 'SetComputeUnitLimit') { if (ComputeBudgetInstruction.decodeSetComputeUnitLimit(ix).units > 1_400_000) fail(); }
      else if (type === 'SetComputeUnitPrice') { if (BigInt(ComputeBudgetInstruction.decodeSetComputeUnitPrice(ix).microLamports) > 1_000_000n) fail(); }
      else fail();
      continue;
    }
    if (ix.programId.equals(SystemProgram.programId)) {
      if (SystemInstruction.decodeInstructionType(ix) !== 'Transfer' || ix.keys.length !== 2 || sponsor.equals(recipient)) fail();
      const transfer = SystemInstruction.decodeTransfer(ix);
      if (transfer.fromPubkey.equals(sponsor) && transfer.toPubkey.equals(recipient) && !withdrawn) borrowed += BigInt(transfer.lamports);
      else if (transfer.fromPubkey.equals(recipient) && transfer.toPubkey.equals(sponsor) && withdrawn) repaid += BigInt(transfer.lamports);
      else fail();
      continue;
    }
    if (ix.programId.equals(TOKEN_PROGRAM_ID)) {
      // Unwrap only the deployer's WSOL, sending rent and SOL to that same wallet.
      if (!withdrawn || closed || ix.data.length !== 1 || ix.data[0] !== 9 || ix.keys.length !== 3
        || !ix.keys[0].pubkey.equals(getAssociatedTokenAddressSync(NATIVE_MINT, recipient))
        || !ix.keys[1].pubkey.equals(recipient) || !ix.keys[2].pubkey.equals(recipient)) fail();
      closed = true; continue;
    }
    if (!ix.programId.equals(BAGS_FEE_PROGRAM) || withdrawn) fail();
    const decoded = coder.decode(ix.data);
    if (!decoded || !['claim_dbc_with_deployer', 'claim_damm_v2_with_deployer', 'claim_deployer'].includes(decoded.name)
      || !coder.encode(decoded.name, decoded.data).equals(ix.data)) fail();
    const definition = feeIdl.instructions.find(item => item.name === decoded!.name)!;
    if (ix.keys.length !== definition.accounts.length) fail();
    const accounts = Object.fromEntries(definition.accounts.map((entry, index) => [entry.name, ix.keys[index].pubkey]));
    if (!accounts.payer.equals(recipient) || !accounts.deployer.equals(recipient) || !accounts.quote_mint.equals(NATIVE_MINT)
      || !accounts.token_program.equals(TOKEN_PROGRAM_ID) || !accounts.program.equals(BAGS_FEE_PROGRAM)) fail();
    if (accounts.token_quote_program && !accounts.token_quote_program.equals(TOKEN_PROGRAM_ID)) fail();
    if (accounts.base_mint && !mints.has(accounts.base_mint.toBase58())) fail();
    const identity = `${decoded!.name}:${accounts.base_mint?.toBase58() || wallet}`;
    if (operations.has(identity)) fail(); operations.add(identity);
    definition.accounts.forEach((item, index) => {
      const entry = item as AccountDefinition, key = ix.keys[index];
      if (entry.optional) { if (!key.pubkey.equals(BAGS_FEE_PROGRAM)) fail(); return; }
      if ((entry.signer && !key.isSigner) || (entry.writable && !key.isWritable)) fail();
      if (entry.address && key.pubkey.toBase58() !== entry.address) fail();
      if (entry.pda) {
        const bytes = (seed: Seed): Buffer => seed.kind === 'const' && seed.value ? Buffer.from(seed.value)
          : seed.kind === 'account' && seed.path && accounts[seed.path] ? accounts[seed.path].toBuffer() : fail();
        const program = entry.pda.program ? new PublicKey(bytes(entry.pda.program)) : BAGS_FEE_PROGRAM;
        const expected = PublicKey.findProgramAddressSync(entry.pda.seeds.map(bytes), program)[0];
        if (!key.pubkey.equals(expected)) fail();
      }
      // Pool/config/vault accounts are further constrained by the fixed on-chain
      // collection instruction; they must never alias the signing wallet.
      if (!['payer', 'deployer'].includes(entry.name) && key.pubkey.equals(recipient)) fail();
    });
    if (decoded!.name === 'claim_deployer') withdrawn = true;
  }
  if (!withdrawn || repaid < borrowed || repaid - borrowed > 100_000n) fail();
}

export class BagsDeployerFeeClient implements ManagedFeeClient {
  readonly source = 'bags-deployer' as const;
  private mints = new Set<string>();
  constructor(readonly connection: Connection, private api = new BagsLaunchApi(process.env.BAGS_AGENT_API_KEY || '')) {}
  getWalletAddress() { return HIVE_SOLANA_FEE_WALLET; }
  async getClaimablePositions() {
    const fees = readDeployerFees(await this.api.deployerFees(this.getWalletAddress()), this.getWalletAddress());
    this.mints = fees.mints;
    return [{ baseMint: this.getWalletAddress(), totalClaimableLamportsUserShare: fees.total.toString() }];
  }
  async prepareClaimTransactions(id: string) {
    if (id !== this.getWalletAddress() || await this.connection.getGenesisHash() !== SOLANA_MAINNET_GENESIS) fail();
    // One atomic sweep/withdrawal per request avoids stale plans spending the
    // same aggregate vault twice. Refresh exposes any remaining positions.
    const data = object(await this.api.post('/fee-share/deployer/claim-txs', { wallet: id, maxTransactions: 1 }));
    if (data.wallet !== id || data.quoteMint !== NATIVE_MINT.toBase58() || data.transactionVersion !== 0 || !Array.isArray(data.transactions) || data.transactions.length > 1) fail();
    const transactions = data.transactions as unknown[];
    if (!transactions.length && Array.isArray(data.deferredClaims) && data.deferredClaims.length) throw new SessionConflict('The Solana fee wallet needs SOL before these fees can be collected.');
    const result = [];
    for (const row of transactions) {
      const { transaction, lifetime } = readBagsTransaction(row);
      if (!lifetime) fail();
      await validateDeployerClaim(this.connection, transaction, this.mints);
      const [before, simulation, height] = await Promise.all([
        this.connection.getBalance(new PublicKey(id), 'confirmed'),
        this.connection.simulateTransaction(transaction, { sigVerify: false, commitment: 'confirmed', accounts: { encoding: 'base64', addresses: [id] } }),
        this.connection.getBlockHeight('confirmed'),
      ]);
      const after = simulation.value.accounts?.[0]?.lamports;
      if (simulation.value.err || height > lifetime!.lastValidBlockHeight || !Number.isSafeInteger(before) || !Number.isSafeInteger(after) || BigInt(before) - BigInt(after!) > 10_000_000n) fail();
      result.push({ transaction, blockhash: lifetime! });
    }
    return result;
  }
  signTransaction(transaction: VersionedTransaction) {
    const original = VersionedTransaction.deserialize(transaction.serialize());
    const signed = signManagedSolana(transaction);
    verifySignedTransaction(original, signed);
    return signed;
  }
}

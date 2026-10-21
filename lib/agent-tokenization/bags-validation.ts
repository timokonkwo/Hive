import { BorshAccountsCoder, BorshInstructionCoder, type Idl } from '@coral-xyz/anchor';
import { createHash } from 'node:crypto';
import { ComputeBudgetProgram, Connection, PublicKey, SystemInstruction, SystemProgram, TransactionMessage, type TransactionInstruction, VersionedTransaction } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getMint } from '@solana/spl-token';
import feeIdl from './idl/bags-fee-share-v2.json';
import dbcIdl from '@bagsfm/bags-sdk/dist/idl/dynamic-bonding-curve/idl.json';
import { HIVE_SOLANA_FEE_WALLET, SessionConflict } from './session';
import type { AgentTokenMetadata } from './types';
import type { SolanaStep } from './solana-journal';
import type { AgentToken } from './platforms';
import { bagsAuthority, bagsConfigAddress, validateBagsFeeInstruction, verifyBagsFeeState } from './bags-fee-config';
export { bagsAuthority, bagsConfigAddress } from './bags-fee-config';

const FEE = new PublicKey(feeIdl.address), DBC = new PublicKey(dbcIdl.address);
const dbcCoder = new BorshInstructionCoder(dbcIdl as Idl);
const accounts = new BorshAccountsCoder(dbcIdl as Idl);
// Official Bags SDK constant: its platform receives any post-migration remainder.
const BAGS_CREATION_AUTHORITY = new PublicKey('BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv');
// Standard 2% SOL configuration from the current official API, verified by unsigned
// mainnet simulation. Pin every creation parameter, including supply/curve/vesting.
const STANDARD_CONFIG_INSTRUCTION_SHA256 = 'cbe56dcc0758164778e6c6c2db59a30a15ad6fe5e80d9a4c5be00f4b876acdc7';
const fail = () => { throw new SessionConflict('The Bags transaction differs from the reviewed launch.'); };
const same = (a: PublicKey | undefined, b: string | PublicKey) => !!a && a.equals(typeof b === 'string' ? new PublicKey(b) : b);

export interface BagsTerms { mint: string; payer: string; config: string; authority: string; uri: string; metadata: AgentTokenMetadata; purchase: bigint }
export type BagsSetupKind = 'fee-config' | 'pool-config' | 'manager';
async function instructions(connection: Connection, transaction: VersionedTransaction) {
  const tables = await Promise.all((transaction.message.addressTableLookups || []).map(async lookup => {
    const table = (await connection.getAddressLookupTable(lookup.accountKey)).value;
    if (!table || table.state.deactivationSlot !== 0xffffffffffffffffn) throw new SessionConflict('A Bags address table is unavailable.');
    return table;
  }));
  return TransactionMessage.decompile(transaction.message, { addressLookupTableAccounts: tables }).instructions;
}
function account(ix: TransactionInstruction, index: number, expected: string | PublicKey) { if (!same(ix.keys[index]?.pubkey, expected)) fail(); }
function programs(ix: TransactionInstruction, definition: { accounts: { name: string; address?: string }[] }) {
  definition.accounts.forEach((a, i) => { if (a.address) account(ix, i, a.address); });
}
/** Only the immutable standard SOL fee structure is accepted. */
function standardFees(config: Record<string, any>, persisted: boolean) {
  const base = config.pool_fees?.base_fee;
  if (!base || String(base.cliff_fee_numerator) !== '20000000' || Number(base.base_fee_mode) !== 0
    || Number(base.first_factor) !== 0 || String(base.second_factor) !== '0' || String(base.third_factor) !== '0') fail();
  const migrated = persisted ? config.migrated_pool_fee_bps : config.migrated_pool_fee?.pool_fee_bps;
  if (Number(migrated) !== 200) fail();
  if (Number(config.collect_fee_mode)!==0 || Number(config.migration_option)!==1 || Number(config.token_type)!==0
    || Number(config.token_decimal)!==9 || Number(config.token_update_authority)!==0 || Number(config.creator_trading_fee_percentage)!==0
    || Number(config.partner_locked_lp_percentage)!==100 || Number(config.partner_lp_percentage)!==0
    || Number(config.creator_lp_percentage)!==0 || Number(config.creator_locked_lp_percentage)!==0
    || String(config.migration_quote_threshold)!=='85000000000') fail();
}

/** Decode every instruction. Merely recognizing program IDs or simulating is insufficient. */
export async function validateBagsTransaction(connection: Connection, transaction: VersionedTransaction, terms: BagsTerms, stage: 'setup' | 'launch') {
  const signers = transaction.message.staticAccountKeys.slice(0,transaction.message.header.numRequiredSignatures);
  if (!signers.some(key=>same(key,terms.payer)) || !same(bagsAuthority(terms.mint), terms.authority)) fail();
  const ixs = await instructions(connection, transaction);
  const payer = new PublicKey(terms.payer), mint = new PublicKey(terms.mint);
  const quoteAta = getAssociatedTokenAddressSync(NATIVE_MINT, payer);
  let creates = 0, swaps = 0, funding = 0n, meaningful = 0;
  let pool: string | undefined, tokenProgram = TOKEN_PROGRAM_ID;
  let setupKind: BagsSetupKind | undefined, sponsor: PublicKey | undefined, reimbursement = 0n, launchReimbursement = 0n;
  for (const ix of ixs) {
    if (ix.programId.equals(ComputeBudgetProgram.programId)) {
      // Bound priority costs independently of simulation. No heap/loaded-data overrides.
      if (ix.data[0] === 2 && ix.data.length === 5 && ix.data.readUInt32LE(1) <= 1_400_000) continue;
      if (ix.data[0] === 3 && ix.data.length === 9 && ix.data.readBigUInt64LE(1) <= 1_000_000n) continue;
      fail();
    }
    if (ix.programId.equals(FEE)) {
      if (stage !== 'setup') fail();
      const checked = await validateBagsFeeInstruction(connection, ix, terms.mint, terms.payer);
      setupKind = checked.kind; sponsor = checked.admin;
      meaningful++; continue;
    }
    if (ix.programId.equals(DBC)) {
      const decoded = dbcCoder.decode(ix.data); if (!decoded) fail();
      programs(ix, dbcIdl.instructions.find(i => i.name === decoded!.name)!);
      if (decoded!.name === 'create_config' && stage === 'setup') {
        const config = (decoded!.data as { config_parameters: Record<string, any> }).config_parameters;
        if (createHash('sha256').update(ix.data).digest('hex') !== STANDARD_CONFIG_INSTRUCTION_SHA256) fail();
        standardFees(config, false);
        if (ix.keys.length !== 8 || !same(transaction.message.staticAccountKeys[0],payer)) fail();
        account(ix, 0, terms.config); account(ix, 1, terms.authority); account(ix, 2, BAGS_CREATION_AUTHORITY); account(ix, 3, NATIVE_MINT); account(ix, 4, payer);
        account(ix,6,PublicKey.findProgramAddressSync([Buffer.from('__event_authority')],DBC)[0]); account(ix,7,DBC);
        setupKind = 'pool-config';
      } else if (stage === 'launch' && ['initialize_virtual_pool_with_spl_token', 'initialize_virtual_pool_with_token2022'].includes(decoded!.name)) {
        if (++creates !== 1) fail();
        const params = (decoded!.data as { params: { name: string; symbol: string; uri: string } }).params;
        if (params.name !== terms.metadata.name || params.symbol !== terms.metadata.symbol || params.uri !== terms.uri) fail();
        const spl = decoded!.name.endsWith('spl_token'); tokenProgram = spl ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
        account(ix, 0, terms.config); account(ix, 2, BAGS_CREATION_AUTHORITY); account(ix, 3, mint); account(ix, 4, NATIVE_MINT);
        account(ix, spl ? 10 : 8, BAGS_CREATION_AUTHORITY);
        account(ix, spl ? 12 : 10, tokenProgram);
        pool = ix.keys[5].pubkey.toBase58();
      } else if (stage === 'launch' && decoded!.name === 'swap') {
        if (++swaps !== 1 || !pool || terms.purchase === 0n) fail();
        const params = (decoded!.data as { params: { amount_in: { toString(): string }; minimum_amount_out: { toString(): string } } }).params;
        // This buy is atomic with creating the new pool at the pinned initial curve.
        // No earlier trade can change its price; Bags encodes zero minimum output.
        if (BigInt(params.amount_in.toString()) !== terms.purchase || BigInt(params.minimum_amount_out.toString()) < 0n) fail();
        account(ix, 1, terms.config); account(ix, 2, pool!); account(ix, 3, quoteAta);
        account(ix, 4, getAssociatedTokenAddressSync(mint, payer, false, tokenProgram));
        account(ix, 7, mint); account(ix, 8, NATIVE_MINT); account(ix, 9, payer); account(ix, 12, DBC);
      } else fail();
      meaningful++; continue;
    }
    if (stage === 'setup' && ix.programId.equals(SystemProgram.programId)) {
      if (SystemInstruction.decodeInstructionType(ix) !== 'Transfer' || setupKind !== 'fee-config' || !sponsor) fail();
      const transfer = SystemInstruction.decodeTransfer(ix);
      if (!same(transfer.fromPubkey,payer) || !same(transfer.toPubkey,sponsor!)) fail();
      reimbursement += BigInt(transfer.lamports);
      // Bounded sponsor reimbursement, included in the wallet's simulated debit review.
      if (reimbursement > 50_000n) fail();
      continue;
    }
    if (stage === 'launch' && ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
      if (ix.data.length > 1 || (ix.data.length === 1 && ![0, 1].includes(ix.data[0]))) fail();
      account(ix, 0, payer); account(ix, 2, payer);
      const asset = ix.keys[3]?.pubkey, program = ix.keys[5]?.pubkey;
      if (!asset || !program || !(asset.equals(NATIVE_MINT) || asset.equals(mint)) || !(program.equals(TOKEN_PROGRAM_ID) || program.equals(TOKEN_2022_PROGRAM_ID))) fail();
      account(ix, 1, getAssociatedTokenAddressSync(asset!, payer, false, program)); continue;
    }
    if (stage === 'launch' && ix.programId.equals(SystemProgram.programId)) {
      if (SystemInstruction.decodeInstructionType(ix) !== 'Transfer') fail();
      const transfer = SystemInstruction.decodeTransfer(ix);
      if (!same(transfer.fromPubkey, payer)) fail();
      if (same(transfer.toPubkey,BAGS_CREATION_AUTHORITY)) {
        launchReimbursement += BigInt(transfer.lamports);
        if (launchReimbursement > 50_000_000n) fail();
        continue;
      }
      if (!same(transfer.toPubkey, quoteAta)) fail();
      funding += BigInt(transfer.lamports); if (funding > terms.purchase) fail(); continue;
    }
    if (stage === 'launch' && ix.programId.equals(TOKEN_PROGRAM_ID)) {
      if (ix.data.length === 1 && ix.data[0] === 17) { account(ix, 0, quoteAta); continue; }
      if (ix.data.length === 1 && ix.data[0] === 9) { account(ix, 0, quoteAta); account(ix, 1, payer); account(ix, 2, payer); continue; }
    }
    fail();
  }
  if (!meaningful || (stage === 'setup' && meaningful !== 1) || (stage === 'launch' && (creates !== 1 || swaps !== (terms.purchase > 0n ? 1 : 0)))) fail();
  const feePayer = transaction.message.staticAccountKeys[0];
  if (!same(feePayer,payer) && (!sponsor || !same(feePayer,sponsor)) && !(stage === 'launch' && same(feePayer,BAGS_CREATION_AUTHORITY))) fail();
  const allowedSigners = [payer,...(sponsor ? [sponsor] : []),...(setupKind === 'pool-config' ? [new PublicKey(terms.config)] : []),...(stage === 'launch' ? [mint,BAGS_CREATION_AUTHORITY] : [])];
  if (signers.some(key=>!allowedSigners.some(allowed=>same(key,allowed)))) fail();
  return { pool, tokenProgram: tokenProgram.toBase58(), setupKind };
}

export async function verifyBagsConfiguration(connection: Connection, terms: BagsTerms) {
  const config = await connection.getAccountInfo(new PublicKey(terms.config), 'finalized');
  if (!config?.owner.equals(DBC)) fail();
  const state = accounts.decode('PoolConfig', config!.data) as Record<string, any>;
  if (!same(state.quote_mint, NATIVE_MINT) || !same(state.fee_claimer, terms.authority) || !same(state.leftover_receiver,BAGS_CREATION_AUTHORITY)) fail();
  standardFees(state, true);
  await verifyBagsFeeState(connection, terms.mint, terms.payer);
}
export async function verifyBagsLaunch(connection: Connection, step: SolanaStep, terms: BagsTerms): Promise<AgentToken> {
  if (step.phase !== 'confirmed' || !step.signature || !step.slot) throw new SessionConflict('The Bags launch is not finalized.');
  const transaction = VersionedTransaction.deserialize(Buffer.from(step.review.transaction, 'base64'));
  const result = await validateBagsTransaction(connection, transaction, terms, 'launch');
  await verifyBagsConfiguration(connection, terms);
  const pool = await connection.getAccountInfo(new PublicKey(result.pool!), 'finalized');
  if (!pool?.owner.equals(DBC)) fail();
  const state = accounts.decode('VirtualPool', pool!.data) as Record<string, any>;
  if (!same(state.base_mint, terms.mint) || !same(state.config, terms.config)) fail();
  const mint = await getMint(connection, new PublicKey(terms.mint), 'finalized', new PublicKey(result.tokenProgram));
  if (!mint.isInitialized || mint.supply <= 0n) fail();
  const block = await connection.getBlockTime(step.slot);
  return { platform: 'bags', network: 'solana', address: terms.mint, symbol: terms.metadata.symbol, transactionHash: step.signature,
    ...(block ? { launchedAt: new Date(block * 1000).toISOString() } : {}) };
}

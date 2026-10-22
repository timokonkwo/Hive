import { BN } from '@coral-xyz/anchor';
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { getMint, getTokenMetadata, NATIVE_MINT, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { PUMP_SDK, PUMP_PROGRAM_ID, OnlinePumpSdk, bondingCurvePda, getBuyTokenAmountFromSolAmount, pumpIdl } from '@pump-fun/pump-sdk';
import type { Db } from 'mongodb';
import type { AgentTokenMetadata } from './types';
import type { AgentToken } from './platforms';
import { HIVE_SOLANA_FEE_WALLET, SessionConflict } from './session';
import { openValue, sealValue, SOLANA_MAINNET_GENESIS, type SealedValue, type SolanaStep } from './solana-journal';

interface PumpMint {
  _id: string; agentId: string; sessionId: string; address: string; secret: SealedValue; createdAt: Date;
}

/** Reserve the mint before any builder/signature. A restart reuses this identity. */
export async function reservePumpMint(db: Db, intentId: string, agentId: string, sessionId: string): Promise<Keypair> {
  const collection = db.collection<PumpMint>('agent_launch_pump_mints');
  const existing = await collection.findOne({ _id: intentId });
  if (existing) {
    if (existing.agentId !== agentId || existing.sessionId !== sessionId) throw new SessionConflict('This mint belongs to another launch.');
    const mint = Keypair.fromSecretKey(openValue(existing.secret, `mint:${intentId}`));
    if (mint.publicKey.toBase58() !== existing.address) throw new SessionConflict('The saved mint does not match.');
    return mint;
  }
  const mint = Keypair.generate();
  const record: PumpMint = { _id: intentId, agentId, sessionId, address: mint.publicKey.toBase58(),
    secret: sealValue(mint.secretKey, `mint:${intentId}`), createdAt: new Date() };
  try { await collection.insertOne(record); return mint; }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return reservePumpMint(db, intentId, agentId, sessionId);
    throw error;
  }
}

export interface PumpLaunchInput {
  mint: Keypair; payer: PublicKey; recipient?: string; metadata: AgentTokenMetadata; uri: string; purchase: bigint;
}

/** Official pinned SDK only. No remote unsigned transaction or arbitrary instruction injection. */
export async function buildPumpLaunch(connection: Connection, input: PumpLaunchInput) {
  if (await connection.getGenesisHash() !== SOLANA_MAINNET_GENESIS) throw new SessionConflict('The RPC is not connected to Solana mainnet.');
  if (new TextEncoder().encode(input.metadata.name).length > 32 || !input.metadata.name.trim()
    || !/^[A-Z0-9]{1,10}$/.test(input.metadata.symbol) || new TextEncoder().encode(input.uri).length > 200
    || !/^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/raw\/upload\/v[1-9][0-9]*\/hive-agent-tokens\/[a-f0-9]{64}\.json$/i.test(input.uri)
    || input.purchase < 0n || input.purchase > BigInt(Number.MAX_SAFE_INTEGER)) throw new SessionConflict('Review the token metadata and opening purchase.');
  if (await connection.getAccountInfo(input.mint.publicKey, 'confirmed')) throw new SessionConflict('This mint already exists. Check the previous launch.');
  const common = { mint: input.mint.publicKey, name: input.metadata.name, symbol: input.metadata.symbol, uri: input.uri,
    creator: new PublicKey(input.recipient || HIVE_SOLANA_FEE_WALLET), user: input.payer, mayhemMode: false, cashback: false, holderReward: false };
  let instructions;
  if (input.purchase === 0n) instructions = [await PUMP_SDK.createV2Instruction(common)];
  else {
    const online = new OnlinePumpSdk(connection);
    const [global, feeConfig] = await Promise.all([online.fetchGlobal(), online.fetchFeeConfig()]);
    const budget = new BN(input.purchase.toString());
    const quote = getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply: null, bondingCurve: null, amount: budget, quoteMint: NATIVE_MINT });
    // A maximum input, 1% output tolerance, no platform fee override or agent-payment side effects.
    const amount = quote.muln(99).divn(100);
    if (amount.isZero()) throw new SessionConflict('The opening purchase is too small.');
    // The official helper adds floor(1%) to its SOL input. Compensate using integer
    // division so its resulting maximum cannot exceed the user's purchase cap.
    const sdkBudget = budget.muln(100).divn(101);
    instructions = await PUMP_SDK.createV2AndBuyInstructions({
      ...common, global, amount, solAmount: sdkBudget, isTokenizedAgent: false,
    });
  }
  const lifetime = await connection.getLatestBlockhash('confirmed');
  const message = new TransactionMessage({
    payerKey: input.payer, recentBlockhash: lifetime.blockhash,
    instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units: input.purchase === 0n ? 300_000 : 500_000 }), ...instructions],
  });
  // Compile with the table before serialization. An oversized uncompressed
  // message can throw during serialize(), before a size check can run.
  const tables = [];
  if (input.purchase > 0n) {
    if (!process.env.PUMP_LAUNCH_LOOKUP_TABLE) throw new SessionConflict('pump.fun purchases are temporarily unavailable. Try again later.');
    const table = (await connection.getAddressLookupTable(new PublicKey(process.env.PUMP_LAUNCH_LOOKUP_TABLE), { commitment: 'finalized' })).value;
    if (!table?.isActive()) throw new SessionConflict('The launch address table is unavailable. Try again later.');
    tables.push(table);
  }
  const transaction = new VersionedTransaction(message.compileToV0Message(tables));
  let size: number;
  try { size = transaction.serialize().length; } catch { throw new SessionConflict('The launch transaction is too large.'); }
  if (size > 1232) throw new SessionConflict('The launch transaction is too large.');
  transaction.sign([input.mint]);
  return { transaction, lifetime };
}

/** Parse events only while the actual Pump program is executing, ignoring nested program data. */
export function pumpCreateEvents(logs: string[]) {
  const stack: string[] = [], events: ReturnType<typeof PUMP_SDK.decodeCreateEventBc>[] = [];
  const discriminator = Buffer.from(pumpIdl.events.find(event => event.name === 'CreateEvent')!.discriminator);
  for (const line of logs) {
    const invoke = /^Program ([1-9A-HJ-NP-Za-km-z]+) invoke \[(\d+)\]$/.exec(line);
    if (invoke) { stack.length = Number(invoke[2]) - 1; stack.push(invoke[1]); continue; }
    const end = /^Program ([1-9A-HJ-NP-Za-km-z]+) (?:success|failed:.*)$/.exec(line);
    if (end) { if (stack.at(-1) === end[1]) stack.pop(); else stack.length = 0; continue; }
    if (stack.at(-1) !== PUMP_PROGRAM_ID.toBase58() || !line.startsWith('Program data: ')) continue;
    const data = Buffer.from(line.slice(14), 'base64');
    if (!data.subarray(0, 8).equals(discriminator)) continue;
    try { events.push(PUMP_SDK.decodeCreateEventBc(data.subarray(8))); } catch { /* Truncated/invalid events never publish a token. */ }
  }
  return events;
}

/** The shared journal verifies the exact finalized message first; this verifies the platform result. */
export async function verifyPumpLaunch(connection: Connection, step: SolanaStep, metadata: AgentTokenMetadata, uri: string, recipient = HIVE_SOLANA_FEE_WALLET): Promise<AgentToken> {
  if (step.phase !== 'confirmed' || !step.signature || !step.slot) throw new SessionConflict('The launch transaction is not finalized.');
  const receipt = await connection.getTransaction(step.signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
  if (!receipt || receipt.slot !== step.slot || !receipt.meta || receipt.meta.err) throw new SessionConflict('The launch receipt is unavailable.');
  const events = pumpCreateEvents(receipt.meta.logMessages || []);
  const mint = new PublicKey(step.mint), curve = bondingCurvePda(mint);
  const event = events[0];
  if (events.length !== 1 || !event.mint.equals(mint) || !event.bondingCurve.equals(curve) || event.user.toBase58() !== step.signer
    || event.creator.toBase58() !== recipient || event.name !== metadata.name || event.symbol !== metadata.symbol || event.uri !== uri
    || !event.tokenProgram.equals(TOKEN_2022_PROGRAM_ID) || event.isMayhemMode || event.isCashbackEnabled || event.isHolderReward
    || !event.creatorFeeBps.isZero() || event.depth !== 0 || (!event.quoteMint.equals(PublicKey.default) && !event.quoteMint.equals(NATIVE_MINT))) {
    throw new SessionConflict('The pump.fun token does not match this launch.');
  }
  const [mintState, tokenMetadata, curveAccount] = await Promise.all([
    getMint(connection, mint, 'finalized', TOKEN_2022_PROGRAM_ID),
    getTokenMetadata(connection, mint, 'finalized', TOKEN_2022_PROGRAM_ID),
    connection.getAccountInfo(curve, 'finalized'),
  ]);
  if (mintState.decimals !== 6 || !mintState.isInitialized || !tokenMetadata || tokenMetadata.name !== metadata.name
    || tokenMetadata.symbol !== metadata.symbol || tokenMetadata.uri !== uri || !curveAccount?.owner.equals(PUMP_PROGRAM_ID)) {
    throw new SessionConflict('The token account or metadata could not be verified.');
  }
  const state = PUMP_SDK.decodeBondingCurve(curveAccount);
  if (state.creator.toBase58() !== recipient || state.isMayhemMode || state.isCashbackCoin || state.isHolderReward) {
    throw new SessionConflict('The pump.fun creator configuration changed.');
  }
  return { platform: 'pump', network: 'solana', address: step.mint, symbol: metadata.symbol, transactionHash: step.signature,
    ...(receipt.blockTime ? { launchedAt: new Date(receipt.blockTime * 1000).toISOString() } : {}) };
}

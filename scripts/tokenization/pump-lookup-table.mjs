// One-time Hive-owned transaction compression infrastructure. Never launches a token.
// Run `prepare`, review the printed rent/fee cap, then `apply`. Signed steps are
// journaled before broadcast and reused on resume; no private key leaves memory.
import env from '@next/env';
import { createRequire } from 'node:module';
import { MongoClient } from 'mongodb';
import { sessions, solanaRuntime, solanaJournal } from './modules.mjs';
const require = createRequire(import.meta.url);
const { AddressLookupTableProgram, Keypair, PublicKey, TransactionMessage, VersionedTransaction } = require('@solana/web3.js');
const { PUMP_SDK, OnlinePumpSdk } = require('@pump-fun/pump-sdk');
const { BN } = require('@coral-xyz/anchor');
const bs58 = require('bs58').default;
env.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const mode = process.argv[2] || 'prepare';
if (!['prepare', 'apply', 'status'].includes(mode)) throw Error('Use prepare, apply or status.');
const connection = solanaRuntime.launchConnection(), payer = new PublicKey(sessions.HIVE_SOLANA_FEE_WALLET);
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
try {
  if (await connection.getGenesisHash() !== solanaJournal.SOLANA_MAINNET_GENESIS) throw Error('Wrong network.');
  await client.connect(); const db = client.db(process.env.MONGODB_DB || 'hive');
  const records = db.collection('agent_launch_infrastructure'), journal = new solanaJournal.SolanaJournal(db);
  let plan = await records.findOne({ _id: 'pump-lookup-v1' });
  if (!plan && mode === 'prepare') {
    const global = await new OnlinePumpSdk(connection).fetchGlobal();
    const keys = async () => {
      const instructions = await PUMP_SDK.createV2AndBuyInstructions({ global, mint: Keypair.generate().publicKey,
        user: Keypair.generate().publicKey, creator: payer, name: 'Lookup preparation', symbol: 'LOOKUP', uri: 'https://uphive.xyz',
        amount: new BN(1), solAmount: new BN(1), mayhemMode: false, cashback: false, holderReward: false, isTokenizedAgent: false });
      return new Set(instructions.flatMap(ix => ix.keys.filter(key => !key.isSigner).map(key => key.pubkey.toBase58())));
    };
    // Intersect different mints/users so no per-launch account is assumed reusable.
    const [one, two] = await Promise.all([keys(), keys()]);
    const addresses = [...new Set([...one].filter(key => two.has(key)).concat(
      [global.feeRecipient, ...global.feeRecipients, ...global.buybackFeeRecipients].map(key => key.toBase58()),
    ))].sort();
    const recentSlot = await connection.getSlot('finalized');
    const [, key] = AddressLookupTableProgram.createLookupTable({ authority: payer, payer, recentSlot });
    plan = { _id: 'pump-lookup-v1', key: key.toBase58(), addresses, recentSlot, createdAt: new Date() };
    await records.insertOne(plan);
  }
  if (!plan) throw Error('Prepare the lookup table first.');
  const key = new PublicKey(plan.key), addresses = plan.addresses.map(value => new PublicKey(value));
  if (addresses.length > 64 || addresses.length < 8) throw Error('Unexpected lookup table size.');
  const rent = await connection.getMinimumBalanceForRentExemption(56 + addresses.length * 32);
  if (rent + 20000 > 20_000_000) throw Error('Lookup table exceeds the 0.02 SOL maintenance cap.');
  let table = (await connection.getAddressLookupTable(key, { commitment: 'finalized' })).value;
  console.log(JSON.stringify({ address: plan.key, entries: addresses.length, rentLamports: rent, maximumNetworkFeesLamports: 20000, exists: !!table }));
  if (mode !== 'apply') process.exitCode = 0;
  else {
    const raw = process.env.HIVE_AGENT_LAUNCH_KEYPAIR?.trim();
    const signer = Keypair.fromSecretKey(raw?.startsWith('[') ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw || ''));
    if (!signer.publicKey.equals(payer)) throw Error('Unexpected signer.');
    const [create, derived] = AddressLookupTableProgram.createLookupTable({ authority: payer, payer, recentSlot: plan.recentSlot });
    if (!derived.equals(key)) throw Error('Lookup identity changed.');
    const chunks = [];
    for (let i = 0; i < addresses.length; i += 20) chunks.push(addresses.slice(i, i + 20));
    for (let i = 0; i < chunks.length; i++) {
      table = (await connection.getAddressLookupTable(key, { commitment: 'finalized' })).value;
      if (table && (!table.isActive() || !table.state.authority?.equals(payer)
        || table.state.addresses.some((address, index) => !address.equals(addresses[index])))) throw Error('Lookup table state changed.');
      if ((table?.state.addresses.length || 0) >= Math.min((i + 1) * 20, addresses.length)) continue;
      const id = `infrastructure:pump-lookup:${plan.key}:${i}`;
      let step = await journal.get(id);
      if (step?.phase === 'failed') throw Error('Lookup transaction failed; inspect its saved receipt.');
      if (!step || (step.phase === 'review' && Date.parse(step.review.expiresAt) <= Date.now())) {
        const lifetime = await connection.getLatestBlockhash('confirmed');
        const instructions = [AddressLookupTableProgram.extendLookupTable({ authority: payer, payer, lookupTable: key, addresses: chunks[i] })];
        if (i === 0) instructions.unshift(create);
        const transaction = new VersionedTransaction(new TransactionMessage({ payerKey: payer, recentBlockhash: lifetime.blockhash, instructions }).compileToV0Message());
        const review = await solanaJournal.reviewSolanaTransaction(connection, transaction, payer.toBase58(), 20_000_000n, lifetime);
        console.log(JSON.stringify({ step: i, simulated: true, maximumDebitLamports: review.maximumDebit, bytes: transaction.serialize().length }));
        step = step ? await journal.refresh(step, review) : await journal.reserve({ _id: id, agentId: 'infrastructure', sessionId: 'pump-lookup-v1', intentId: plan.key,
          signer: payer.toBase58(), mint: plan.key, review, revision: 0, phase: 'review', createdAt: new Date() });
      }
      if (step.phase === 'review') {
        const transaction = VersionedTransaction.deserialize(Buffer.from(step.review.transaction, 'base64'));
        transaction.sign([signer]);
        step = await journal.authorize(step, step.review.digest, transaction.serialize(), connection);
      }
      if (step.phase === 'submitted') {
        await journal.broadcast(step, connection);
        await connection.confirmTransaction({ signature: step.signature, blockhash: step.review.blockhash, lastValidBlockHeight: step.review.lastValidBlockHeight }, 'finalized');
        step = await journal.reconcile(step, connection);
      }
      if (step.phase !== 'confirmed') throw Error('Lookup transaction is unresolved; rerun apply to check the saved transaction.');
      console.log(JSON.stringify({ step: i, finalized: true, signature: step.signature }));
    }
    table = (await connection.getAddressLookupTable(key, { commitment: 'finalized' })).value;
    if (!table?.isActive() || table.state.addresses.length !== addresses.length) throw Error('Lookup table is incomplete.');
    console.log(JSON.stringify({ ready: true, address: key.toBase58() }));
  }
} catch (error) {
  console.error(error instanceof sessions.SessionConflict ? error.message : 'Lookup setup did not finish; inspect the saved plan and receipts before retrying.');
  process.exitCode = 1;
} finally { await client.close(); }

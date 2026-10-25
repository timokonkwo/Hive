// Read-only chain inspection. The provider may prepare unsigned transactions; nothing is signed or sent.
import env from '@next/env';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { bagsLaunch, bagsValidation, sessions, solanaJournal } from './modules.mjs';
const require = createRequire(import.meta.url);
const { Connection, PublicKey, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } = require('@solana/web3.js');
const { BorshInstructionCoder } = require('@coral-xyz/anchor');
const feeIdl = require('../../lib/agent-tokenization/idl/bags-fee-share-v2.json');
const dbcIdl = require('@bagsfm/bags-sdk/dist/idl/dynamic-bonding-curve/idl.json');
env.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const inspectedFetch = async (...args) => {
  const response = await fetch(...args);
  if (response.ok && String(args[0]).endsWith('/fee-share/config')) {
    const body = await response.clone().json();
    writeFileSync('/tmp/hive-bags-setup-response.json', JSON.stringify(body.response));
    console.log(JSON.stringify({ responseKeys:Object.keys(body.response), needsCreation:body.response.needsCreation,
      transactions:body.response.transactions?.length, bundles:body.response.bundles?.map(b=>b.length) }));
  }
  if (!response.ok) {
    const body = await response.clone().json().catch(() => ({}));
    const message = JSON.stringify(body.error || body).replaceAll(process.env.BAGS_AGENT_API_KEY || '___', '[redacted]').replace(/https?:\/\/\S+/g, '[url]').slice(0, 1200);
    console.log(JSON.stringify({ providerStatus: response.status, message }));
  }
  return response;
};
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
try {
  const reservationPath = '/tmp/hive-bags-interface-reservation.json';
  const api = new bagsLaunch.BagsLaunchApi(process.env.BAGS_AGENT_API_KEY || '', inspectedFetch);
  if (!existsSync(reservationPath) || (process.argv.includes('--retry-metadata') && JSON.parse(readFileSync(reservationPath, 'utf8')).phase !== 'ready')) {
    if (!process.argv.includes('--reserve-metadata')) throw Error('Pass --reserve-metadata for one unlaunched provider metadata reservation.');
    writeFileSync(reservationPath, JSON.stringify({ phase: 'requesting' }));
    const result = await api.post('/token-launch/create-token-info', { name:'Hive integration check', symbol:'HVCHK',
      description:'Unlaunched metadata reservation for verifying the Hive Bags integration.', imageUrl:'https://uphive.xyz/agent.png', website:'https://uphive.xyz' });
    writeFileSync(reservationPath, JSON.stringify({ phase:'ready', mint:result.tokenMint, uri:result.tokenMetadata }));
  }
  const reservation = JSON.parse(readFileSync(reservationPath, 'utf8'));
  if (reservation.phase !== 'ready') throw Error('The previous metadata response must be recovered.');
  const mint = reservation.mint;
  const payer = sessions.HIVE_SOLANA_LAUNCH_WALLET;
  const setup = await bagsLaunch.prepareBagsConfiguration(api, mint, payer);
  console.log(JSON.stringify({ needsCreation: setup.needsCreation, steps: setup.steps.length, authorityMatches: setup.authority === bagsValidation.bagsAuthority(mint).toBase58() }));
  writeFileSync('/tmp/hive-bags-prepared-setup.json', JSON.stringify({ mint, payer, config:setup.config, authority:setup.authority, steps:setup.steps.map(s=>({ transaction:Buffer.from(s.transaction.serialize()).toString('base64'), lifetime:s.lifetime })) }));
  const tablesByAddress = {};
  const allInstructions=[], allTables=new Map();
  for (const [index,step] of setup.steps.entries()) {
    const tables = await Promise.all(step.transaction.message.addressTableLookups.map(async t => (await connection.getAddressLookupTable(t.accountKey)).value));
    for (const table of tables) tablesByAddress[table.key.toBase58()] = table.state.addresses.map(key=>key.toBase58());
    for (const table of tables) allTables.set(table.key.toBase58(),table);
    const ixs = TransactionMessage.decompile(step.transaction.message, { addressLookupTableAccounts: tables }).instructions;
    allInstructions.push(...ixs.filter(ix=>!ix.programId.equals(ComputeBudgetProgram.programId)));
    console.log(JSON.stringify(ixs.map(ix => {
      const idl = [feeIdl, dbcIdl].find(idl => idl.address === ix.programId.toBase58());
      const decoded = idl ? new BorshInstructionCoder(idl).decode(ix.data) : null;
      return { program: ix.programId.toBase58(), instruction: decoded?.name || [...ix.data.subarray(0, 8)], accounts: ix.keys.length };
    })));
    try {
      await bagsValidation.validateBagsTransaction(connection, step.transaction, { mint, payer, config: setup.config, authority: setup.authority, uri: '', metadata: { name: '', symbol: '' }, purchase: 0n }, 'setup');
      console.log('Setup validation passed.');
      if (index < 2) {
        const review = await solanaJournal.reviewSolanaTransaction(connection,step.transaction,payer,100_000_000n,step.lifetime);
        console.log(JSON.stringify({step:index,simulated:true,bytes:step.transaction.serialize().length,maximumDebit:review.maximumDebit,networkFee:review.networkFee}));
        if (index === 0) {
          const keys = ixs.find(ix=>ix.programId.toBase58()===feeIdl.address).keys;
          const addresses = [keys[3],keys[9],keys[10],keys[4]].map(k=>k.pubkey.toBase58());
          const simulated = await connection.simulateTransaction(step.transaction,{sigVerify:false,commitment:'confirmed',accounts:{encoding:'base64',addresses}});
          if (simulated.value.err) throw Error('Fee state simulation failed.');
          writeFileSync('/tmp/hive-bags-simulated-fee-state.json',JSON.stringify({mint,payer,addresses,accounts:simulated.value.accounts},null,2));
        }
      }
    } catch (error) { console.log(error instanceof sessions.SessionConflict ? error.message : 'Setup validation could not complete.'); }
  }
  // Simulate the dependency chain in one unsigned message. Never offer this
  // synthetic message for signing: provider signatures belong to separate steps.
  const combined = new VersionedTransaction(new TransactionMessage({payerKey:new PublicKey(payer),recentBlockhash:setup.steps[0].transaction.message.recentBlockhash,
    instructions:[ComputeBudgetProgram.setComputeUnitLimit({units:800000}),...allInstructions]}).compileToV0Message([...allTables.values()]));
  const simulated = await connection.simulateTransaction(combined,{sigVerify:false,commitment:'confirmed',accounts:{encoding:'base64',addresses:[setup.config]}});
  console.log(JSON.stringify({orderedSetupSimulation:simulated.value.err || 'passed',units:simulated.value.unitsConsumed,bytes:combined.serialize().length}));
  if (simulated.value.err) throw Error('Ordered setup simulation failed.');
  writeFileSync('/tmp/hive-bags-prepared-setup.json', JSON.stringify({ mint, payer, config:setup.config, authority:setup.authority, tables:tablesByAddress, steps:setup.steps.map(s=>({ transaction:Buffer.from(s.transaction.serialize()).toString('base64'), lifetime:s.lifetime })) },null,2));
} catch (error) { console.error(error instanceof sessions.SessionConflict ? error.message : 'Provider or RPC inspection failed.'); process.exitCode = 1; }

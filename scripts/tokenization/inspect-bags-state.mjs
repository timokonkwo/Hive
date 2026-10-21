// Inspect public launches and decoded chain state only. No writes, uploads, signatures or broadcasts.
import env from '@next/env';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { Connection, PublicKey } = require('@solana/web3.js');
const { BorshAccountsCoder, BorshInstructionCoder } = require('@coral-xyz/anchor');
const idl = require('@bagsfm/bags-sdk/dist/idl/dynamic-bonding-curve/idl.json');
const feeIdl = require('../../lib/agent-tokenization/idl/bags-fee-share-v2.json');
env.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
try {
 const response = await fetch('https://public-api-v2.bags.fm/api/v1/token-launch/feed', { headers: { 'x-api-key': process.env.BAGS_AGENT_API_KEY }, signal: AbortSignal.timeout(20000) });
 const body = await response.json();
 if (!response.ok || body.success !== true || !Array.isArray(body.response)) throw Error();
 const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
 const coder = new BorshAccountsCoder(idl);
 let inspected = 0;
 for (const row of body.response) {
  if (!row.dbcConfigKey || !row.launchSignature) continue;
  const info = await connection.getAccountInfo(new PublicKey(row.dbcConfigKey), 'finalized');
  if (!info || info.owner.toBase58() !== idl.address) continue;
  const config = coder.decode('PoolConfig', info.data);
  console.log(JSON.stringify({ mint: row.tokenMint, config: row.dbcConfigKey, baseFee: config.pool_fees.base_fee, dynamicFee: config.pool_fees.dynamic_fee,
   migratedBps: config.migrated_pool_fee_bps, migrationFeeOption: config.migration_fee_option, creatorFeePercent: config.creator_trading_fee_percentage, partnerLp: config.partner_lp_percentage, creatorLp: config.creator_lp_percentage,
   launchSignature: row.launchSignature }));
  const launch = await connection.getTransaction(row.launchSignature,{commitment:'finalized',maxSupportedTransactionVersion:0});
  if (launch && !launch.meta.err) {
    const keys = launch.transaction.message.getAccountKeys({accountKeysFromLookups:launch.meta.loadedAddresses});
    const decoded = launch.transaction.message.compiledInstructions.map(ix=>{
      const program=keys.get(ix.programIdIndex).toBase58(), source=program===idl.address ? idl : program===feeIdl.address ? feeIdl : null;
      return {program,...(source ? new BorshInstructionCoder(source).decode(Buffer.from(ix.data)) : {data:[...ix.data]}),keys:ix.accountKeyIndexes.map(i=>keys.get(i).toBase58())};
    });
    const tables={};
    for (const lookup of launch.transaction.message.addressTableLookups) {
      const table=(await connection.getAddressLookupTable(lookup.accountKey)).value;
      tables[lookup.accountKey.toBase58()]=table.state.addresses.map(k=>k.toBase58());
    }
    writeFileSync('/tmp/hive-bags-public-launch.json',JSON.stringify({mint:row.tokenMint,config:row.dbcConfigKey,signature:row.launchSignature,decoded,
      message:Buffer.from(launch.transaction.message.serialize()).toString('base64'),signatures:launch.transaction.signatures,tables},null,2));
    console.log(JSON.stringify({launchInstructions:decoded.map(ix=>({program:ix.program,instruction:ix.name||ix.data}))}));
  }
  if (inspected === 0) {
   const address = PublicKey.findProgramAddressSync([Buffer.from('fee_share_config'), new PublicKey(row.tokenMint).toBuffer(), require('@solana/spl-token').NATIVE_MINT.toBuffer()], new PublicKey(feeIdl.address))[0];
   const signatures = await connection.getSignaturesForAddress(address, {limit:5}, 'finalized');
   for (const item of signatures) {
    const tx = await connection.getTransaction(item.signature, {commitment:'finalized',maxSupportedTransactionVersion:0});
    if (!tx || tx.meta?.err) continue;
    const keys = tx.transaction.message.getAccountKeys({accountKeysFromLookups:tx.meta.loadedAddresses});
    const decoded = tx.transaction.message.compiledInstructions.map(ix => {
     const program = keys.get(ix.programIdIndex).toBase58(), source = program === feeIdl.address ? feeIdl : program === idl.address ? idl : null;
     const data = source ? new BorshInstructionCoder(source).decode(Buffer.from(ix.data)) : null;
     return {program,name:data?.name||Array.from(ix.data.slice(0,8)),accounts:ix.accountKeyIndexes.length,
      ...(program===feeIdl.address ? {data:data?.data,keys:ix.accountKeyIndexes.map(i=>keys.get(i).toBase58())} : {})};
    });
    console.log(JSON.stringify({setupSignature:item.signature,instructions:decoded}));
   }
  }
  if (++inspected === 1) break;
 }
 console.log(JSON.stringify({ feedEntries: body.response.length, inspected }));
} catch { console.error('Public Bags inspection failed.'); process.exitCode = 1; }

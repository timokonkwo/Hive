// Read-only provider plans and RPC simulation. Never signs or broadcasts.
import env from '@next/env';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {Connection,TransactionMessage,VersionedTransaction}=require('@solana/web3.js');
const {BorshInstructionCoder}=require('@coral-xyz/anchor');
const bs58=require('bs58').default;
const idl=require('../../lib/agent-tokenization/idl/bags-fee-share-v2.json');
env.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
try {
 const wallet=JSON.parse(readFileSync('tests/fixtures/bags-deployer-setup.json','utf8')).addresses.deployer;
 const headers={'x-api-key':process.env.BAGS_AGENT_API_KEY,'Content-Type':'application/json'};
 const base='https://public-api-v2.bags.fm/api/v1/fee-share/deployer';
 const positions=await (await fetch(`${base}/claimable-positions?wallet=${wallet}`,{headers,signal:AbortSignal.timeout(20000)})).json();
 console.log(JSON.stringify({wallet,positions:positions.response}));
 const response=await(await fetch(`${base}/claim-txs`,{method:'POST',headers,body:JSON.stringify({wallet,maxTransactions:1}),signal:AbortSignal.timeout(20000)})).json();
 if(!response.success)throw Error('No plan');
 const connection=new Connection(process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com');
 const tables={};
 for(const row of response.response.transactions){
  const tx=VersionedTransaction.deserialize(bs58.decode(row.transaction));
  const lookup=await Promise.all(tx.message.addressTableLookups.map(async l=>(await connection.getAddressLookupTable(l.accountKey)).value));
  for(const t of lookup)tables[t.key.toBase58()]=t.state.addresses.map(k=>k.toBase58());
  const instructions=TransactionMessage.decompile(tx.message,{addressLookupTableAccounts:lookup}).instructions;
  console.log(JSON.stringify(instructions.map(ix=>({program:ix.programId.toBase58(),data:[...ix.data],decoded:ix.programId.toBase58()===idl.address?new BorshInstructionCoder(idl).decode(ix.data):null,keys:ix.keys.map(k=>({key:k.pubkey.toBase58(),signer:k.isSigner,writable:k.isWritable}))})),null,2));
 }
 writeFileSync('/tmp/hive-bags-deployer-fees.json',JSON.stringify({wallet,positions:positions.response,plan:response.response,tables},null,2));
} catch {console.error('Bags fee inspection failed.');process.exitCode=1;}

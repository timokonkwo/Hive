import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {bagsFees,bagsLaunch,pumpFees,sessions,solanaJournal} from '../scripts/tokenization/modules.mjs';
import {loadTypeScript} from './helpers/load-typescript.mjs';
const require=createRequire(import.meta.url);
const {PublicKey,AddressLookupTableAccount,TransactionMessage,VersionedTransaction,SystemProgram,Keypair}=require('@solana/web3.js');
const {getAssociatedTokenAddressSync,NATIVE_MINT,TOKEN_PROGRAM_ID}=require('@solana/spl-token');
const f=JSON.parse(readFileSync(new URL('./fixtures/bags-deployer-fees.json',import.meta.url)));
const tables=Object.entries(f.tables).map(([key,addresses])=>new AddressLookupTableAccount({key:new PublicKey(key),state:{deactivationSlot:2n**64n-1n,lastExtendedSlot:0,lastExtendedSlotStartIndex:0,addresses:addresses.map(key=>new PublicKey(key))}}));
const connection={getAddressLookupTable:async key=>({value:tables.find(t=>t.key.equals(key))})};
const transaction=()=>bagsLaunch.readBagsTransaction(f.plan.transactions[0]).transaction;
const instructions=()=>TransactionMessage.decompile(transaction().message,{addressLookupTableAccounts:tables}).instructions;
const changed=edit=>{const ixs=instructions();edit(ixs);return new VersionedTransaction(new TransactionMessage({payerKey:transaction().message.staticAccountKeys[0],recentBlockhash:transaction().message.recentBlockhash,instructions:ixs}).compileToV0Message(tables));};
const check=tx=>bagsFees.validateDeployerClaim(connection,tx,new Set(f.positions.positions.map(p=>p.tokenMint)),f.wallet);
test('Bags deployer earnings count aggregate vault once and reject inconsistent, missing or imprecise data',()=>{
 assert.equal(bagsFees.readDeployerFees(f.positions,f.wallet).total,17749796n);
 for(const change of [p=>p.totalClaimableLamports='17749797',p=>p.vaultClaimableLamports='0',p=>p.positions.push(p.positions[0]),p=>p.positions[0].accruedLamports=16972707,p=>p.quoteMint=f.wallet,p=>delete p.unattributedVaultLamports]){
  const p=structuredClone(f.positions);change(p);assert.throws(()=>bagsFees.readDeployerFees(p,f.wallet));
 }
});
test('Bags deployer fees include old and new wallets under the existing claim journal',async()=>{
 const calls=[];
 const api={deployerFees:async wallet=>{calls.push(wallet);return {...structuredClone(f.positions),wallet};}};
 const client=new bagsFees.HiveBagsDeployerFees(connection,api);
 assert.equal(client.getWalletAddress(),sessions.HIVE_SOLANA_FEE_WALLET);
 const positions=await client.getClaimablePositions();
 assert.deepEqual(calls,[sessions.HIVE_SOLANA_FEE_WALLET,sessions.HIVE_SOLANA_LAUNCH_WALLET]);
 assert.deepEqual(positions.map(p=>p.baseMint),calls);
 assert.equal(positions.reduce((sum,p)=>sum+BigInt(p.totalClaimableLamportsUserShare),0n),35499592n);
 await assert.rejects(client.prepareClaimTransactions(Keypair.generate().publicKey.toBase58()));
 api.deployerFees=async()=>{throw Error('offline');};
 await assert.rejects(client.getClaimablePositions(),/offline/);
});
test('current sponsored Bags sweep, vault withdrawal and native SOL unwrap validate against the pinned IDL',async()=>{
 await check(transaction());
 assert.ok(instructions().some(ix=>ix.programId.equals(TOKEN_PROGRAM_ID)));
});
test('Bags fee signing refuses diverted recipients, loan repayment inflation, extra spending and different mints',async()=>{
 const other=Keypair.generate().publicKey;
 for(const edit of [
  ixs=>ixs.push(SystemProgram.transfer({fromPubkey:new PublicKey(f.wallet),toPubkey:other,lamports:1})),
  ixs=>{const last=ixs.at(-1);last.data.writeBigUInt64LE(100001n,4);},
  ixs=>{const close=ixs.find(i=>i.programId.equals(TOKEN_PROGRAM_ID));close.keys[1].pubkey=other;},
  ixs=>{const claim=ixs.find(i=>i.data.length===8&&i.data[0]===184); if(claim)claim.keys[1].pubkey=other;else ixs[3].keys[9].pubkey=other;},
  ixs=>{ixs[3].keys[15].pubkey=other;},
 ]) await assert.rejects(check(changed(edit)));
 await assert.rejects(bagsFees.validateDeployerClaim(connection,transaction(),new Set(),f.wallet));
});
test('pump AMM accrued creator fees use exact appended account bytes and old accounts start at zero',()=>{
 const data=Buffer.alloc(287);data.writeBigUInt64LE(9007199254740993n,279);
 assert.equal(pumpFees.pumpPoolCreatorFees(data),9007199254740993n);
 assert.equal(pumpFees.pumpPoolCreatorFees(Buffer.alloc(279)),0n);
});
test('pump reads do not turn RPC failure into a zero balance',async()=>{
 const client=new pumpFees.PumpFeeClient({collection:()=>({distinct:async()=>[]})},{getGenesisHash:async()=>{throw Error('offline')}});
 await assert.rejects(client.getClaimablePositions(),/offline/);
});
test('pump collects the Hive curve bucket atomically and never duplicates vault balances across tokens',async()=>{
 const sdk=require('@pump-fun/pump-sdk'),amm=require('@pump-fun/pump-swap-sdk'),solana=require('@solana/web3.js'),spl=require('@solana/spl-token');
 const wallet=new PublicKey(sessions.HIVE_SOLANA_FEE_WALLET),mint=Keypair.generate().publicKey;
 let fee=1000n,after=99995000;
 const curve={creator:wallet,quoteMint:NATIVE_MINT,creatorFee:fee};
 class Online {async getCreatorVaultBalance(){return 2000n;}async fetchBondingCurve(){return{...curve,creatorFee:fee};}}
 class AmmOnline {async getCoinCreatorVaultBalance(){return 3000n;}}
 const module=loadTypeScript(new URL('../lib/agent-tokenization/pump-fees.ts',import.meta.url),{
  '@solana/web3.js':solana,'@solana/spl-token':spl,'@pump-fun/pump-sdk':{...sdk,OnlinePumpSdk:Online,PUMP_SDK:{...sdk.PUMP_SDK,decodeBondingCurve:()=>curve,sweepCreatorFeeInstruction:input=>sdk.PUMP_SDK.sweepCreatorFeeInstruction(input)}},
  '@pump-fun/pump-swap-sdk':{...amm,OnlinePumpAmmSdk:AmmOnline},'./session':sessions,'./solana-journal':solanaJournal,'./solana-signer':{signManagedSolana:()=>assert.fail('No signing during preparation')},
 });
 const rpc={getGenesisHash:async()=>solanaJournal.SOLANA_MAINNET_GENESIS,getMultipleAccountsInfo:async()=>[{owner:sdk.PUMP_PROGRAM_ID,data:Buffer.alloc(0)},null],getLatestBlockhash:async()=>({blockhash:mint.toBase58(),lastValidBlockHeight:100}),
  getBalance:async()=>100000000,simulateTransaction:async()=>({value:{err:null,accounts:[{lamports:after}]}})};
 const client=new module.PumpFeeClient({collection:()=>({distinct:async()=>[mint.toBase58(),mint.toBase58()]})},rpc);
 const balances=await client.getClaimablePositions();assert.equal(balances.length,3);assert.equal(balances.reduce((sum,p)=>sum+BigInt(p.totalClaimableLamportsUserShare),0n),6000n);
 const prepared=await client.prepareClaimTransactions(sdk.bondingCurvePda(mint).toBase58());assert.equal(prepared.length,1);
 const ixs=TransactionMessage.decompile(prepared[0].transaction.message).instructions;
 assert.equal(ixs.length,3);assert.ok(ixs.slice(1).every(ix=>ix.programId.equals(sdk.PUMP_PROGRAM_ID)));
 assert.ok(prepared[0].transaction.message.staticAccountKeys[0].equals(wallet));
 after=80000000;await assert.rejects(client.prepareClaimTransactions(sdk.bondingCurvePda(mint).toBase58()),/cost limit/);
 fee=0n;assert.deepEqual(await client.prepareClaimTransactions(sdk.bondingCurvePda(mint).toBase58()),[]);
});

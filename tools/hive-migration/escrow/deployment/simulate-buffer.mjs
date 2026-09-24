// Read-only mainnet simulation. No admin signature or transaction broadcast.
import {readFileSync} from 'node:fs';import {Connection,Keypair,PublicKey} from '@solana/web3.js';
import {createBuffer} from './loader.mjs';import {unsignedTransaction} from '../client.mjs';
const review=JSON.parse(readFileSync(new URL('../local/deployment-100k/review.json',import.meta.url)));
const rpc=new Connection(process.env.SOLANA_RPC_URL,'finalized');
if(await rpc.getGenesisHash()!=='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')throw Error('Wrong network');
const buffer=Keypair.generate(),rent=await rpc.getMinimumBalanceForRentExemption(review.programBytes+37);
const tx=unsignedTransaction(createBuffer(new PublicKey(review.config.admin),buffer.publicKey,review.programBytes,rent),review.config.admin,(await rpc.getLatestBlockhash()).blockhash);
tx.sign([buffer]);const result=await rpc.simulateTransaction(tx,{sigVerify:false,replaceRecentBlockhash:true,commitment:'finalized'});
if(result.value.err)throw Error(JSON.stringify(result.value.err));
console.log(JSON.stringify({simulation:'passed',slot:result.context.slot,unitsConsumed:result.value.unitsConsumed,adminSigned:false,transactionsSent:0}));

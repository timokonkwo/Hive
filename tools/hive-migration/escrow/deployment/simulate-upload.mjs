// Read-only check of the next upload chunk. Never loads the admin signer or broadcasts.
import {readFileSync} from 'node:fs';import {Connection,Keypair,PublicKey} from '@solana/web3.js';
import {writeBuffer} from './loader.mjs';import {unsignedTransaction} from '../client.mjs';
const review=JSON.parse(readFileSync(new URL('../local/deployment-100k/review.json',import.meta.url)));
const buffer=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(new URL('../local/deployment-100k/buffer-keypair.json',import.meta.url))))).publicKey;
const binary=readFileSync(new URL('../solana/target/deploy/hive_redemption_escrow.so',import.meta.url));
const rpc=new Connection(process.env.SOLANA_RPC_URL,'finalized');if(await rpc.getGenesisHash()!=='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')throw Error('Wrong network');
const started=Date.now(),current=await rpc.getAccountInfo(buffer);let offset=0;for(;offset<binary.length;offset+=900)if(!current.data.subarray(37+offset,37+Math.min(offset+900,binary.length)).equals(binary.subarray(offset,Math.min(offset+900,binary.length))))break;
if(offset>=binary.length)throw Error('No unwritten chunk');const tx=unsignedTransaction([writeBuffer(new PublicKey(review.config.admin),buffer,offset,binary.subarray(offset,offset+900))],review.config.admin,(await rpc.getLatestBlockhash()).blockhash);
const result=await rpc.simulateTransaction(tx,{sigVerify:false,replaceRecentBlockhash:true,commitment:'finalized'});console.log(JSON.stringify({offset,error:result.value.err,units:result.value.unitsConsumed,elapsedMilliseconds:Date.now()-started,adminSigned:false,transactionsSent:0}));if(result.value.err)process.exitCode=1;

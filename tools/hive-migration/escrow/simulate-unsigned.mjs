// RPC simulation only. Deliberately has no signing or sendTransaction path.
import {readFileSync} from 'node:fs';
import {Connection,PublicKey,TransactionInstruction} from '@solana/web3.js';
import {unsignedTransaction} from './client.mjs';
try {
  const [input,feePayer]=process.argv.slice(2);
  if(!input||!feePayer||process.argv.length!==4||!process.env.SOLANA_RPC_URL)throw Error('Usage: node --env-file=.env.local simulate-unsigned.mjs <instruction-array.json> <fee-payer-public-address>');
  const specs=JSON.parse(readFileSync(input,'utf8'));
  if(!Array.isArray(specs))throw Error('Expected an array of serialized unsigned instructions');
  const instructions=specs.map(s=>new TransactionInstruction({programId:new PublicKey(s.programId),keys:s.accounts.map(a=>({...a,pubkey:new PublicKey(a.pubkey)})),data:Buffer.from(s.dataBase64,'base64')}));
  const connection=new Connection(process.env.SOLANA_RPC_URL,'finalized');
  const block=await connection.getLatestBlockhash('finalized');
  const tx=unsignedTransaction(instructions,feePayer,block.blockhash);
  const simulation=await connection.simulateTransaction(tx,{sigVerify:false,replaceRecentBlockhash:true,commitment:'finalized'});
  console.log(JSON.stringify({mode:'unsigned_simulation_only',signaturesVerified:false,signed:false,broadcast:false,context:simulation.context,result:simulation.value},null,2));
  if(simulation.value.err)process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}

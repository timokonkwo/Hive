import {VersionedTransaction} from '@solana/web3.js';

// Only idempotent program-data uploads can be released for fresh preparation.
// Funding, deployment and claim transactions are never retried through this path.
export async function expiredUpload(entry,sol) {
  if(entry.chain!=='solana'||!/^upload-\d+$/.test(entry.action)||!entry.hash||!entry.raw)return null;
  const status=(await sol.getSignatureStatuses([entry.hash],{searchTransactionHistory:true})).value[0];
  if(status)return null;
  const height=await sol.getBlockHeight('finalized');
  if(height<=entry.lastValidBlockHeight)return null;
  const blockhash=VersionedTransaction.deserialize(Buffer.from(entry.raw,'base64')).message.recentBlockhash;
  if((await sol.isBlockhashValid(blockhash,{commitment:'finalized'})).value)return null;
  if(await sol.getTransaction(entry.hash,{commitment:'finalized',maxSupportedTransactionVersion:0}))return null;
  return {lastValidBlockHeight:entry.lastValidBlockHeight,finalizedBlockHeight:height,blockhashValid:false,finalizedTransactionFound:false};
}

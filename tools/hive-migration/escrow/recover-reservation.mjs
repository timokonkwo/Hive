// Explicit operator-selected recovery. Re-submit identical signed bytes only;
// never generate a nonce, alter terms, sign again, or recover a payout this way.
import {keccak256,parseTransaction,recoverTransactionAddress,encodeFunctionData} from 'viem';
import {PublicKey} from '@solana/web3.js';
import {authenticateRegistration} from './registration.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message);};
async function absent(client,hash){
 try{await client.getTransactionReceipt({hash});return false;}catch(e){if(e.name!=='TransactionReceiptNotFoundError')throw e;}
 try{await client.getTransaction({hash});return false;}catch(e){if(e.name!=='TransactionNotFoundError')throw e;}
 return true;
}
export async function recoverReservation({hash,review,request,journal,observer,transport,log}){
 check(/^0x[0-9a-f]{64}$/.test(hash),'Invalid recovery hash');
 const q=await authenticateRegistration(review,request),entry=journal.latest().get(q.claimId+':reserve');
 check(entry?.chain==='evm'&&entry.hash===hash&&keccak256(entry.raw)===hash,'Recovery does not match the durable reservation');
 if(entry.recoveryAttempted||!['prepared','submitted'].includes(entry.status))return;
 const tx=parseTransaction(entry.raw),c=review.config;
 const expected=encodeFunctionData({abi:observer.abi,functionName:'reserve',args:[{sourceOwner:`0x${new PublicKey(q.owner).toBuffer().toString('hex')}`,recipient:q.recipient,snapshotAmount:BigInt(q.snapshotAmount),depositAmount:BigInt(q.amount),depositDeadline:BigInt(q.depositDeadline),claimDeadline:BigInt(q.claimDeadline)},q.proof]});
 check(tx.chainId===4663&&tx.to?.toLowerCase()===c.distributor.toLowerCase()&&BigInt(tx.value??0)===0n&&tx.data===expected&&tx.nonce===entry.nonce,'Recovery transaction terms differ');
 check((await recoverTransactionAddress({serializedTransaction:entry.raw})).toLowerCase()===c.destinationAdmin.toLowerCase(),'Recovery signer differs');
 check(await transport.getChainId()===4663,'Wrong recovery chain');
 if(!await absent(observer.evm,hash)||!await absent(transport,hash))return;
 const observed=await observer.read(q.owner);
 check(observed.finalized&&observed.deploymentVerified&&!observed.source&&Number(observed.destination.status)===0,'Reservation already exists or deployment unverified');
 const nonces=await Promise.all(['latest','pending'].map(blockTag=>transport.getTransactionCount({address:c.destinationAdmin,blockTag})));
 check(nonces.every(n=>n===entry.nonce),'Reservation nonce requires manual reconciliation');
 if(BigInt(observed.destinationCurrentTimestamp)>=BigInt(q.depositDeadline)){
  // Past finalized expiry, the contract can never accept these signed terms.
  // No destination reservation or source deposit exists at this checkpoint.
  if(BigInt(observed.destinationTimestamp)<BigInt(q.depositDeadline))return;
  journal.append({...entry,status:'expired',recoveryAttempted:true,evidence:{block:observed.destinationBlock,reason:'finalized_reservation_expiry'}});
  log({event:'reservation_expired',hash,claimId:q.claimId});return;
 }
 check(!observed.sourcePaused&&!observed.destinationPaused,'Recovery campaign paused');
 await transport.call({account:c.destinationAdmin,to:tx.to,data:tx.data,value:0n});
 // Persist the single explicit attempt before sending, including if we crash.
 journal.append({...entry,recoveryAttempted:true,recoveryEndpoint:'robinhood_official'});
 const sent=await transport.sendRawTransaction({serializedTransaction:entry.raw});
 check(sent.toLowerCase()===hash,'Recovery submission hash mismatch');
 log({event:'reservation_rebroadcast',hash,claimId:q.claimId});
}

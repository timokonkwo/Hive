import {PublicKey} from '@solana/web3.js';
import {authenticateRegistration} from './registration.mjs';
import {nextAction} from './settlement.mjs';
import {hex,depositFromAccounts,openingFor} from './client.mjs';
import {submitOnce,reconcileJournal} from './journal.mjs';

export function assertReservation(q,destination){
  if(Number(destination.status)===0)return;
  const d=destination.quote;
  if(d.sourceOwner.toLowerCase()!==hex(new PublicKey(q.owner).toBytes())||d.recipient.toLowerCase()!==q.recipient.toLowerCase()||
    BigInt(d.depositAmount)!==BigInt(q.amount)||BigInt(destination.grant)!==BigInt(q.grant)||
    ['snapshotAmount','depositDeadline','claimDeadline'].some(k=>BigInt(d[k])!==BigInt(q[k])))throw Error('Registration differs from on-chain reservation');
}
export async function processRegistration({review,request,observer,adapter,journal,execute=false}){
  const q=await authenticateRegistration(review,request);
  if(execute && review.financialActivationApproved!==true)throw Error('Financial activation has not been approved');
  if(execute)await reconcileJournal(journal,adapter);
  const observed=await observer.read(q.owner);
  if(!observed.finalized||!observed.deploymentVerified)throw Error('Finality or reviewed deployment verification missing');
  assertReservation(q,observed.destination);
  const now=BigInt(observed.destinationCurrentTimestamp??observed.destinationTimestamp);
  let action=nextAction(observed.source,observed.destination,now);
  if(action==='reserve'&&(now<BigInt(openingFor(review.config,q.owner))||now>=BigInt(q.depositDeadline)||now>=BigInt(review.config.closesAt)))action='request_window_closed';
  if((observed.destinationPaused&&['reserve','deposit','confirm_deposit','claim'].includes(action))||(observed.sourcePaused&&action==='deposit'))action='paused';
  if(['reserve','deposit'].includes(action)&&BigInt(review.config.minimumCurrentHoldingRaw??'0')>0n){
    const accounts=await observer.spendable(q.owner,observed.sourceSlot);
    if(accounts.reduce((n,a)=>n+BigInt(a.amountRaw),0n)<BigInt(review.config.minimumCurrentHoldingRaw))action='below_minimum';
    else depositFromAccounts(review.config,{...q,sourceTokenAccount:accounts[0].address},accounts);
  }
  const report={claimId:q.claimId,action,mode:execute?'execute':'dry_run',sourceSlot:observed.sourceSlot,destinationBlock:observed.destinationBlock};
  if(action==='confirm_deposit')report.depositSignature=await observer.depositEvidence(q,observed,request.depositSignature);
  if(['release_to_collection','refund_to_owner'].includes(action))report.destinationTransactionHash=await observer.settlementEvidence(q,observed);
  if(!execute)return report;
  if(action==='deposit'){
    // Construct the complete transaction ourselves; never sign arbitrary client bytes.
    const spendable=await observer.spendable(q.owner,observed.sourceSlot);
    return {...report,deposit:await adapter.partialDeposit(q,spendable)};
  }
  const names={reserve:'reserve',confirm_deposit:'confirm_deposit',claim:'claim',cancel_expired:'cancel_expired',release_to_collection:'release',refund_to_owner:'refund'};
  if(!names[action])return report;
  const chain=['release','refund'].includes(names[action])?'solana':'evm';
  const tx=await submitOnce(journal,`${q.claimId}:${names[action]}`,chain,{...q,action:names[action],depositSignature:report.depositSignature,destinationTransactionHash:report.destinationTransactionHash},adapter);
  return {...report,transaction:tx};
}

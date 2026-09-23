import {createPublicKey,verify as verifyEd25519} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import {getBase58Encoder} from '@solana/kit';
import {getAddress,verifyMessage} from 'viem';
import {addresses,claimId,hex,integer,bytes,sha256,grantForDeposit} from './client.mjs';

export function registrationTerms(review,request) {
  const c=review.config,owner=new PublicKey(request.owner).toBase58();
  const h=review.tree.holders.find(h=>h.owner===owner);
  if(!h)throw Error('Owner absent from reviewed snapshot');
  integer(request.amount,8);integer(request.depositDeadline,8);bytes(request.nonce,32);
  const amount=BigInt(request.amount),deadline=BigInt(request.depositDeadline);
  if(amount<=0n||amount>BigInt(h.amountRaw)||deadline>BigInt(c.closesAt)||deadline<=BigInt(c.opensAt))throw Error('Invalid requested allowance/window');
  const recipient=getAddress(request.recipient);
  if(/^0x0{40}$/i.test(recipient)||recipient.toLowerCase()===c.distributor.toLowerCase())throw Error('Invalid recipient');
  const grant=grantForDeposit(c,request.amount,h.amountRaw);
  const p=addresses(c.program,c.admin,c.campaignId,owner);
  return {owner,recipient,amount:amount.toString(),snapshotAmount:h.amountRaw,grant,depositDeadline:deadline.toString(),claimDeadline:(deadline+BigInt(c.claimGrace)).toString(),nonce:request.nonce.toLowerCase(),claimId:hex(claimId(p.campaign,owner)),campaign:p.campaign.toBase58(),proof:h.proof};
}
export function registrationMessage(review,request) {
  const c=review.config,q=registrationTerms(review,request);
  return 'Hive redemption authorization v5\n'+JSON.stringify({
    campaignId:c.campaignId,sourceProgram:c.program,sourceCampaign:q.campaign,sourceMint:c.mint,snapshotRoot:c.root,
    allocationMethod:'proportional_with_70_percent_cap',totalEligibleOldRaw:c.totalEligibleOldRaw,fundingBudgetRaw:c.fundingBudgetRaw,allowPartialSurrender:c.allowPartialSurrender,minimumCurrentHoldingRaw:c.minimumCurrentHoldingRaw??'0',minimumSnapshotHoldingRaw:c.minimumCurrentHoldingRaw??'0',
    destinationChain:c.destinationChain,distributor:c.distributor,destinationToken:c.destinationToken,
    owner:q.owner,recipient:q.recipient,oldAmountRaw:q.amount,newGrantRaw:q.grant,snapshotAllowanceRaw:q.snapshotAmount,
    depositDeadline:q.depositDeadline,claimDeadline:q.claimDeadline,nonce:q.nonce,
    policy:'one deposit attempt per source owner; paid and refunded attempts are terminal',
  });
}
export async function authenticateRegistration(review,request) {
  const q=registrationTerms(review,request),message=registrationMessage(review,request);
  const raw=Buffer.from(getBase58Encoder().encode(request.solanaSignature));
  if(raw.length!==64)throw Error('Invalid Solana registration signature');
  const publicKey=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),new PublicKey(q.owner).toBuffer()]),format:'der',type:'spki'});
  if(!verifyEd25519(null,Buffer.from(message),publicKey,raw))throw Error('Invalid source wallet authorization');
  if(!await verifyMessage({address:q.recipient,message,signature:request.evmSignature}))throw Error('Invalid destination wallet authorization');
  return {...q,messageHash:hex(sha256(Buffer.from(message)))};
}

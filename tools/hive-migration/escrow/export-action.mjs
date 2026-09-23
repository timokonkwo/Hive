// Unsigned, reviewable payloads only. Does not attest truth, sign, or broadcast.
import {readFileSync,writeFileSync} from 'node:fs';
import {PublicKey} from '@solana/web3.js';
import {encodeFunctionData} from 'viem';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {addresses,claimId,hex,integer,grantForDeposit,depositEvidence,depositInstruction,settlementInstructions,serializeInstruction} from './client.mjs';
export function exportAction(review,request,abi) {
  const c=review.config;
  const owner=new PublicKey(request.owner).toBase58();
  const p=addresses(c.program,c.admin,c.campaignId,owner);
  const id=hex(claimId(p.campaign,owner));
  const result={mode:'unsigned_review_only',action:request.action,claimId:id,signed:false,broadcast:false,requiresIndependentFinalizedVerification:true};
  const evm=(functionName,args)=>({...result,chainId:4663,to:c.distributor,value:'0',data:encodeFunctionData({abi,functionName,args}),functionName});
  if(request.action==='claim')return evm('claim',[id]);
  if(request.action==='cancel')return evm('cancel',[id]);
  if(request.action==='cancel_expired')return evm('cancelExpired',[id]);
  if(request.action==='confirm_deposit')return evm('confirmDeposit',[id,depositEvidence(request.depositSignature)]);
  if(request.action==='release'||request.action==='refund')return {...result,chain:'solana',instructions:settlementInstructions(c,owner,request.action==='release',request.destinationTransactionHash,request.feePayer).map(serializeInstruction)};
  if(request.action==='reserve'||request.action==='deposit'){
    const h=review.tree.holders.find(h=>h.owner===owner);
    if(!h)throw Error('Owner absent from reviewed eligibility tree');
    integer(request.amount,8);integer(request.depositDeadline,8);
    if(BigInt(request.amount)<=0n||BigInt(request.amount)>BigInt(h.amountRaw))throw Error('Deposit exceeds reviewed allowance');
    result.grantRaw=grantForDeposit(c,request.amount,h.amountRaw);
    const q={owner,snapshotAmount:h.amountRaw,amount:request.amount,recipient:request.recipient,depositDeadline:request.depositDeadline,sourceTokenAccount:request.sourceTokenAccount,proof:h.proof};
    if(request.action==='deposit')return {...result,chain:'solana',instructions:[serializeInstruction(depositInstruction(c,q))]};
    const claimDeadline=BigInt(request.depositDeadline)+BigInt(c.claimGrace);
    integer(claimDeadline,8);
    return evm('reserve',[{sourceOwner:hex(new PublicKey(owner).toBytes()),recipient:request.recipient,snapshotAmount:BigInt(h.amountRaw),depositAmount:BigInt(request.amount),depositDeadline:BigInt(request.depositDeadline),claimDeadline},h.proof]);
  }
  throw Error('Unknown action');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try {
    if(process.argv.length!==5)throw Error('Usage: node export-action.mjs <campaign-review.json> <request.json> <new-output.json>');
    const review=JSON.parse(readFileSync(process.argv[2],'utf8')),request=JSON.parse(readFileSync(process.argv[3],'utf8'));
    const {abi}=JSON.parse(readFileSync(new URL('./evm/out/HiveDistributor.sol/HiveDistributor.json',import.meta.url),'utf8'));
    const result=exportAction(review,request,abi);
    writeFileSync(process.argv[4],JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log('Exported unsigned action; no verification signature or transaction was sent.');
  }catch(error){console.error(error.shortMessage||error.message);process.exitCode=1;}
}

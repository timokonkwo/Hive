// Operator-side pre-signature quote. No wallet prompt, reservation or transaction.
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {registrationTerms,registrationMessage} from './registration.mjs';
import {depositFromAccounts} from './client.mjs';
import {createObserver} from './observer.mjs';

export async function quoteRegistration(review,input,observer,now=BigInt(Math.floor(Date.now()/1000))) {
  const c=review.config;
  if(typeof now!=='bigint'||now<0n)throw Error('Exact current timestamp required');
  if(!c||['classificationsApproved','grantAmountsApproved','terminalAttemptPolicyApproved'].some(k=>c[k]!==true)||review.financialActivationApproved!==true)throw Error('Approved and activated campaign required');
  if(!input||['owner','recipient','amount'].some(k=>typeof input[k]!=='string'||input[k].length>64))throw Error('Owner, recipient and exact raw amount required');
  if(now<BigInt(c.opensAt)||now>=BigInt(c.closesAt))throw Error('Campaign is not open');
  const deadline=now+600n<BigInt(c.closesAt)?now+600n:BigInt(c.closesAt);
  const request={owner:input.owner,recipient:input.recipient,amount:input.amount,depositDeadline:deadline.toString(),nonce:'0x'+randomBytes(32).toString('hex')};
  const terms=registrationTerms(review,request);
  const observed=await observer.read(terms.owner);
  if(!observed.finalized||!observed.deploymentVerified||observed.sourcePaused!==false||observed.destinationPaused!==false)throw Error('Verified active deployments required');
  const chainTime=BigInt(observed.destinationTimestamp);
  if(chainTime<now-120n||chainTime>now+120n||chainTime<BigInt(c.opensAt)||chainTime>=deadline)throw Error('Fresh open campaign state required');
  if(observed.source!==null||Number(observed.destination.status)!==0)throw Error('An attempt already exists; resume its status instead');
  if(!Number.isSafeInteger(c.snapshotSlot)||!Number.isSafeInteger(observed.sourceSlot)||observed.sourceSlot<c.snapshotSlot)throw Error('Fresh source snapshot required');
  if(typeof observed.availableInventoryRaw!=='string'||!/^(0|[1-9][0-9]*)$/.test(observed.availableInventoryRaw)||BigInt(observed.availableInventoryRaw)<BigInt(terms.grant))throw Error('Insufficient unreserved new HIVE');
  const accounts=await observer.spendable(terms.owner,observed.sourceSlot);
  if(!accounts.length)throw Error('No spendable old HIVE');
  // Reuse the deposit builder's ownership, mint, duplicate-account and balance checks.
  depositFromAccounts(c,{...terms,sourceTokenAccount:accounts[0].address},accounts);
  return {request:{...request,owner:terms.owner,recipient:terms.recipient,amount:terms.amount},message:registrationMessage(review,request),claimId:terms.claimId,oldAmountRaw:terms.amount,newGrantRaw:terms.grant,snapshotAllowanceRaw:terms.snapshotAmount,expiresAt:terms.depositDeadline,sourceSlot:observed.sourceSlot,destinationBlock:observed.destinationBlock,reserved:false,transactionSubmitted:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try {
    if(process.argv.length!==4)throw Error('Usage: node quote-registration.mjs <verifier.inputs.json> <unsigned-request.json>');
    const settingsPath=resolve(process.argv[2]),settings=JSON.parse(readFileSync(settingsPath,'utf8'));
    if(!settings.campaignReviewFile)throw Error('Reviewed campaign is not configured');
    if(!process.env.SOLANA_RPC_URL)throw Error('SOLANA_RPC_URL is required');
    const review=JSON.parse(readFileSync(resolve(dirname(settingsPath),settings.campaignReviewFile),'utf8'));
    const bytes=readFileSync(process.argv[3]);if(bytes.length>4096)throw Error('Quote request exceeds 4 KiB');
    const observer=createObserver(review,{solanaRpc:process.env.SOLANA_RPC_URL,evmRpc:process.env.HIVE_REDEMPTION_RH_RPC_URL});
    console.log(JSON.stringify(await quoteRegistration(review,JSON.parse(bytes),observer),null,2));
  }catch(error){
    let message=error.shortMessage||error.message;
    for(const endpoint of [process.env.SOLANA_RPC_URL,process.env.HIVE_REDEMPTION_RH_RPC_URL])if(endpoint)message=message.split(endpoint).join('[RPC]');
    console.error(message);process.exitCode=1;
  }
}

// Authenticated intake into the private verifier queue. Never signs or broadcasts.
import {readFileSync,mkdirSync,writeFileSync,linkSync,unlinkSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {authenticateRegistration} from './registration.mjs';

export async function acceptRegistration(review, input, directory, now = BigInt(Math.floor(Date.now()/1000))) {
  if(typeof now!=='bigint'||now<0n)throw Error('Exact current timestamp required');
  const c=review.config;
  if(!c || ['classificationsApproved','grantAmountsApproved','terminalAttemptPolicyApproved'].some(k=>c[k]!==true))throw Error('Reviewed campaign decisions required before registration');
  if(review.financialActivationApproved!==true || !review.deployment?.solanaProgramDataSha256 || !review.deployment?.destinationRuntimeCodeHash)throw Error('Deployed campaign activation required before registration');
  if(!input || typeof input!=='object'||Array.isArray(input))throw Error('Registration object required');
  // Copy only authenticated fields. Client-supplied grant, proof, status and action
  // are never accepted as queue instructions or authoritative amounts.
  const request={};
  for(const field of ['owner','recipient','amount','depositDeadline','nonce','solanaSignature','evmSignature']) {
    if(typeof input[field]!=='string'||input[field].length>256)throw Error(`Invalid ${field}`);
    request[field]=input[field];
  }
  const terms=await authenticateRegistration(review,request);
  if(now<BigInt(c.opensAt)||now>=BigInt(c.closesAt)||now>=BigInt(terms.depositDeadline))throw Error('Registration window closed or request expired');
  mkdirSync(directory,{recursive:true,mode:0o700});
  const path=join(directory,`${terms.claimId.slice(2)}.json`);
  const payload=JSON.stringify(request,null,2)+'\n';
  // Publish a complete, fsynced file atomically without replacing another request.
  // A crash can leave a .pending file, which the worker deliberately ignores.
  const temp=join(directory,`.${terms.claimId.slice(2)}-${randomUUID()}.pending`);
  writeFileSync(temp,payload,{flag:'wx',mode:0o600});
  let fd=openSync(temp,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
  let duplicate=false;
  try {
    try{linkSync(temp,path);}catch(error){
      if(error.code!=='EEXIST')throw error;
      const previous=await authenticateRegistration(review,JSON.parse(readFileSync(path,'utf8')));
      if(previous.messageHash!==terms.messageHash)throw Error('A different registration already exists for this wallet and campaign; resolve it before submitting new terms');
      duplicate=true;
    }
    fd=openSync(directory,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
  }finally{unlinkSync(temp);}
  return {claimId:terms.claimId,status:duplicate?'already_registered':'registered',grantRaw:terms.grant,amountRaw:terms.amount,recipient:terms.recipient,transactionSubmitted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try {
    if(process.argv.length!==4)throw Error('Usage: node accept-registration.mjs <verifier.inputs.json> <signed-registration.json>');
    const settingsPath=resolve(process.argv[2]),settings=JSON.parse(readFileSync(settingsPath,'utf8'));
    if(!settings.campaignReviewFile||!settings.requestsDirectory)throw Error('Reviewed campaign and private queue must be configured');
    const review=JSON.parse(readFileSync(resolve(dirname(settingsPath),settings.campaignReviewFile),'utf8'));
    const bytes=readFileSync(process.argv[3]);if(bytes.length>8192)throw Error('Registration exceeds 8 KiB');
    console.log(JSON.stringify(await acceptRegistration(review,JSON.parse(bytes),resolve(dirname(settingsPath),settings.requestsDirectory)),null,2));
  }catch(error){console.error(error.shortMessage||error.message);process.exitCode=1;}
}

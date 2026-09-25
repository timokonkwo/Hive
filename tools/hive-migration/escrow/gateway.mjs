// Private operator gateway. Website proxy authenticates with a server-only bearer token.
// Uses the verifier's persistent volume; never loads an administrator key.
import {readFileSync,existsSync,mkdirSync,writeFileSync,openSync,fsyncSync,closeSync,linkSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {createHash,createPublicKey,verify,randomUUID} from 'node:crypto';
import {VersionedTransaction} from '@solana/web3.js';
import {getBase58Decoder} from '@solana/kit';
import {Journal} from './journal.mjs';
import {quoteRegistration} from './quote-registration.mjs';
import {acceptRegistration} from './accept-registration.mjs';
import {authenticateRegistration} from './registration.mjs';
import {assertReservation} from './verifier-core.mjs';
import {nextAction} from './settlement.mjs';
import {depositFromAccounts} from './client.mjs';

function publish(path,value) {
  const temp=path+'.'+randomUUID()+'.pending';
  writeFileSync(temp,JSON.stringify(value)+'\n',{flag:'wx',mode:0o600});
  const fd=openSync(temp,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
  try{linkSync(temp,path);}catch(e){if(e.code!=='EEXIST')throw e;}finally{unlinkSync(temp);}
  const dir=openSync(join(path,'..'),'r');try{fsyncSync(dir);}finally{closeSync(dir);}
  return JSON.parse(readFileSync(path,'utf8'));
}
export function verifySignedDeposit(raw,packet) {
  if(typeof raw!=='string'||raw.length>2200||!/^[-A-Za-z0-9+/=]+$/.test(raw))throw Error('Invalid signed transaction');
  const tx=VersionedTransaction.deserialize(Buffer.from(raw,'base64'));
  const expected=VersionedTransaction.deserialize(Buffer.from(packet.transactionBase64,'base64'));
  const message=Buffer.from(tx.message.serialize());
  if(!message.equals(Buffer.from(expected.message.serialize())))throw Error('Wallet changed the deposit transaction');
  for(let i=0;i<tx.message.header.numRequiredSignatures;i++){
    const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),tx.message.staticAccountKeys[i].toBuffer()]),format:'der',type:'spki'});
    if(!verify(null,message,key,tx.signatures[i]))throw Error('Missing or invalid deposit signature');
  }
  return getBase58Decoder().decode(tx.signatures[0]);
}
export function createGateway({review,observer,requestsDirectory,stateDirectory,executionEnabled}) {
  const packets=join(stateDirectory,'gateway');
  const active=()=>executionEnabled===true&&review.financialActivationApproved===true&&['classificationsApproved','grantAmountsApproved','terminalAttemptPolicyApproved'].every(k=>review.config[k]===true);
  async function registered(request){
    const q=await authenticateRegistration(review,request),path=join(requestsDirectory,q.claimId.slice(2)+'.json');
    if(!existsSync(path))throw Error('Registration not found');
    const stored=await authenticateRegistration(review,JSON.parse(readFileSync(path,'utf8')));
    if(stored.messageHash!==q.messageHash)throw Error('Registration terms differ');
    return q;
  }
  return async function handle(action,input={}) {
    if(action==='availability')return {enabled:active()};
    if(!active())throw Error('Migration is not open');
    if(action==='quote')return quoteRegistration(review,input,observer);
    if(action==='register')return acceptRegistration(review,input,requestsDirectory);
    if(!['status','deposit'].includes(action))throw Error('Unknown action');
    const q=await registered(input.request),observed=await observer.read(q.owner);
    if(!observed.finalized||!observed.deploymentVerified)throw Error('Finalized deployment verification unavailable');
    assertReservation(q,observed.destination);
    let state=nextAction(observed.source,observed.destination,observed.destinationCurrentTimestamp??observed.destinationTimestamp);
    mkdirSync(packets,{recursive:true,mode:0o700});
    const receiptPath=join(packets,q.claimId.slice(2)+'.submission.json');
    const receipt=existsSync(receiptPath)?JSON.parse(readFileSync(receiptPath,'utf8')):null;
    if(state==='deposit'&&!receipt&&BigInt(review.config.minimumCurrentHoldingRaw??'0')>0n){
      const accounts=await observer.spendable(q.owner,observed.sourceSlot);
      if(accounts.reduce((n,a)=>n+BigInt(a.amountRaw),0n)<BigInt(review.config.minimumCurrentHoldingRaw))state='below_minimum';
      else depositFromAccounts(review.config,{...q,sourceTokenAccount:accounts[0].address},accounts);
    }
    if(action==='status'){
      const result={state,claimId:q.claimId,observedAt:new Date().toISOString(),signature:receipt?.signature??null,deposit:null,payout:null};
      if(Number(observed.destination.status)===3){
        try { result.payout={hash:await observer.settlementEvidence(q,observed),status:'finalized'}; }
        catch(error){
          if(error.message!=='Finalized settlement event missing')throw error;
          // A provider can expose a newer paid state before its event is finalized.
          // Keep tracking; never present that as a successful payout.
          result.state='claim';
          const entry=new Journal(stateDirectory).latest().get(q.claimId+':claim');
          if(entry?.hash && entry.status!=='failed')result.payout={hash:entry.hash,status:'pending'};
        }
      }
      if(receipt){
        const status=(await observer.sol.getSignatureStatuses([receipt.signature],{searchTransactionHistory:true})).value[0];
        result.submission=status?.err?'failed':status?.confirmationStatus==='finalized'?'finalized':'pending_or_unknown';
      }
      if(state==='deposit'&&!receipt&&!observed.sourcePaused&&!observed.destinationPaused){
        const path=join(stateDirectory,q.claimId.slice(2)+'.json');
        if(existsSync(path)){
          const report=JSON.parse(readFileSync(path,'utf8')),packet=report.deposit;
          if(report.claimId===q.claimId&&report.mode==='execute'&&report.action==='deposit'&&packet?.ownerSignatureRequired===true&&await observer.sol.getBlockHeight('finalized')<=packet.lastValidBlockHeight){
            const hash=createHash('sha256').update(packet.transactionBase64).digest('hex');
            publish(join(packets,hash+'.packet.json'),{claimId:q.claimId,...packet});
            result.deposit={...packet,packetId:hash};
          }
        }
      }
      return result;
    }
    // A persisted submission is never automatically broadcast twice, including after a crash.
    if(receipt)return {signature:receipt.signature,submission:'pending_or_unknown'};
    if(state!=='deposit'||observed.sourcePaused||observed.destinationPaused)throw Error('Deposit is not currently allowed');
    if(typeof input.packetId!=='string'||!/^[a-f0-9]{64}$/.test(input.packetId))throw Error('Invalid deposit packet');
    const packet=JSON.parse(readFileSync(join(packets,input.packetId+'.packet.json'),'utf8'));
    if(packet.claimId!==q.claimId||await observer.sol.getBlockHeight('finalized')>packet.lastValidBlockHeight)throw Error('Deposit packet expired or belongs to another claim');
    const signature=verifySignedDeposit(input.transactionBase64,packet);
    const attemptId=randomUUID();
    const saved=publish(receiptPath,{signature,attemptId,transactionBase64:input.transactionBase64,lastValidBlockHeight:packet.lastValidBlockHeight});
    if(saved.attemptId!==attemptId)return {signature:saved.signature,submission:'pending_or_unknown'};
    try{
      const sent=await observer.sol.sendRawTransaction(Buffer.from(input.transactionBase64,'base64'),{skipPreflight:false,maxRetries:0});
      if(sent!==signature)throw Error('Submission hash mismatch');
      return {signature,submission:'submitted'};
    }catch{return {signature,submission:'pending_or_unknown'};}
  };
}

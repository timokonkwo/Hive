import {readFileSync,readdirSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createObserver} from './observer.mjs';
import {loadSignerFromFd,createLiveAdapter} from './live-adapter.mjs';
import {Journal,acquireServiceLock} from './journal.mjs';
import {processRegistration} from './verifier-core.mjs';
let release;
try {
  const args=process.argv.slice(2),path=args[0],execute=args.includes('--execute'),once=args.includes('--once');
  if(!path||args.slice(1).some(x=>!['--execute','--once'].includes(x)))throw Error('Usage: node --env-file=.env.local verifier-service.mjs <verifier.inputs.json> [--once] [--execute]');
  const settings=JSON.parse(readFileSync(path,'utf8')),base=dirname(resolve(path));
  if(!settings.campaignReviewFile)throw Error('A deployed, reviewed campaign file is required');
  if(!process.env.SOLANA_RPC_URL)throw Error('SOLANA_RPC_URL is required');
  const review=JSON.parse(readFileSync(resolve(base,settings.campaignReviewFile),'utf8'));
  if(execute&&(settings.executionEnabled!==true||review.financialActivationApproved!==true||['classificationsApproved','grantAmountsApproved','terminalAttemptPolicyApproved'].some(k=>review.config[k]!==true)))throw Error('Execution remains disabled pending campaign and financial activation approval');
  const state=resolve(base,settings.stateDirectory),requests=resolve(base,settings.requestsDirectory);
  release=acquireServiceLock(state);mkdirSync(requests,{recursive:true,mode:0o700});
  const observer=createObserver(review,{solanaRpc:process.env.SOLANA_RPC_URL,evmRpc:process.env.HIVE_REDEMPTION_RH_RPC_URL});
  const journal=new Journal(state);
  const adapter=execute?createLiveAdapter(review,observer,settings.policy,loadSignerFromFd(process.env.HIVE_ESCROW_SIGNER_FD),journal):null;
  const poll=settings.pollMilliseconds;
  if(!Number.isInteger(poll)||poll<1000||poll>60000)throw Error('pollMilliseconds must be 1000–60000');
  let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
  do {
    for(const file of readdirSync(requests).filter(f=>f.endsWith('.json')).sort()){
      if(stopping)break;
      const request=JSON.parse(readFileSync(join(requests,file),'utf8'));
      // Any verification/RPC/journal error stops the process; never continue signing through it.
      const result=await processRegistration({review,request,observer,adapter,journal,execute});
      const output=join(state,`${result.claimId.slice(2)}.json`),temp=output+'.tmp';
      writeFileSync(temp,JSON.stringify(result,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n',{mode:0o600});renameSync(temp,output);
      console.log(JSON.stringify({claimId:result.claimId,action:result.action,mode:result.mode,transactionStatus:result.transaction?.status}));
    }
    if(once||stopping)break;
    await delay(poll);
  }while(true);
}catch(error){
  let message=error.shortMessage||error.message;
  for(const url of [process.env.SOLANA_RPC_URL,process.env.HIVE_REDEMPTION_RH_RPC_URL])if(url)message=message.split(url).join('[RPC]');
  console.error(message);process.exitCode=1;
}finally{if(release)release();}

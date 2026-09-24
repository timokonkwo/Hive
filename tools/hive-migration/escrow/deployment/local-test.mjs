import {publicClaimError} from '../public-error.mjs';
// Opt-in local operator. Signer material stays in this process, never in files or Render.
import {createServer} from 'node:http';import {timingSafeEqual,randomBytes} from 'node:crypto';
import {readFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs';import {resolve} from 'node:path';
import {Keypair} from '@solana/web3.js';import {getBase58Encoder} from '@solana/kit';import {privateKeyToAccount} from 'viem/accounts';
import {createObserver} from '../observer.mjs';import {createLiveAdapter} from '../live-adapter.mjs';import {createGateway} from '../gateway.mjs';
import {Journal,acquireServiceLock,reconcileJournal,submitOnce} from '../journal.mjs';import {processRegistration} from '../verifier-core.mjs';import {saveJson} from './safety.mjs';

export const localPolicy={maxEvmGas:'500000',maxFeePerGasWei:'1000000000',maxTotalEvmFeeWei:'250000000000000',maxSolanaTransactionCostLamports:'3000000',maxTotalSolanaCostLamports:'20000000'};
export function requireDirectLocal(req,origin){
 if(!['http://localhost:8789','http://127.0.0.1:8789'].includes(origin)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||['cf-connecting-ip','x-forwarded-for','x-forwarded-host','x-forwarded-proto'].some(h=>req.headers[h]))throw Error('Operator keys can only be loaded directly on this computer.');
}
export function memorySigners(input,c){
 let bytes;
 try{
  if(input.consent!=='local-memory-only'||typeof input.solanaPrivateKey!=='string'||typeof input.evmPrivateKey!=='string')throw Error();
  const s=input.solanaPrivateKey.trim();
  if(s.startsWith('[')){const a=JSON.parse(s);if(!Array.isArray(a)||a.length!==64||!a.every(n=>Number.isInteger(n)&&n>=0&&n<=255))throw Error();bytes=Uint8Array.from(a);a.fill(0);}
  else bytes=Uint8Array.from(getBase58Encoder().encode(s));
  if(bytes.length!==64)throw Error();const solana=Keypair.fromSecretKey(Uint8Array.from(bytes));
  let key=input.evmPrivateKey.trim();if(!key.startsWith('0x'))key='0x'+key;if(!/^0x[0-9a-f]{64}$/i.test(key))throw Error();
  const evm=privateKeyToAccount(key);key='';
  if(solana.publicKey.toBase58()!==c.admin||evm.address.toLowerCase()!==c.destinationAdmin.toLowerCase())throw Error();
  return {solana,evm};
 }catch{throw Error('Explicit local-operator consent and both matching admin private keys are required.');}
 finally{bytes?.fill(0);input.solanaPrivateKey='';input.evmPrivateKey='';}
}
export function localOwner(action,input,owner){if(action!=='availability'&&(input?.owner??input?.request?.owner)!==owner)throw Error('This local test is restricted to the approved exception wallet.');}

export function createLocalTest({review,dir,solanaRpc}){
 const base=resolve(dir,'local-test'),settingsPath=resolve(base,'gateway.json');mkdirSync(base,{recursive:true,mode:0o700});
 if(!existsSync(settingsPath))saveJson(settingsPath,{token:randomBytes(32).toString('hex'),owner:review.config.exceptionOwner,port:8788});
 const settings=JSON.parse(readFileSync(settingsPath)),requests=resolve(base,'requests'),stateDir=resolve(base,'verifier');mkdirSync(requests,{recursive:true,mode:0o700});
 let signers=null,running=false,ready=false,gatewayReady=false,phase='Keys not loaded',error=null,task=null,stopping=false,handle=null,lastVerified=0;
 const enabled=()=>gatewayReady&&ready&&running&&!error&&Date.now()-lastVerified<60000;
 const gateway=createServer(async(req,res)=>{
  const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const got=Buffer.from(req.headers.authorization??''),want=Buffer.from('Bearer '+settings.token);
  if(got.length!==want.length||!timingSafeEqual(got,want))return reply(401,{error:'Unauthorized'});
  const action=req.url?.slice(1);if(req.method!=='POST'||!['availability','quote','register','status','deposit'].includes(action))return reply(404,{error:'Not found'});
  if(action==='availability')return reply(200,{enabled:enabled()});if(!enabled()||!handle)return reply(503,{error:'Local operator is not ready.'});
  try{let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16384)throw Error('Request too large');chunks.push(chunk);}const input=JSON.parse(Buffer.concat(chunks).toString());localOwner(action,input,settings.owner);reply(200,await handle(action,input));}catch(error){reply(409,publicClaimError(error));}
 });
 gateway.on('error',()=>{gatewayReady=false;ready=false;error='Local gateway could not bind port 8788.';});gateway.listen(settings.port,'127.0.0.1',()=>{gatewayReady=true;});
 async function loop(localReview){
  let unlock;
  try{
   unlock=acquireServiceLock(stateDir);const journal=new Journal(stateDir),observer=createObserver(localReview,{solanaRpc});
   const adapter=createLiveAdapter(localReview,observer,localPolicy,signers,journal,{allowUnpause:true});
   handle=createGateway({review:localReview,observer,requestsDirectory:requests,stateDirectory:stateDir,executionEnabled:true});
   while(!stopping){
    try{
     await reconcileJournal(journal,adapter);if([...journal.latest().values()].some(e=>e.status==='failed'))throw Error('A local operator transaction failed; receipt reconciliation is required.');
     const observed=await observer.read(settings.owner);
     if(observed.destinationPaused){ready=false;phase='Activating Robinhood for the local test';await submitOnce(journal,'activation:evm','evm',{action:'unpause'},adapter);}
     else if(observed.sourcePaused){ready=false;phase='Activating Solana for the local test';await submitOnce(journal,'activation:solana','solana',{action:'unpause'},adapter);}
     else{
      ready=true;lastVerified=Date.now();phase='Local claim test ready';error=null;
      for(const file of readdirSync(requests).filter(f=>f.endsWith('.json')).sort()){
       if(stopping)break;const request=JSON.parse(readFileSync(resolve(requests,file)));localOwner('register',request,settings.owner);
       const result=await processRegistration({review:localReview,request,observer,adapter,journal,execute:true});saveJson(resolve(stateDir,result.claimId.slice(2)+'.json'),result);
      }
     }
    }catch(err){
     if([...journal.latest().values()].some(e=>e.status==='failed'))throw err;
     error=(err.shortMessage??err.message??'Local operator error').split(solanaRpc).join('[private RPC]');
     phase='Retrying after transient error';
    }
    const hasRequests=readdirSync(requests).some(f=>f.endsWith('.json'));
    if(!stopping)await new Promise(r=>setTimeout(r,hasRequests?2000:8000));
   }
  }catch(e){ready=false;error=(e.shortMessage??e.message??'Local operator stopped').split(solanaRpc).join('[private RPC]');phase='Local operator stopped';}
  finally{ready=false;running=false;handle=null;unlock?.();}
 }
 return {
  status:()=>({keysLoaded:!!signers,running,enabled:enabled(),phase,error,claimUrl:'http://localhost:3101/token/claim'}),
  load(input){if(running)throw Error('Local operator is already running.');signers=memorySigners(input,review.config);phase='Local operator keys loaded in memory';error=null;return this.status();},
  clear(){if(running)throw Error('The local operator is running. Its keys are retained until the service stops.');signers=null;phase='Keys not loaded';return this.status();},
  start(){if(running)return this.status();if(!gatewayReady||!signers||!review.deployment||review.deploymentVerified!==true)throw Error('Finish and verify deployment before starting the local test.');stopping=false;running=true;error=null;phase='Verifying local activation';
   const localReview={...review,financialActivationApproved:true,activationScope:'local_exception_only'};saveJson(resolve(base,'campaign-review.json'),localReview);task=loop(localReview);return this.status();},
  async close(){stopping=true;ready=false;await task;signers=null;gateway.close();},
 };
}

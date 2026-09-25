import {publicClaimError} from './public-error.mjs';
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createObserver} from './observer.mjs';
import {createGateway} from './gateway.mjs';
import {operatorReady} from './operator-health.mjs';

const path=resolve(process.argv[2]??''),settings=JSON.parse(readFileSync(path,'utf8'));
const secret=process.env.HIVE_CLAIM_GATEWAY_TOKEN;
if(!secret||secret.length<32)throw Error('A private gateway token of at least 32 characters is required');
if(!settings.campaignReviewFile||!process.env.SOLANA_RPC_URL)throw Error('Reviewed campaign and RPC configuration required');
const base=dirname(path),review=JSON.parse(readFileSync(resolve(base,settings.campaignReviewFile),'utf8'));
const observer=createObserver(review,{solanaRpc:process.env.SOLANA_RPC_URL,evmRpc:process.env.HIVE_REDEMPTION_RH_RPC_URL});
const handle=createGateway({review,observer,executionEnabled:settings.executionEnabled,requestsDirectory:resolve(base,settings.requestsDirectory),stateDirectory:resolve(base,settings.stateDirectory)});
createServer(async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const healthy=!settings.operatorHealthFile||operatorReady(resolve(base,settings.operatorHealthFile));
  if(req.method==='GET'&&req.url==='/healthz')return reply(200,{mode:'configured',claimsEnabled:settings.executionEnabled===true&&healthy});
  const token=Buffer.from(req.headers.authorization??''),expected=Buffer.from('Bearer '+secret);
  if(token.length!==expected.length||!timingSafeEqual(token,expected))return reply(401,{error:'Unauthorized'});
  const action=req.url?.slice(1);
  if(!healthy)return reply(action==='availability'?200:503,action==='availability'?{enabled:false}:{code:'SERVICE_UNAVAILABLE',error:'Claim service temporarily unavailable.',recovery:'check_status'});
  // A separate local gateway follows the memory-only operator's readiness.
  if(settings.operatorReadinessUrl){
    try{
      const ready=await fetch(settings.operatorReadinessUrl,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
      if(!ready.ok || (await ready.json()).enabled!==true)return reply(action==='availability'?200:503,action==='availability'?{enabled:false}:{code:'SERVICE_UNAVAILABLE',error:'Claim service temporarily unavailable.',recovery:'check_status'});
    }catch{return reply(action==='availability'?200:503,action==='availability'?{enabled:false}:{code:'SERVICE_UNAVAILABLE',error:'Claim service temporarily unavailable.',recovery:'check_status'});}
  }
  if(!['availability','quote','register','status','deposit'].includes(action)||req.method!=='POST')return reply(404,{error:'Not found'});
  try{
    let length=0;const chunks=[];
    for await(const chunk of req){length+=chunk.length;if(length>16384)return reply(413,{error:'Request too large'});chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString()||'{}');
    if(settings.onlyOwner&&action!=='availability'&&(input.owner??input.request?.owner)!==settings.onlyOwner)return reply(403,{error:'This local test is limited to the configured wallet.'});
    reply(200,await handle(action,input));
  }catch(error){reply(409,publicClaimError(error));}
}).listen(Number(process.env.HIVE_CLAIM_GATEWAY_PORT??8788),process.env.HIVE_CLAIM_GATEWAY_HOST??'127.0.0.1');

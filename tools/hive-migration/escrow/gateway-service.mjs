import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createObserver} from './observer.mjs';
import {createGateway} from './gateway.mjs';

const path=resolve(process.argv[2]??''),settings=JSON.parse(readFileSync(path,'utf8'));
const secret=process.env.HIVE_CLAIM_GATEWAY_TOKEN;
if(!secret||secret.length<32)throw Error('A private gateway token of at least 32 characters is required');
if(!settings.campaignReviewFile||!process.env.SOLANA_RPC_URL)throw Error('Reviewed campaign and RPC configuration required');
const base=dirname(path),review=JSON.parse(readFileSync(resolve(base,settings.campaignReviewFile),'utf8'));
const observer=createObserver(review,{solanaRpc:process.env.SOLANA_RPC_URL,evmRpc:process.env.HIVE_REDEMPTION_RH_RPC_URL});
const handle=createGateway({review,observer,executionEnabled:settings.executionEnabled,requestsDirectory:resolve(base,settings.requestsDirectory),stateDirectory:resolve(base,settings.stateDirectory)});
createServer(async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(req.method==='GET'&&req.url==='/healthz')return reply(200,{mode:'configured'});
  const token=Buffer.from(req.headers.authorization??''),expected=Buffer.from('Bearer '+secret);
  if(token.length!==expected.length||!timingSafeEqual(token,expected))return reply(401,{error:'Unauthorized'});
  const action=req.url?.slice(1);
  if(!['availability','quote','register','status','deposit'].includes(action)||req.method!=='POST')return reply(404,{error:'Not found'});
  try{
    let length=0;const chunks=[];
    for await(const chunk of req){length+=chunk.length;if(length>16384)return reply(413,{error:'Request too large'});chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString()||'{}');
    reply(200,await handle(action,input));
  }catch{reply(409,{error:'The migration request could not be verified. Refresh the claim status or recheck your holdings.'});}
}).listen(Number(process.env.HIVE_CLAIM_GATEWAY_PORT??8788),process.env.HIVE_CLAIM_GATEWAY_HOST??'127.0.0.1');

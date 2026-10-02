// Gateway and signer must share one persistent volume and one deployment lifetime.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {openSync,closeSync,readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bootstrapOperator} from './bootstrap.mjs';
import {writeOperatorHealth} from '../operator-health.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const dir=process.env.HIVE_OPERATOR_DATA_DIR??'/var/data/hive';
const settingsPath=process.env.HIVE_OPERATOR_SETTINGS??'/etc/secrets/verifier.inputs.json';
const reviewPath=process.env.HIVE_OPERATOR_REVIEW??'/etc/secrets/campaign-review.json';
if (!existsSync(settingsPath) || !existsSync(reviewPath)) {
  if (process.env.HIVE_OPERATOR_EXECUTE === 'true') throw Error('Cannot activate without reviewed deployment');
  const secret=process.env.HIVE_CLAIM_GATEWAY_TOKEN;
  if(!secret || secret.length<32)throw Error('Gateway token required');
  createServer((req,res)=>{
    const reply=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    if(req.method==='GET' && req.url==='/healthz')return reply(200,{mode:'standby',claimsEnabled:false});
    const got=Buffer.from(req.headers.authorization??''),expected=Buffer.from('Bearer '+secret);
    if(got.length!==expected.length || !timingSafeEqual(got,expected))return reply(401,{error:'Unauthorized'});
    if(req.method==='POST' && req.url==='/availability')return reply(200,{enabled:false});
    return reply(503,{error:'Claims are not open.'});
  }).listen(Number(process.env.PORT??10000),'0.0.0.0');
  console.log('Operator standby: no campaign or signer loaded.');
} else {
const settings=JSON.parse(readFileSync(settingsPath,'utf8'));
const review=JSON.parse(readFileSync(reviewPath,'utf8'));
const execute=process.env.HIVE_OPERATOR_EXECUTE==='true';
if(execute && (!settings.executionEnabled || review.financialActivationApproved!==true))throw Error('Operator activation not approved');
settings.executionEnabled=execute;
mkdirSync(dir,{recursive:true,mode:0o700});
const seedPath=process.env.HIVE_OPERATOR_HISTORY??'/etc/secrets/operator-history.json';
if(execute&&!existsSync(seedPath))throw Error('Reconciled operator history is required');
if(existsSync(seedPath))bootstrapOperator(dir,JSON.parse(readFileSync(seedPath,'utf8')),review.config.campaignId);
settings.campaignReviewFile=reviewPath;
settings.requestsDirectory=resolve(dir,'requests');settings.stateDirectory=resolve(dir,'verifier');
settings.operatorHealthFile=resolve(dir,'operator-health.json');
writeOperatorHealth(settings.operatorHealthFile,false);
const runtime=resolve(dir,'runtime-settings.json');
writeFileSync(runtime,JSON.stringify(settings),{mode:0o600});
// Run the explicitly selected closeout before either journal user starts.
if(execute&&process.env.HIVE_RETURN_SURPLUS==='2026-10-02-return-10m'){
 const signerFd=openSync(process.env.HIVE_OPERATOR_SIGNER??'/etc/secrets/escrow-signer.json','r');
 try{
  await new Promise((resolveReturn,reject)=>{
   const child=spawn(process.execPath,[resolve(root,'tools/hive-migration/escrow/return-surplus.mjs'),runtime],{cwd:root,env:{...process.env,HIVE_ESCROW_SIGNER_FD:'3'},stdio:['ignore','inherit','inherit',signerFd]});
   child.on('error',reject);child.on('exit',code=>code===0?resolveReturn():reject(Error('Surplus return stopped for reconciliation')));
  });
 }finally{closeSync(signerFd);}
}
const children=[];let stopping=false;
function stop(code){if(stopping)return;stopping=true;process.exitCode=code;for(const c of children)c.kill('SIGTERM');const timer=setTimeout(()=>{for(const c of children)c.kill('SIGKILL');},15000);timer.unref();}
function launch(script,args,env,stdio){const child=spawn(process.execPath,[resolve(root,'tools/hive-migration/escrow',script),...args],{cwd:root,env,stdio});children.push(child);child.on('error',()=>stop(1));child.on('exit',(code)=>stop(code||1));return child;}
const env={...process.env};delete env.HIVE_ESCROW_SIGNER_FD;
let fd;
try {
 if(execute)fd=openSync(process.env.HIVE_OPERATOR_SIGNER??'/etc/secrets/escrow-signer.json','r');
 launch('verifier-service.mjs',[runtime,...(execute?['--execute']:[])],{...env,...(execute?{HIVE_ESCROW_SIGNER_FD:'3'}:{})},['ignore','inherit','inherit',...(execute?[fd]:[])]);
}finally{if(fd!==undefined)closeSync(fd);}
launch('gateway-service.mjs',[runtime],{...env,HIVE_CLAIM_GATEWAY_HOST:'0.0.0.0',HIVE_CLAIM_GATEWAY_PORT:process.env.PORT??'10000'},['ignore','inherit','inherit']);
process.on('SIGTERM',()=>stop(0));process.on('SIGINT',()=>stop(0));

}

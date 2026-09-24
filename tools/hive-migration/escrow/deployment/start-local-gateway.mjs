// Restartable gateway without admin keys; the existing signing operator keeps running.
import {readFileSync,openSync,closeSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawn} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {saveJson} from './safety.mjs';
export async function startLocalGateway(){
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..'),dir=resolve(here,'../local/deployment-100k/local-test');
const settings=JSON.parse(readFileSync(resolve(dir,'gateway.json'))),pidPath=resolve(dir,'gateway-process.json');
if(existsSync(pidPath)){const {pid}=JSON.parse(readFileSync(pidPath));try{process.kill(pid,0);console.log('Local claim gateway already running on port 8787');return;}catch(e){if(e.code!=='ESRCH')throw e;}}
const config=resolve(dir,'gateway-service.json');
saveJson(config,{campaignReviewFile:'campaign-review.json',requestsDirectory:'requests',stateDirectory:'verifier',executionEnabled:true,onlyOwner:settings.owner,operatorReadinessUrl:'http://127.0.0.1:'+settings.port+'/availability'});
const env={...process.env,...parseEnv(readFileSync(resolve(root,'.env.local'),'utf8')),HIVE_CLAIM_GATEWAY_TOKEN:settings.token,HIVE_CLAIM_GATEWAY_PORT:'8787',HIVE_CLAIM_GATEWAY_HOST:'127.0.0.1'};
const fd=openSync(resolve(dir,'gateway-service.log'),'a',0o600);
const child=spawn(process.execPath,[resolve(here,'../gateway-service.mjs'),config],{cwd:root,env,detached:true,stdio:['ignore',fd,fd]});
await new Promise((ok,fail)=>{child.once('spawn',ok);child.once('error',fail);});child.unref();closeSync(fd);saveJson(pidPath,{pid:child.pid});
console.log(JSON.stringify({pid:child.pid,port:8787,signerLoaded:false}));

}
if(process.argv[1]===fileURLToPath(import.meta.url))await startLocalGateway();

import {readFileSync,openSync,closeSync,existsSync} from 'node:fs';import {parseEnv} from 'node:util';import {spawn} from 'node:child_process';import {dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';
import {saveJson} from './safety.mjs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..'),dir=resolve(here,'../local/deployment-100k/local-test');
const {startLocalGateway}=await import('./start-local-gateway.mjs');
await startLocalGateway();
const settings=JSON.parse(readFileSync(resolve(dir,'gateway.json'))),pidPath=resolve(dir,'app-process.json');
if(existsSync(pidPath)){const {pid}=JSON.parse(readFileSync(pidPath));try{process.kill(pid,0);console.log('Local claim app already running at http://localhost:3101/token/claim');process.exit(0);}catch(e){if(e.code!=='ESRCH')throw e;}}
const env={...process.env,...parseEnv(readFileSync(resolve(root,'.env.local'),'utf8')),HIVE_CLAIM_UI_ENABLED:'true',HIVE_LOCAL_CLAIM_TEST_OWNER:settings.owner,HIVE_CLAIM_GATEWAY_URL:'http://127.0.0.1:8787',HIVE_CLAIM_GATEWAY_TOKEN:settings.token};
const fd=openSync(resolve(dir,'app.log'),'a',0o600),child=spawn(process.execPath,[resolve(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3101'],{cwd:root,env,detached:true,stdio:['ignore',fd,fd]});
await new Promise((ok,fail)=>{child.once('spawn',ok);child.once('error',fail);});child.unref();closeSync(fd);saveJson(pidPath,{pid:child.pid});console.log(JSON.stringify({pid:child.pid,url:'http://localhost:3101/token/claim',publicEnvironmentChanged:false}));

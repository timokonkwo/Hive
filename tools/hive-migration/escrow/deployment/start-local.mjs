// Detach the localhost service from an interactive tool/terminal lifetime.
// No keys are loaded and no transactions are signed or submitted at startup.
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,renameSync,openSync,closeSync} from 'node:fs';
import {dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..'),dir=resolve(here,'../local/deployment-100k');
const lock=resolve(dir,'service.lock');
if(existsSync(lock)){
 const {pid}=JSON.parse(readFileSync(lock));
 let alive=true;try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')alive=false;else throw Error('Cannot verify the existing service process.');}
 if(alive){console.log('Signing service already running at http://localhost:8789');process.exit(0);}
 renameSync(lock,resolve(dir,`stopped-service-${pid}-${Date.now()}.lock`));
}
const remote=resolve(dir,'remote-access.json');if(existsSync(remote))renameSync(remote,resolve(dir,`remote-access-revoked-${Date.now()}.json`));
const log=resolve(dir,'service.log'),fd=openSync(log,'a',0o600);
const child=spawn(process.execPath,['--env-file='+resolve(root,'.env.local'),resolve(here,'server.mjs')],{cwd:root,detached:true,stdio:['ignore',fd,fd]});
await new Promise((ok,fail)=>{child.once('spawn',ok);child.once('error',fail);});child.unref();closeSync(fd);
console.log(JSON.stringify({pid:child.pid,url:'http://localhost:8789',log,transactionsSent:0}));

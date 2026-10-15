// Local preview companion. Uses the same authenticated recovery endpoint as Netlify.
// No keys or signing in this process. The endpoint verifies receipts and can
// rebroadcast already-authorized managed submissions from its encrypted journal.
import env from '@next/env';
import {setTimeout as delay} from 'node:timers/promises';
env.loadEnvConfig(process.cwd());
const endpoint=new URL(process.env.PONS_APP_ORIGIN||'http://localhost:3000');
if(endpoint.protocol!=='http:'||!['localhost','127.0.0.1'].includes(endpoint.hostname)||endpoint.username||endpoint.password)throw Error('Local worker requires a loopback HTTP origin');
if(!process.env.CRON_SECRET||process.env.PONS_RECONCILIATION_ENABLED!=='true')throw Error('Local recovery is not configured');
let stopping=false,last='';
process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
while(!stopping){
 try{
  const response=await fetch(new URL('/api/cron/pons-launches',endpoint),{headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`},signal:AbortSignal.timeout(55000)});
  if(!response.ok)throw Error();
  const result=await response.json();
  if(result.enabled!==true)throw Error();
  const state=JSON.stringify({enabled:result.enabled,checked:result.checked,confirmed:result.confirmed,published:result.published,errors:result.errors});
  if(state!==last||result.checked){console.log(new Date().toISOString(),state);last=state;}
 }catch{if(last!=='unavailable'){console.error('Local token recovery unavailable; retrying.');last='unavailable';}}
 if(!stopping)await delay(15000);
}

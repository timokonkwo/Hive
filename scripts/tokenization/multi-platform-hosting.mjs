// No secret values are printed. Existing encryption/worker credentials are never rotated.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import env from '@next/env';
import { request, siteId } from './hosting.mjs';
const accountId='68762b6ff4d952f16d11229e';
const production=row=>row?.values?.find(v=>v.context==='production') || row?.values?.find(v=>v.context==='all');
env.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const site=await request(`/sites/${siteId}`);
if (site.name!=='hive-protocol' || site.custom_domain!=='uphive.xyz') throw Error('Unexpected site.');
const rows=await request(`/accounts/${accountId}/env?site_id=${siteId}`);
const mode=process.argv[2] || 'status';
const names=['TOKENIZATION_JOURNAL_KEY','AGENT_MULTI_PLATFORM_LAUNCHES_ENABLED','AGENT_MULTI_PLATFORM_RECOVERY_ENABLED','HIVE_LAUNCH_KEYPAIR','HIVE_AGENT_LAUNCH_KEYPAIR','BAGS_AGENT_API_KEY','CRON_SECRET'];
if(mode==='status') {
  console.log(JSON.stringify({site:site.name,publishedDeploy:site.published_deploy?.id,settings:names.map(key=>{
    const row=rows.find(r=>r.key===key);return {key,configured:!!production(row),secret:row?.is_secret,scopes:row?.scopes,localConfigured:!!process.env[key]};
  })},null,2));
} else if(mode==='configure') {
  const current=rows.find(r=>r.key==='TOKENIZATION_JOURNAL_KEY');
  let journal=process.env.TOKENIZATION_JOURNAL_KEY;
  if(current && (!current.is_secret || !current.scopes.includes('functions') || !production(current))) throw Error('Review the existing hosted journal key settings; it will not be overwritten.');
  for(const key of ['CRON_SECRET','HIVE_LAUNCH_KEYPAIR','HIVE_AGENT_LAUNCH_KEYPAIR','BAGS_AGENT_API_KEY','CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET']) {
    if(!production(rows.find(r=>r.key===key))) throw Error(`Missing production configuration: ${key}`);
  }
  if(!current) {
    if(journal && !/^[a-f0-9]{64}$/i.test(journal)) throw Error('The existing local journal key is invalid; it will not be overwritten.');
    journal ||= randomBytes(32).toString('hex');
    // Persist before the external write, so interruption cannot lose the only copy.
    if(!process.env.TOKENIZATION_JOURNAL_KEY) {
      const previous=existsSync('.env.local')?readFileSync('.env.local','utf8'):'';
      writeFileSync('.env.local',`${previous.trimEnd()}\nTOKENIZATION_JOURNAL_KEY=${journal}\n`,{mode:0o600});
    }
    await request(`/accounts/${accountId}/env?site_id=${siteId}`,'POST',[{key:'TOKENIZATION_JOURNAL_KEY',is_secret:true,scopes:['functions'],values:[{context:'production',value:journal}]}]);
  }
  if(!journal) throw Error('The hosted journal key already exists. Configure the same key locally; do not rotate it.');
  const signer=rows.find(row=>row.key==='HIVE_AGENT_LAUNCH_KEYPAIR');
  if(!signer.is_secret) {
    const value=production(signer)?.value;
    if(typeof value!=='string' || !value.trim()) throw Error('The existing signer cannot be scoped without its saved value.');
    await request(`/accounts/${accountId}/env/HIVE_AGENT_LAUNCH_KEYPAIR?site_id=${siteId}`,'PUT',{
      key:'HIVE_AGENT_LAUNCH_KEYPAIR',is_secret:true,scopes:['functions'],values:[{context:'production',value}],
    });
  }
  for(const key of ['AGENT_MULTI_PLATFORM_RECOVERY_ENABLED','AGENT_MULTI_PLATFORM_LAUNCHES_ENABLED']) {
    if(rows.some(r=>r.key===key)) await request(`/accounts/${accountId}/env/${key}?site_id=${siteId}`,'PATCH',{context:'production',value:'true'});
    else await request(`/accounts/${accountId}/env?site_id=${siteId}`,'POST',[{key,is_secret:false,scopes:['functions'],values:[{context:'production',value:'true'}]}]);
  }
  const filename='.env.local';let local=existsSync(filename)?readFileSync(filename,'utf8'):'';
  for(const [key,value] of Object.entries({TOKENIZATION_JOURNAL_KEY:journal,AGENT_MULTI_PLATFORM_RECOVERY_ENABLED:'true',AGENT_MULTI_PLATFORM_LAUNCHES_ENABLED:'true'})) {
    const pattern=new RegExp(`^${key}=.*$`,'m');
    local=pattern.test(local)?local.replace(pattern,`${key}=${value}`):`${local.trimEnd()}\n${key}=${value}\n`;
  }
  writeFileSync(filename,local,{mode:0o600});
  console.log('Configured local and production launch flags and journal encryption. Production applies these settings on deployment. Existing worker credentials were preserved.');
} else throw Error('Use status or configure.');

import {existsSync,readFileSync,writeFileSync,mkdirSync,openSync,fsyncSync,closeSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';

// Import the reconciled local history exactly once, before either process starts.
// Restarting must never restore an older journal over subsequent public claims.
export function bootstrapOperator(directory,seed,campaignId) {
  if(seed.campaignId!==campaignId||!seed.files||typeof seed.files!=='object')throw Error('Invalid operator history');
  const digest=createHash('sha256').update(JSON.stringify(seed)).digest('hex');
  const marker=resolve(directory,'history-import.json');
  if(existsSync(marker)){
    const imported=JSON.parse(readFileSync(marker));
    if(imported.digest!==digest||imported.campaignId!==campaignId)throw Error('Operator history import changed');
    return;
  }
  for(const [name,content] of Object.entries(seed.files)){
    if(!/^(requests\/[a-f0-9]{64}\.json|verifier\/(transactions\.jsonl|[a-f0-9]{64}\.json|gateway\/[a-f0-9]{64}\.(packet|submission)\.json))$/.test(name)||typeof content!=='string')throw Error('Invalid operator history file');
  }
  const existing=[];
  function walk(dir,prefix){if(!existsSync(dir))return;for(const e of readdirSync(dir,{withFileTypes:true})){const name=prefix+e.name;if(e.isDirectory())walk(resolve(dir,e.name),name+'/');else existing.push(name);}}
  for(const name of ['requests','verifier'])walk(resolve(directory,name),name+'/');
  for(const name of existing)if(seed.files[name]===undefined||readFileSync(resolve(directory,name),'utf8')!==seed.files[name])throw Error('Existing operator history requires reconciliation');
  for(const [name,content] of Object.entries(seed.files)){
    const path=resolve(directory,name);mkdirSync(dirname(path),{recursive:true,mode:0o700});
    if(!existsSync(path))writeFileSync(path,content,{flag:'wx',mode:0o600});
    const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
  }
  mkdirSync(directory,{recursive:true,mode:0o700});
  writeFileSync(marker,JSON.stringify({campaignId,digest})+'\n',{flag:'wx',mode:0o600});
  for(const path of [marker,directory]){const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
}

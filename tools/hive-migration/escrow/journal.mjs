import {mkdirSync,readFileSync,openSync,writeSync,fsyncSync,closeSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

export class Journal {
  constructor(directory){mkdirSync(directory,{recursive:true,mode:0o700});this.path=join(directory,'transactions.jsonl');}
  entries(){
    if(!existsSync(this.path))return [];
    const text=readFileSync(this.path,'utf8');
    if(text&&!text.endsWith('\n'))throw Error('Incomplete transaction journal; manual reconciliation required');
    return text.split('\n').filter(Boolean).map(line=>JSON.parse(line));
  }
  latest(){return new Map(this.entries().map(e=>[e.id,e]));}
  append(entry){
    const fd=openSync(this.path,'a',0o600);
    try {writeSync(fd,JSON.stringify({...entry,recordedAt:new Date().toISOString()})+'\n');fsyncSync(fd);}finally{closeSync(fd);}
    // Also persist the directory entry on the first journal creation.
    const parent=openSync(join(this.path,'..'),'r');try{fsyncSync(parent);}finally{closeSync(parent);}
  }
}
export function acquireServiceLock(directory){
  mkdirSync(directory,{recursive:true,mode:0o700});
  const path=join(directory,'service.lock'),id=randomUUID();
  let fd;try{fd=openSync(path,'wx',0o600);}catch{throw Error('Verifier already running or stale lock requires operator reconciliation');}
  try{writeSync(fd,JSON.stringify({pid:process.pid,id})+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  return ()=>{if(JSON.parse(readFileSync(path,'utf8')).id!==id)throw Error('Lock ownership changed');unlinkSync(path);};
}
export async function reconcileJournal(journal,adapter){
  for(const entry of journal.latest().values()){
    if(!['prepared','submitted'].includes(entry.status))continue;
    const outcome=await adapter.lookup(entry);
    if(outcome.status==='pending')continue;
    if(!['confirmed','failed'].includes(outcome.status))throw Error('Unknown transaction outcome');
    journal.append({...entry,status:outcome.status,evidence:outcome.evidence??null});
  }
}
export async function submitOnce(journal,id,chain,action,adapter){
  const existing=journal.latest().get(id);
  if(existing)return {status:existing.status,hash:existing.hash};
  if([...journal.latest().values()].some(e=>e.chain===chain&&['prepared','submitted'].includes(e.status)))return {status:'waiting_for_chain_reconciliation'};
  const signed=await adapter.prepare(chain,action);
  const entry={id,chain,status:'prepared',...signed};
  journal.append(entry); // Durable BEFORE the first broadcast. Never auto-resubmit.
  try{await adapter.broadcast(entry);journal.append({...entry,status:'submitted'});return {status:'submitted',hash:entry.hash};}
  catch{journal.append({...entry,status:'submitted',submissionOutcome:'unknown'});return {status:'submission_unknown',hash:entry.hash};}
}

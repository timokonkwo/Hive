import {readFileSync,existsSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync} from 'node:fs';
import {dirname,join} from 'node:path';

export function requireFreshReview(directory) {
  if (existsSync(join(directory,'service.lock')) || existsSync(join(directory,'transactions.jsonl'))) throw Error('Deployment already started; preserve the review and reconcile its journal.');
  const path=join(directory,'review.json');
  if(existsSync(path) && JSON.parse(readFileSync(path)).terminalPolicyUserConfirmed) throw Error('Approved review cannot be regenerated.');
}
export function saveJson(path,value) {
  const temp=path+'.pending';
  writeFileSync(temp,JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n',{mode:0o600});
  const fd=openSync(temp,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
  renameSync(temp,path);
  const parent=openSync(dirname(path),'r');try{fsyncSync(parent);}finally{closeSync(parent);}
}
export function verifyEvmTransaction(actual,expected) {
  if(actual.from.toLowerCase()!==expected.from.toLowerCase() || actual.nonce!==Number(BigInt(expected.nonce)) || actual.input!==expected.data || (actual.to?.toLowerCase()??null)!==(expected.to?.toLowerCase()??null) || actual.value!==0n) throw Error('Wallet transaction differs from approved plan');
  if(actual.gas>BigInt(expected.gas) || actual.maxFeePerGas===undefined || actual.maxPriorityFeePerGas===undefined || actual.maxFeePerGas>BigInt(expected.maxFeePerGas) || actual.maxPriorityFeePerGas>BigInt(expected.maxPriorityFeePerGas)) throw Error('Wallet fees exceed the reviewed ceiling; reconcile the receipt before proceeding.');
}

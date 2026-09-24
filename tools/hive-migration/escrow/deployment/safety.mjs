import {readFileSync,existsSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {parseTransaction,recoverTransactionAddress,keccak256} from 'viem';

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
export async function verifySignedEvm(raw,expected) {
  if(typeof raw!=='string'||!/^0x[0-9a-f]+$/i.test(raw)||raw.length>60000)throw Error('Invalid signed transaction');
  const transaction=parseTransaction(raw);
  if(transaction.type!=='eip1559'||transaction.chainId!==4663||(transaction.accessList?.length??0)!==0)throw Error('Unexpected transaction envelope');
  const from=await recoverTransactionAddress({serializedTransaction:raw});
  // RLP represents zero as an empty byte string; viem omits these parsed fields.
  // Normalize only the signed EIP-1559 envelope, not arbitrary RPC responses.
  verifyEvmTransaction({...transaction,from,input:transaction.data??'0x',value:transaction.value??0n,maxFeePerGas:transaction.maxFeePerGas??0n,maxPriorityFeePerGas:transaction.maxPriorityFeePerGas??0n},expected);
  return keccak256(raw);
}

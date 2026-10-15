// Read-only source provenance check. Never signs, broadcasts, or enables launches.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createPublicClient,http,keccak256,toBytes,toFunctionSelector} from 'viem';
import {snapshots,abi} from './modules.mjs';
const signer=process.argv[2],directory=process.argv[3];
if(!signer||!directory)throw Error('Usage: node scripts/tokenization/verify-release.mjs <public-wallet> <evidence-directory>');
const output=resolve(directory);await mkdir(output,{recursive:true});
const client=createPublicClient({transport:http(process.env.HIVE_PONS_RPC_URL||'https://rpc.mainnet.chain.robinhood.com',{timeout:20000,retryCount:1})});
const snapshot=await snapshots.readLaunchSnapshot(client,signer);
const shape=p=>({type:p.type,...(p.components?{components:p.components.map(shape)}:{})});
const results=await Promise.all(snapshots.contractNames.map(async name=>{
 const {address,codeHash}=snapshot.contracts[name],sourceEvidence=`https://sourcify.dev/server/v2/contract/4663/${address}?fields=all`;
 const response=await fetch(sourceEvidence,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error(`${name}: source lookup HTTP ${response.status}`);
 const evidence=await response.json(),runtime=evidence.runtimeBytecode;
 if(evidence.address.toLowerCase()!==address.toLowerCase()||String(evidence.chainId)!=='4663'||!['match','exact_match'].includes(evidence.runtimeMatch))throw Error(`${name}: source verification unavailable`);
 if(keccak256(runtime.onchainBytecode)!==codeHash)throw Error(`${name}: current runtime differs from verified deployment`);
 const a=Buffer.from(runtime.recompiledBytecode.slice(2),'hex'),b=Buffer.from(runtime.onchainBytecode.slice(2),'hex');
 if(a.length!==b.length)throw Error(`${name}: runtime length mismatch`);
 for(const refs of Object.values(runtime.immutableReferences??{}))for(const {start,length}of refs){
  if(!Number.isInteger(start)||!Number.isInteger(length)||start<0||length<=0||start+length>a.length)throw Error('Invalid immutable reference');
  a.fill(0,start,start+length);b.fill(0,start,start+length);
 }
 for(const t of runtime.transformations??[]){
  if(!['immutable','cborAuxdata'].includes(t.reason))throw Error(`${name}: unexpected bytecode transformation`);
  if(t.reason==='cborAuxdata'){
   const {offset,value}=runtime.cborAuxdata[t.id],length=(value.length-2)/2;
   if(t.type!=='replace'||t.offset!==offset||offset+length!==a.length)throw Error('Only trailing compiler metadata may differ');
   a.fill(0,offset);b.fill(0,offset);
  }
 }
 if(!a.equals(b))throw Error(`${name}: executable bytes differ from compiler output`);
 const sources=evidence.sources;
 if(!Object.keys(sources??{}).length)throw Error(`${name}: missing source contents`);
 for(const [path,source]of Object.entries(sources)){
  if(keccak256(toBytes(source.content))!==evidence.metadata.sources[path]?.keccak256)throw Error(`${name}: source hash mismatch`);
 }
 const required=name==='factory'?abi.factoryAbi:name==='hook'?abi.hookAbi:name==='router'?abi.routerAbi:[];
 for(const item of required.filter(i=>i.type==='function')){
  const match=evidence.abi.find(i=>i.type==='function'&&toFunctionSelector(i)===toFunctionSelector(item));
  if(!match||JSON.stringify(match.outputs.map(shape))!==JSON.stringify(item.outputs.map(shape))||match.stateMutability!==item.stateMutability)throw Error(`${name}.${item.name}: ABI mismatch`);
 }
 await writeFile(`${output}/${name}.json`,JSON.stringify(evidence));
 return {name,address,codeHash,sourceEvidence,runtimeMatch:evidence.runtimeMatch,sourcesVerified:Object.keys(sources).length,compilation:evidence.compilation};
}));
const latest=await snapshots.readLaunchSnapshot(client,signer);
for(const row of results)if(row.codeHash!==latest.contracts[row.name].codeHash)throw Error('Deployment changed during verification');
const report={checkedAt:new Date().toISOString(),block:latest.blockNumber.toString(),reviewed:false,contracts:results};
await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

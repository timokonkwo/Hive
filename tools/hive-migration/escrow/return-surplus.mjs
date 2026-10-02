// One explicitly authorized campaign closeout. No arbitrary recipient or amount.
import {readFileSync} from 'node:fs';
import {createPublicClient,http,encodeFunctionData,keccak256,getAddress} from 'viem';
import {loadSignerFromFd} from './live-adapter.mjs';
import {Journal,acquireServiceLock,submitOnce} from './journal.mjs';
export const RETURN={id:'2026-10-02-return-10m',recipient:getAddress('0xd9dba9f0e6d3f1ac8b7f36e15ccba4ac6f740e95'),amount:10000000n*10n**18n,distributor:'0x8c7B252B62816B20ddA150d77ef02B7aD1dc3ed0',token:'0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8'};
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function validateReturn({chainId,codeHash,expectedHash,admin,signer,token,closesAt,expectedClose,finalizedTime,balance,reserved}){
 check(chainId===4663&&codeHash===expectedHash,'Return deployment mismatch');
 check(admin.toLowerCase()===signer.toLowerCase()&&token.toLowerCase()===RETURN.token.toLowerCase(),'Return authority or token mismatch');
 check(BigInt(closesAt)===BigInt(expectedClose)&&BigInt(finalizedTime)>=BigInt(closesAt),'Campaign has not closed at finality');
 check(BigInt(reserved)===0n&&BigInt(balance)>=RETURN.amount,'Outstanding claims or insufficient surplus');
}
export async function returnSurplus(settings){
 check(process.env.HIVE_RETURN_SURPLUS===RETURN.id,'Return not selected');
 const review=JSON.parse(readFileSync(settings.campaignReviewFile));
 check(review.config.distributor.toLowerCase()===RETURN.distributor.toLowerCase(),'Wrong return campaign');
 const release=acquireServiceLock(settings.stateDirectory);
 try{
 const journal=new Journal(settings.stateDirectory),id=RETURN.id+':withdrawSurplus';
 const signers=loadSignerFromFd(process.env.HIVE_ESCROW_SIGNER_FD);
 const c=createPublicClient({transport:http('https://rpc.mainnet.chain.robinhood.com',{retryCount:0,timeout:20000})});
 const abi=review.evmDeployment.abi;
 const adapter={prepare:async()=>{
   check(![...journal.latest().values()].some(e=>e.chain==='evm'&&['prepared','submitted','failed'].includes(e.status)),'Unreconciled EVM journal entry');
   const [head,finalized,chainId]=await Promise.all([c.getBlock({blockTag:'latest'}),c.getBlock({blockTag:'finalized'}),c.getChainId()]);
   const read=fn=>c.readContract({address:RETURN.distributor,abi,functionName:fn,blockNumber:head.number});
   const [admin,token,closesAt,reserved,balance,code]=await Promise.all([read('admin'),read('token'),read('closesAt'),read('reserved'),c.readContract({address:RETURN.token,abi:[{type:'function',name:'balanceOf',inputs:[{type:'address'}],outputs:[{type:'uint256'}],stateMutability:'view'}],functionName:'balanceOf',args:[RETURN.distributor],blockNumber:head.number}),c.getBytecode({address:RETURN.distributor,blockNumber:head.number})]);
   validateReturn({chainId,codeHash:keccak256(code),expectedHash:review.deployment.destinationRuntimeCodeHash,admin,signer:signers.evm.address,token,closesAt,expectedClose:review.config.closesAt,finalizedTime:finalized.timestamp,balance,reserved});
   const data=encodeFunctionData({abi,functionName:'withdrawSurplus',args:[RETURN.recipient,RETURN.amount]});
   const gas=(await c.estimateGas({account:admin,to:RETURN.distributor,data,value:0n}))*120n/100n;
   const fees=await c.estimateFeesPerGas();
   check(gas<=500000n&&fees.maxFeePerGas<=1000000000n&&gas*fees.maxFeePerGas<=500000000000000n,'Return fee ceiling exceeded');
   const [nonce,pending]=await Promise.all(['latest','pending'].map(blockTag=>c.getTransactionCount({address:admin,blockTag})));
   check(nonce===pending,'Admin has pending transactions');
   const raw=await signers.evm.signTransaction({chainId:4663,type:'eip1559',to:RETURN.distributor,value:0n,data,gas,nonce,...fees});
   return {raw,hash:keccak256(raw),nonce,maximumCost:String(gas*fees.maxFeePerGas)};
 },broadcast:async entry=>{const hash=await c.sendRawTransaction({serializedTransaction:entry.raw});check(hash.toLowerCase()===entry.hash.toLowerCase(),'Return hash mismatch');}};
 const result=await submitOnce(journal,id,'evm',{},adapter);
 console.log(JSON.stringify({event:'surplus_return',recipient:RETURN.recipient,amountRaw:String(RETURN.amount),...result}));
 }finally{release();}
}
if(process.argv[1]?.endsWith('/return-surplus.mjs')){
 try{await returnSurplus(JSON.parse(readFileSync(process.argv[2])));}catch(e){console.error(e.shortMessage??e.message);process.exitCode=1;}
}

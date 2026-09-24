// Local automatic signer. Secrets arrive once through an inherited private FD;
// they are never requested in chat, written to artifacts, or logged.
import {readFileSync,closeSync} from 'node:fs';
import {Keypair,PublicKey} from '@solana/web3.js';
import {getBase58Decoder} from '@solana/kit';
import {privateKeyToAccount} from 'viem/accounts';
import {keccak256,encodeFunctionData} from 'viem';
import {depositEvidence,depositFromAccounts,settlementInstructions,unsignedTransaction,pauseInstruction} from './client.mjs';
const requireValue=(value,message)=>{if(!value)throw Error(message);};
export function loadSignerFromFd(fdValue){
  const fd=Number(fdValue);requireValue(Number.isInteger(fd)&&fd>=3,'A private inherited signer FD (>=3) is required');
  const buffer=readFileSync(fd);closeSync(fd);
  let parsed;try{parsed=JSON.parse(buffer.toString('utf8'));}finally{buffer.fill(0);}
  requireValue(Array.isArray(parsed.solanaSecretKey)&&parsed.solanaSecretKey.length===64&&parsed.solanaSecretKey.every(x=>Number.isInteger(x)&&x>=0&&x<=255),'Invalid Solana signer material');
  const solana=Keypair.fromSecretKey(Uint8Array.from(parsed.solanaSecretKey));parsed.solanaSecretKey.fill(0);
  requireValue(typeof parsed.evmPrivateKey==='string'&&/^0x[0-9a-f]{64}$/i.test(parsed.evmPrivateKey),'Invalid EVM signer material');
  const evm=privateKeyToAccount(parsed.evmPrivateKey);parsed.evmPrivateKey='';
  return {solana,evm};
}
export function createLiveAdapter(review,observer,policy,signers,journal,{allowUnpause=false}={}){
  const c=review.config,{sol,evm,abi}=observer;
  requireValue(signers.solana.publicKey.toBase58()===c.admin&&signers.evm.address.toLowerCase()===c.destinationAdmin.toLowerCase(),'Loaded signers do not match the single admin on both chains');
  for(const k of ['maxEvmGas','maxFeePerGasWei','maxTotalEvmFeeWei','maxSolanaTransactionCostLamports','maxTotalSolanaCostLamports'])requireValue(typeof policy[k]==='string'&&/^[1-9][0-9]*$/.test(policy[k]),`Explicit positive operational limit required: ${k}`);
  const budget=(chain,cost)=>{
    const previous=[...journal.latest().values()].filter(e=>e.chain===chain).reduce((n,e)=>n+BigInt(e.maximumCost??0),0n);
    const cap=BigInt(chain==='evm'?policy.maxTotalEvmFeeWei:policy.maxTotalSolanaCostLamports);
    requireValue(previous+cost<=cap,'Operational transaction budget exhausted; stop before signing');
  };
  return {
    async partialDeposit(q,spendable){
      requireValue(spendable.length>0,'No spendable old HIVE');
      const instructions=depositFromAccounts(c,{...q,sourceTokenAccount:spendable[0].address},spendable);
      const block=await sol.getLatestBlockhash('finalized');
      const tx=unsignedTransaction(instructions,q.owner,block.blockhash);
      const simulation=await sol.simulateTransaction(tx,{sigVerify:false,replaceRecentBlockhash:true,commitment:'finalized'});
      requireValue(!simulation.value.err,'Deposit simulation failed; no admin signature produced');
      tx.sign([signers.solana]);
      return {transactionBase64:Buffer.from(tx.serialize()).toString('base64'),lastValidBlockHeight:block.lastValidBlockHeight,ownerSignatureRequired:true};
    },
    async prepare(chain,a){
      if(chain==='evm'){
        const functions={reserve:()=>['reserve',[{sourceOwner:`0x${new PublicKey(a.owner).toBuffer().toString('hex')}`,recipient:a.recipient,snapshotAmount:BigInt(a.snapshotAmount),depositAmount:BigInt(a.amount),depositDeadline:BigInt(a.depositDeadline),claimDeadline:BigInt(a.claimDeadline)},a.proof]],confirm_deposit:()=>['confirmDeposit',[a.claimId,a.depositSignature?depositEvidence(a.depositSignature):null]],claim:()=>['claim',[a.claimId]],cancel_expired:()=>['cancelExpired',[a.claimId]]};
        if(allowUnpause)functions.unpause=()=>['setPaused',[false]];
        const buildCall=functions[a.action];requireValue(buildCall,'Unsupported automatic EVM action');const call=buildCall();
        const data=encodeFunctionData({abi,functionName:call[0],args:call[1]});
        const estimated=await evm.estimateGas({account:signers.evm.address,to:c.distributor,data,value:0n});
        const gas=(estimated*120n+99n)/100n;
        requireValue(gas<=BigInt(policy.maxEvmGas),'EVM gas limit exceeds policy');
        const fees=await evm.estimateFeesPerGas();
        requireValue(fees.maxFeePerGas!==undefined&&fees.maxPriorityFeePerGas!==undefined&&fees.maxFeePerGas<=BigInt(policy.maxFeePerGasWei),'EVM fee quote exceeds policy');
        const cost=gas*fees.maxFeePerGas;budget(chain,cost);
        const nonce=await evm.getTransactionCount({address:signers.evm.address,blockTag:'pending'});
        const raw=await signers.evm.signTransaction({chainId:4663,type:'eip1559',to:c.distributor,data,value:0n,nonce,gas,...fees});
        return {raw,hash:keccak256(raw),nonce,maximumCost:cost.toString()};
      }
      requireValue(chain==='solana'&&(['release','refund'].includes(a.action)||(allowUnpause&&a.action==='unpause')),'Unsupported automatic Solana action');
      const instructions=a.action==='unpause'?[pauseInstruction(c,false)]:settlementInstructions(c,a.owner,a.action==='release',a.destinationTransactionHash,c.admin);
      const block=await sol.getLatestBlockhash('finalized');
      const tx=unsignedTransaction(instructions,c.admin,block.blockhash);
      const fee=(await sol.getFeeForMessage(tx.message,'finalized')).value;
      requireValue(fee!==null,'Solana fee quote unavailable');
      const cost=BigInt(fee)+BigInt(await sol.getMinimumBalanceForRentExemption(165,'finalized'));
      requireValue(cost<=BigInt(policy.maxSolanaTransactionCostLamports),'Solana transaction cost exceeds policy');budget(chain,cost);
      const simulation=await sol.simulateTransaction(tx,{sigVerify:false,replaceRecentBlockhash:true,commitment:'finalized'});
      requireValue(!simulation.value.err,'Settlement simulation failed');
      tx.sign([signers.solana]);
      return {raw:Buffer.from(tx.serialize()).toString('base64'),hash:getBase58Decoder().decode(tx.signatures[0]),lastValidBlockHeight:block.lastValidBlockHeight,maximumCost:cost.toString()};
    },
    async broadcast(entry){
      const hash=entry.chain==='evm'?await evm.sendRawTransaction({serializedTransaction:entry.raw}):await sol.sendRawTransaction(Buffer.from(entry.raw,'base64'),{skipPreflight:false,maxRetries:0});
      requireValue(entry.chain==='evm'?hash.toLowerCase()===entry.hash.toLowerCase():hash===entry.hash,'RPC submission hash mismatch');
    },
    async lookup(entry){
      if(entry.chain==='solana'){
        const status=(await sol.getSignatureStatuses([entry.hash],{searchTransactionHistory:true})).value[0];
        if(!status||status.confirmationStatus!=='finalized')return {status:'pending'};
        return {status:status.err?'failed':'confirmed',evidence:{slot:status.slot}};
      }
      let receipt;try{receipt=await evm.getTransactionReceipt({hash:entry.hash});}catch(error){if(error.name==='TransactionReceiptNotFoundError')return {status:'pending'};throw error;}
      const finalized=await evm.getBlock({blockTag:'finalized'});
      if(receipt.blockNumber>finalized.number)return {status:'pending'};
      const canonical=await evm.getBlock({blockNumber:receipt.blockNumber});
      requireValue(canonical.hash===receipt.blockHash,'Receipt is not canonical');
      return {status:receipt.status==='success'?'confirmed':'failed',evidence:{block:receipt.blockNumber.toString(),blockHash:receipt.blockHash}};
    },
  };
}

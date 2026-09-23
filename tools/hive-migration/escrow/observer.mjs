import {readFileSync} from 'node:fs';
import {Connection,PublicKey} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID,unpackAccount} from '@solana/spl-token';
import {getBase58Encoder} from '@solana/kit';
import {createPublicClient,http,keccak256} from 'viem';
import {addresses,claimId,hex,sha256,decodeCampaign,decodeClaim,depositInstruction} from './client.mjs';
const LOADER=new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
const check=(ok,message)=>{if(!ok)throw Error(message);};

export function createObserver(review,{solanaRpc,evmRpc='https://rpc.mainnet.chain.robinhood.com'},clients={}){
  const c=review.config,d=review.deployment;
  check(d?.solanaProgramDataAddress&&d.solanaProgramDataSha256&&d.destinationRuntimeCodeHash&&d.destinationBlock!==undefined,'Reviewed deployment fingerprints are required');
  check(c.destinationChain==='4663'&&same(c.destinationToken,'0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8')&&c.mint==='6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS','Wrong migration assets');
  const sol=clients.sol??new Connection(solanaRpc,'finalized');
  const evm=clients.evm??createPublicClient({transport:http(evmRpc,{retryCount:0,timeout:20000})});
  const abi=review.evmDeployment?.abi ?? JSON.parse(readFileSync(new URL('./evm/out/HiveDistributor.sol/HiveDistributor.json',import.meta.url),'utf8')).abi;
  check(Array.isArray(abi)&&abi.length>0,'Reviewed distributor ABI is required');
  const readAt=(blockNumber,functionName,args=[])=>evm.readContract({address:c.distributor,abi,functionName,args,blockNumber});
  return {
    sol,evm,abi,
    async read(owner){
      check(await sol.getGenesisHash()==='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d','Wrong Solana cluster');
      check(await evm.getChainId()===4663,'Wrong destination chain');
      const block=await evm.getBlock({blockTag:'finalized'});
      check(block.number!==null&&block.hash,'Finalized destination block unavailable');
      const code=await evm.getBytecode({address:c.distributor,blockNumber:block.number});
      check(code&&same(keccak256(code),d.destinationRuntimeCodeHash),'Distributor code fingerprint changed');
      const p=addresses(c.program,c.admin,c.campaignId,owner);
      const accounts=await sol.getMultipleAccountsInfoAndContext([p.campaign,p.claim,new PublicKey(c.program),new PublicKey(d.solanaProgramDataAddress),p.vault],{commitment:'finalized'});
      const [campaignAccount,claimAccount,programAccount,programData,vault]=accounts.value;
      check(programAccount?.executable&&programAccount.owner.equals(LOADER)&&programAccount.data.readUInt32LE(0)===2&&new PublicKey(programAccount.data.subarray(4,36)).toBase58()===d.solanaProgramDataAddress,'Unexpected Solana program/loader');
      check(programData?.owner.equals(LOADER)&&programData.data.readUInt32LE(0)===3&&sha256(programData.data).toString('hex')===d.solanaProgramDataSha256,'Solana code/upgrade authority fingerprint changed');
      check(campaignAccount?.owner.equals(new PublicKey(c.program)),'Wrong campaign program owner');
      const chain=decodeCampaign(campaignAccount.data);
      for(const f of ['campaignId','admin','collection','mint','root','destinationChain','distributor','opensAt','closesAt','claimGrace','totalEligibleOldRaw','fundingBudgetRaw','allowPartialSurrender','minimumCurrentHoldingRaw'])check(['admin','collection','mint'].includes(f)?chain[f]===c[f]:same(chain[f],f==='minimumCurrentHoldingRaw'?(c[f]??'0'):c[f]),`Source configuration mismatch: ${f}`);
      check(vault,'Missing source vault');
      const vaultToken=unpackAccount(p.vault,vault,TOKEN_PROGRAM_ID);
      check(vaultToken.owner.equals(p.campaign)&&vaultToken.mint.equals(new PublicKey(c.mint))&&!vaultToken.isFrozen,'Invalid source vault');
      const fields={campaignId:c.campaignId,sourceCampaign:hex(p.campaign.toBytes()),sourceMint:hex(new PublicKey(c.mint).toBytes()),snapshotRoot:c.root,token:c.destinationToken,admin:c.destinationAdmin,opensAt:c.opensAt,closesAt:c.closesAt,claimGrace:c.claimGrace,totalEligibleOldRaw:c.totalEligibleOldRaw,fundingBudgetRaw:c.fundingBudgetRaw,allowPartialSurrender:c.allowPartialSurrender};
      for(const [f,value] of Object.entries(fields))check(same(await readAt(block.number,f),value),`Destination configuration mismatch: ${f}`);

      const reserved=await readAt(block.number,'reserved');
      const balance=await evm.readContract({address:c.destinationToken,abi:[{type:'function',name:'balanceOf',stateMutability:'view',inputs:[{type:'address'}],outputs:[{type:'uint256'}]}],functionName:'balanceOf',args:[c.distributor],blockNumber:block.number});
      check(balance>=reserved,'Destination inventory is below its reserved liabilities');
      const id=hex(claimId(p.campaign,owner)),destination=await readAt(block.number,'getClaim',[id]);
      let source=null;
      if(claimAccount?.data.length){
        check(claimAccount.owner.equals(new PublicKey(c.program)),'Wrong source claim owner');
        source=decodeClaim(claimAccount.data);
        check(source.owner===new PublicKey(owner).toBase58()&&source.campaign===p.campaign.toBase58(),'Wrong source claim binding');
        if(source.status===1)check(vaultToken.amount>=BigInt(source.amount),'Source escrow has insufficient locked tokens');
      }
      if(Number(destination.status)!==0)check(same(destination.quote.sourceOwner,hex(new PublicKey(owner).toBytes())),'Wrong destination owner');
      return {finalized:true,deploymentVerified:true,source,destination,sourceSlot:accounts.context.slot,destinationBlock:block.number.toString(),destinationBlockHash:block.hash,destinationTimestamp:block.timestamp.toString(),sourcePaused:chain.paused,destinationPaused:await readAt(block.number,'paused'),availableInventoryRaw:(balance-reserved).toString()};
    },
    async spendable(owner,minContextSlot){
      const accounts=await sol.getTokenAccountsByOwner(new PublicKey(owner),{mint:new PublicKey(c.mint)},{commitment:'finalized',minContextSlot});
      return accounts.value.map(({pubkey,account})=>{
        const a=unpackAccount(pubkey,account,TOKEN_PROGRAM_ID);
        check(a.owner.toBase58()===owner&&a.mint.toBase58()===c.mint,'Wrong source token account');
        return {address:pubkey.toBase58(),owner,mint:c.mint,amountRaw:a.amount.toString(),frozen:a.isFrozen};
      }).filter(a=>!a.frozen&&BigInt(a.amountRaw)>0n).sort((a,b)=>BigInt(a.amountRaw)>BigInt(b.amountRaw)?-1:1);
    },
    async depositEvidence(q,observed,preferredSignature){
      const p=addresses(c.program,c.admin,c.campaignId,q.owner);
      const signatures=preferredSignature?[{signature:preferredSignature}]:await sol.getSignaturesForAddress(p.claim,{limit:1000},'finalized');
      for(const entry of signatures){
        const tx=await sol.getTransaction(entry.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
        if(!tx?.meta||tx.meta.err||tx.slot>observed.sourceSlot)continue;
        const message=tx.transaction.message;
        const keys=message.getAccountKeys({accountKeysFromLookups:tx.meta.loadedAddresses});
        for(const instruction of message.compiledInstructions??message.instructions){
          const indices=instruction.accountKeyIndexes??instruction.accounts;
          if(!keys.get(instruction.programIdIndex)?.equals(new PublicKey(c.program))||indices.length<9||!keys.get(indices[2])?.equals(p.claim))continue;
          const actual=typeof instruction.data==='string'?Buffer.from(getBase58Encoder().encode(instruction.data)):Buffer.from(instruction.data);
          const expected=depositInstruction(c,{...q,sourceTokenAccount:keys.get(indices[3]).toBase58()});
          if(!actual.equals(expected.data))continue;
          const amountAt=(balances,address)=>BigInt(balances.find(b=>keys.get(b.accountIndex)?.equals(address)&&b.mint===c.mint)?.uiTokenAmount.amount??'0');
          const vaultIncrease=amountAt(tx.meta.postTokenBalances??[],p.vault)-amountAt(tx.meta.preTokenBalances??[],p.vault);
          if(vaultIncrease!==BigInt(q.amount))continue;
          return entry.signature;
        }
      }
      throw Error('No matching finalized deposit transaction found; supply its signature for bounded-history recovery');
    },
    async settlementEvidence(q,observed){
      const paid=Number(observed.destination.status)===3;
      check(paid||Number(observed.destination.status)===4,'No terminal destination outcome');
      const event=abi.find(x=>x.type==='event'&&x.name===(paid?'Paid':'Cancelled'));
      const start=BigInt(d.destinationBlock);let end=BigInt(observed.destinationBlock);
      while(end>=start){
        const from=end-start>4999n?end-4999n:start;
        const logs=await evm.getLogs({address:c.distributor,event,args:{claimId:q.claimId},fromBlock:from,toBlock:end});
        for(const log of logs){
          if(log.removed)continue;
          if(paid)check(same(log.args.recipient,q.recipient)&&BigInt(log.args.amount)===BigInt(q.grant),'Payment event does not match grant');
          const receipt=await evm.getTransactionReceipt({hash:log.transactionHash});
          const block=await evm.getBlock({blockNumber:receipt.blockNumber});
          check(receipt.status==='success'&&same(receipt.blockHash,block.hash)&&same(receipt.blockHash,log.blockHash)&&receipt.blockNumber<=BigInt(observed.destinationBlock),'Settlement receipt is not finalized/canonical');
          return log.transactionHash;
        }
        if(from===start)break;end=from-1n;
      }
      throw Error('Finalized settlement event missing');
    },
  };
}

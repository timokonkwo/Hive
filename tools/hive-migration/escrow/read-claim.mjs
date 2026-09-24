// Read-only diagnostic. Does not sign attestations or broadcast any transaction.
import {readFileSync} from 'node:fs';
import {Connection, PublicKey} from '@solana/web3.js';
import {createPublicClient, http} from 'viem';
import {addresses, claimId, hex, decodeCampaign, decodeClaim, exceptionTerms} from './client.mjs';
import {nextAction} from './settlement.mjs';
const [reviewPath,owner]=process.argv.slice(2);
try {
  if(!reviewPath||!owner||process.argv.length!==4)throw Error('Usage: node --env-file=.env.local read-claim.mjs <campaign-review.json> <Solana owner>');
  if(!process.env.SOLANA_RPC_URL)throw Error('SOLANA_RPC_URL required');
  const {config}=JSON.parse(readFileSync(reviewPath,'utf8'));const c={...config,...exceptionTerms(config)};
  const {abi}=JSON.parse(readFileSync(new URL('./evm/out/HiveDistributor.sol/HiveDistributor.json',import.meta.url),'utf8'));
  const p=addresses(c.program,c.admin,c.campaignId,owner);
  const sol=new Connection(process.env.SOLANA_RPC_URL,'finalized');
  const evm=createPublicClient({transport:http(process.env.HIVE_REDEMPTION_RH_RPC_URL||'https://rpc.mainnet.chain.robinhood.com',{retryCount:0,timeout:20000})});
  if(await sol.getGenesisHash()!=='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')throw Error('Wrong Solana cluster');
  if(await evm.getChainId()!==4663)throw Error('Wrong destination chain');
  // Never silently substitute latest/confirmed when finalized is unsupported.
  const block=await evm.getBlock({blockTag:'finalized'});
  const read=(functionName,args=[])=>evm.readContract({address:c.distributor,abi,functionName,args,blockNumber:block.number});
  const accountRead=await sol.getMultipleAccountsInfoAndContext([p.campaign,p.claim],{commitment:'finalized'});
  const [configAccount,claimAccount]=accountRead.value;
  if(!configAccount?.owner.equals(new PublicKey(c.program)))throw Error('Missing or wrong campaign program owner');
  const chainConfig=decodeCampaign(configAccount.data);
  for(const field of ['campaignId','admin','collection','mint','root','destinationChain','distributor','opensAt','closesAt','claimGrace','totalEligibleOldRaw','fundingBudgetRaw','allowPartialSurrender','exceptionOwner','exceptionAllowanceRaw','exceptionGrantRaw','exceptionOpensAt'])if(String(chainConfig[field]).toLowerCase()!==String(c[field]).toLowerCase())throw Error(`Solana campaign mismatch: ${field}`);
  const expected={campaignId:c.campaignId,sourceCampaign:hex(p.campaign.toBytes()),sourceMint:hex(new PublicKey(c.mint).toBytes()),snapshotRoot:c.root,token:c.destinationToken,admin:c.destinationAdmin,opensAt:c.opensAt,closesAt:c.closesAt,claimGrace:c.claimGrace,totalEligibleOldRaw:c.totalEligibleOldRaw,fundingBudgetRaw:c.fundingBudgetRaw,allowPartialSurrender:c.allowPartialSurrender,exceptionOwner:hex(new PublicKey(c.exceptionOwner).toBytes()),exceptionAllowanceRaw:c.exceptionAllowanceRaw,exceptionGrantRaw:c.exceptionGrantRaw,exceptionOpensAt:c.exceptionOpensAt};
  // Small batches avoid public RPC overload; all destination reads pin the same finalized block.
  for(const [field,value] of Object.entries(expected))if(String(await read(field)).toLowerCase()!==String(value).toLowerCase())throw Error(`Distributor mismatch: ${field}`);

  const id=hex(claimId(p.campaign,owner));
  const destination=await read('getClaim',[id]);
  let source=null;
  // A system-owned, empty, pre-funded claim PDA is not an initialized deposit.
  if(claimAccount && claimAccount.data.length>0){
    if(!claimAccount.owner.equals(new PublicKey(c.program)))throw Error('Wrong claim account owner');
    source=decodeClaim(claimAccount.data);
    if(source.owner!==new PublicKey(owner).toBase58()||source.campaign!==p.campaign.toBase58())throw Error('Wrong source claim binding');
  }
  if(Number(destination.status)!==0&&destination.quote.sourceOwner.toLowerCase()!==hex(new PublicKey(owner).toBytes()))throw Error('Wrong destination source owner');
  const destinationPaused=await read('paused');
  let action=nextAction(source,destination,block.timestamp);
  if((destinationPaused&&['reserve','deposit','confirm_deposit','claim'].includes(action))||(chainConfig.paused&&action==='deposit'))action='paused';
  console.log(JSON.stringify({mode:'read_only_diagnostic_not_attestation',claimId:id,sourceFinalizedSlot:accountRead.context.slot,destinationFinalizedBlock:block.number,destinationBlockHash:block.hash,sourcePaused:chainConfig.paused,destinationPaused,source,destination,suggestedAction:action,limitations:['Before signing, independently verify deployed code and upgrade authority, transaction evidence, finality policy and current reservation/deadline. This report does not authorize or submit a transaction.']},(_,v)=>typeof v==='bigint'?v.toString():v,2));
}catch(error){console.error(error.shortMessage||error.message);process.exitCode=1;}

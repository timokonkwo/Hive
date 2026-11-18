// Read-only inventory of known team launch wallets. Does not reserve or move funds.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {formatUnits,formatEther,createPublicClient,http,parseAbi} from 'viem';
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const json=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2);
const tokenAbi=parseAbi(['function decimals() view returns (uint8)','function totalSupply() view returns (uint256)','function balanceOf(address) view returns (uint256)']);
try {
 const manifest=JSON.parse(await readFile(new URL('./local/hive-launch-manifest.json',import.meta.url)));
 const token='0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8';
 const client=createPublicClient({transport:http('https://rpc.mainnet.chain.robinhood.com',{timeout:20000,retryCount:1})});
 requireThat(await client.getChainId()===4663,'Wrong network');
 const block=await client.getBlock();
 const read=(functionName,args=[])=>client.readContract({address:token,abi:tokenAbi,functionName,args,blockNumber:block.number});
 const [decimals,supply]=await Promise.all([read('decimals'),read('totalSupply')]);
 requireThat(decimals===18,'Unexpected new-HIVE decimals');
 const seen=new Set();
 const rows=[];
 for(let offset=0;offset<manifest.recipients.length;offset+=3){
 rows.push(...await Promise.all(manifest.recipients.slice(offset,offset+3).map(async(r,j)=>{
   const i=offset+j;
   requireThat(!seen.has(r.address.toLowerCase()),'Duplicate launch wallet');seen.add(r.address.toLowerCase());
   const [balance,eth]=await Promise.all([read('balanceOf',[r.address]),client.getBalance({address:r.address,blockNumber:block.number})]);
   return {launchOrder:i+1,address:r.address,hiveRaw:balance,hive:formatUnits(balance,18),eth:formatEther(eth)};
 })));
 }
 const total=rows.reduce((n,r)=>n+r.hiveRaw,0n),draft=11372000n*10n**18n;
 const report={checkedAt:new Date(Number(block.timestamp)*1000).toISOString(),chainId:4663,blockNumber:block.number,blockHash:block.hash,token,
  supply:formatUnits(supply,18),knownTeamWalletCount:rows.length,aggregateHIVE:formatUnits(total,18),illustrativeGrantBudgetHIVE:'11372000',
  sufficientAggregateForDraft:total>=draft,walletsIndividuallyHoldingDraftAmount:rows.filter(r=>r.hiveRaw>=draft).map(r=>r.address),rows,
  limitation:'Observed balances only. Other obligations, chosen funding sources and authorization to spend are not established. No token or ETH transfer performed.'};
 const dir=new URL('./local/',import.meta.url);await mkdir(dir,{recursive:true,mode:0o700});
 const file=new URL(`funding-${Date.now()}.json`,dir);await writeFile(file,json(report)+'\n',{flag:'wx',mode:0o600});
 console.log(json({file:file.pathname,...report,rows:undefined}));
}catch(error){console.error(json({ok:false,error:error.shortMessage??error.message}));process.exitCode=1}

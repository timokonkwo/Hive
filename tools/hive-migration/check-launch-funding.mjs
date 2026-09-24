import {createPublicClient,http,parseAbi,formatUnits} from 'viem';
import {Connection,PublicKey} from '@solana/web3.js';
import {writeFileSync,statSync,readFileSync} from 'node:fs';
const client=createPublicClient({transport:http('https://rpc.mainnet.chain.robinhood.com',{timeout:20000})});
const admin='0xC5496066af938bf19B0f78E2197262Bf10AF9FD0',token='0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8';
const supplemental=JSON.parse(readFileSync(new URL('../../data/hive-claim-supplemental.json',import.meta.url)));
const required=BigInt(supplemental.totalFundingRequiredRaw);
try {
 if(await client.getChainId()!==4663)throw Error('Wrong destination chain');
 const blockNumber=await client.getBlockNumber();
 const [balance,gas,decimals]=await Promise.all([client.readContract({address:token,abi:parseAbi(['function balanceOf(address) view returns (uint256)']),functionName:'balanceOf',args:[admin],blockNumber}),client.getBalance({address:admin,blockNumber}),client.readContract({address:token,abi:parseAbi(['function decimals() view returns (uint8)']),functionName:'decimals',blockNumber})]);
 if(decimals!==18)throw Error('Unexpected token decimals');
 const sol=new Connection(process.env.SOLANA_RPC_URL,'finalized');
 if(await sol.getGenesisHash()!=='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')throw Error('Wrong source chain');
 const source=await sol.getBalanceAndContext(new PublicKey('CmKcjG6tvNy26z5CVd58mgPTs5RPzeJvmjGDvqXxpwLF'),'finalized');
 const programBytes=statSync(new URL('./escrow/solana/target/deploy/hive_redemption_escrow.so',import.meta.url)).size;
 const rents=await Promise.all([36,programBytes+45,programBytes+37].map(n=>sol.getMinimumBalanceForRentExemption(n,'finalized')));
 const report={programBytes,programMaxDataLength:programBytes,rentEstimateAssumption:'Exact-sized loader-v3 deployment; buffer funds reused. Excludes transaction fees and campaign/account initialization.',solanaProgramRentLamports:rents[0],solanaProgramDataRentLamports:rents[1],temporaryBufferRentLamports:rents[2],solanaDeploymentRentLamports:rents[0]+Math.max(rents[1],rents[2]),checkedAt:new Date().toISOString(),destinationBlock:blockNumber.toString(),admin,newHiveBalance:formatUnits(balance,18),requiredNewHive:formatUnits(required,18),shortfallNewHive:formatUnits(balance<required?required-balance:0n,18),nativeEth:formatUnits(gas,18),solanaSlot:source.context.slot,solanaAdminLamports:source.value,readOnly:true};
 writeFileSync(new URL('./local/launch-funding-latest.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch{console.error('Funding read failed. No transaction sent.');process.exitCode=1;}

// Creates immutable review artifacts; does not sign, deploy, unpause or broadcast.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PublicKey} from '@solana/web3.js';
import {getAddress, zeroAddress} from 'viem';
import {addresses, bytes, hex, integer, sha256, snapshotTree, initializeInstruction, serializeInstruction, validateAllocationConfig, grantForDeposit,exceptionTerms,NO_EXCEPTION_OWNER} from './client.mjs';
const SOL_MINT='6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS';
const RH_TOKEN='0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8';
const SNAPSHOT_HASH='cce4c645194e8b7fa1f1b600c0332e099cb488dce47ffa66fcf6b50920f5daaa';
const POOL='HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC';
const fail = message => { throw Error(message); };
const sol = value => { if(typeof value!=='string')fail('Missing public Solana address'); const p=new PublicKey(value); if(p.equals(PublicKey.default))fail('Zero Solana address'); return p.toBase58(); };
const evm = value => { if(typeof value!=='string')fail('Missing public EVM address');const a=getAddress(value);if(a===zeroAddress)fail('Zero EVM address');return a; };
export function validateCampaign(c, snapshot, reviewed) {
  if(c.authorityModel!=='single_admin_automated_verifier'||'attestors' in c||'destinationAttestors' in c)fail('Single-admin configuration required');
  for(const approval of ['classificationsApproved','grantAmountsApproved','terminalAttemptPolicyApproved'])if(c[approval]!==true)fail(`Missing explicit decision: ${approval}`);
  if(c.allocationRevision?.method!=='proportional_to_frozen_eligible_holdings')fail('Explicit proportional allocation method required');
  if('minimums' in c || 'grants' in c)fail('Legacy tier configuration is incompatible');
  if(typeof c.allowPartialSurrender!=='boolean')fail('Explicit partial-surrender policy required');
  if(c.minimumCurrentHoldingRaw!=='1000000000000000')fail('Current holding minimum must be 1M old HIVE');
  if(c.snapshotSlot!==449032979 || c.holdersSha256!==SNAPSHOT_HASH || c.mint!==SOL_MINT || c.destinationChain!=='4663' || evm(c.destinationToken)!==getAddress(RH_TOKEN))fail('Wrong campaign asset, chain or cutoff');
  for(const field of ['program','admin','collection'])sol(c[field]);
  for(const field of ['distributor','destinationAdmin'])evm(c[field]);
  if(bytes(c.campaignId,32).equals(Buffer.alloc(32)))fail('Empty campaign ID');
  if(c.claimWindowSeconds!=='604800')fail('Selected claim window must be exactly seven days');
  integer(c.opensAt,8);
  const closesAt=(BigInt(c.opensAt)+604800n).toString();
  if(c.closesAt!=null&&c.closesAt!==closesAt)fail('Claim window must close exactly seven days after opening');
  c={...c,closesAt};
  for(const field of ['closesAt','claimGrace'])integer(c[field],8);
  if(BigInt(c.opensAt)>=BigInt(c.closesAt)||BigInt(c.claimGrace)<3600n||BigInt(c.closesAt)+BigInt(c.claimGrace)>=2n**64n)fail('Invalid claim window');
  const source=new Map(snapshot.map(h=>[h.owner,h]));
  if(!Array.isArray(reviewed)||reviewed.length===0)fail('Explicit reviewed holder selection required');
  let total=0n;
  const owners=new Set();
  for(const h of reviewed){
    const owner=sol(h.owner);
    if(owners.has(owner))fail('Duplicate owner');owners.add(owner);
    const old=source.get(owner);
    if(!old||h.owner===POOL||h.eligible!==true||typeof h.reviewNote!=='string'||!h.reviewNote.trim())fail('Unreviewed, excluded or absent owner');
    // Program custody cannot sign this V1 owner path; handle separately after reconciliation.
    if(!PublicKey.isOnCurve(new PublicKey(h.owner).toBytes()))fail('Program custody requires a separately reviewed migration path');
    integer(h.amountRaw,8);
    if(BigInt(h.amountRaw)<BigInt(c.minimumCurrentHoldingRaw))fail('Reviewed snapshot allowance is below the 1M minimum');
    if(BigInt(h.amountRaw)<=0n||BigInt(h.amountRaw)>BigInt(old.amountRaw))fail('Allowance exceeds frozen snapshot');
    total+=BigInt(h.amountRaw);
  }
  if(c.totalEligibleOldRaw!=null && c.totalEligibleOldRaw!==total.toString())fail('Eligible denominator must equal reviewed allowances');
  c={...c,totalEligibleOldRaw:total.toString()};
  c={...c,...exceptionTerms(c)};
  validateAllocationConfig(c);
  if(c.exceptionOwner!==NO_EXCEPTION_OWNER && (c.supplementalGrantApproved!==true || source.has(c.exceptionOwner) || owners.has(c.exceptionOwner)))fail('Supplemental exception must be explicitly approved and separate from the frozen population');
  const budget=reviewed.reduce((sum,h)=>sum+BigInt(grantForDeposit(c,h.amountRaw,h.amountRaw,h.owner)),0n);
  if(BigInt(c.fundingBudgetRaw)<budget)fail('Approved budget cannot cover every selected maximum allocation');
  const tree=snapshotTree(c.campaignId,c.mint,reviewed);
  const sourceCampaign=addresses(c.program,c.admin,c.campaignId).campaign;
  return {config:{...c,root:tree.root},tree,ordinaryGrantLiabilityRaw:budget.toString(),maximumGrantLiabilityRaw:(budget+BigInt(c.exceptionGrantRaw)).toString(),totalFundingRequiredRaw:(BigInt(c.fundingBudgetRaw)+BigInt(c.exceptionGrantRaw)).toString(),sourceCampaign:sourceCampaign.toBase58()};
}
export function prepare(configPath, outputDirectory) {
  const base=dirname(resolve(configPath)), c=JSON.parse(readFileSync(configPath,'utf8'));
  // Validate decisions before loading any optional paths or compiling deployment artifacts.
  if(!c.reviewedHoldersFile)fail('reviewedHoldersFile is missing; no eligibility selection has been approved');
  const snapshotBytes=readFileSync(resolve(base,c.snapshotDirectory,'holders.json'));
  if(sha256(snapshotBytes).toString('hex')!==SNAPSHOT_HASH)fail('Frozen snapshot hash mismatch');
  const result=validateCampaign(c,JSON.parse(snapshotBytes),JSON.parse(readFileSync(resolve(base,c.reviewedHoldersFile),'utf8')));
  const config=result.config;
  const artifact=JSON.parse(readFileSync(new URL('./evm/out/HiveDistributor.sol/HiveDistributor.json',import.meta.url),'utf8'));
  const constructorArguments=[config.destinationToken,config.destinationAdmin,config.campaignId,hex(new PublicKey(result.sourceCampaign).toBytes()),hex(new PublicKey(config.mint).toBytes()),config.root,config.opensAt,config.closesAt,config.claimGrace,config.totalEligibleOldRaw,config.fundingBudgetRaw,config.allowPartialSurrender,[hex(new PublicKey(config.exceptionOwner).toBytes()),config.exceptionAllowanceRaw,config.exceptionGrantRaw,config.exceptionOpensAt]];
  const output={...result,createdAt:new Date().toISOString(),mode:'unsigned_review_only',depositsEnabled:false,solanaInitialize:serializeInstruction(initializeInstruction(config)),evmDeployment:{constructorArguments,bytecode:artifact.bytecode.object,abi:artifact.abi}};
  mkdirSync(outputDirectory,{recursive:true});
  const path=resolve(outputDirectory,'campaign-review.json');
  writeFileSync(path,JSON.stringify(output,null,2)+'\n',{flag:'wx',mode:0o600});
  return path;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try {
    if(process.argv.length!==4)fail('Usage: node prepare-campaign.mjs <config.json> <new-output-directory>');
    console.log(prepare(process.argv[2],process.argv[3]));
  }catch(error){console.error(error.message);process.exitCode=1;}
}

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LaunchDialog } from '../../components/redesign/tokenization/LaunchDialog';
import { AgentsPanel } from '../../components/redesign/admin/Records';
import foundation from '../../components/redesign/foundation.module.css';
import { parseUnits } from 'viem';
const evm='0xc5496066af938bf19b0f78e2197262bf10af9fd0', managed='0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2';
const sol='8CrDTtkdDr54LsB9vQi1PZzVNmAA1KHkcts2EAK9W11z', id='0123456789abcdef01234567';
const token={platform:'pons',network:'robinhood',address:'0x2222222222222222222222222222222222222222',symbol:'SAGE',transactionHash:'0x'+'a'.repeat(64)};
const f=window.fixture={calls:[],signs:0,session:null,review:null,modalOpen:false,connected:true,failed:false,timeout:false,role:'admin', agentName:'Sage'};
f.wallet={address:'0xC5496066af938bf19B0f78E2197262Bf10AF9FD0',walletClientType:'Test EVM'};
f.solanaWallet={address:sol};
f.sign=async bytes=>{f.signs++;if(f.reject)throw Error('Wallet request declined.');return{signedTransaction:bytes};};
const metadata=()=>({name:f.agentName,description:'Research agent on Hive.',symbol:'SAGE',avatarSeed:'sage',socials:{website:'https://uphive.xyz/agent/id/'+id,twitter:'',telegram:''}});
const preview=role=>({agentId:id,role,metadata:metadata(),requiredSigner:role==='owner'?evm:null,recipient:role==='owner'?evm:'0x4a7c1d6872c6B7D0AAC1ab2311F15b2D750A9B19',issues:[],existingToken:null,signingEnabled:true,feePolicyVersion:2,
 adminProfile:role==='admin'?{name:f.agentName,bio:'Research agent on Hive.',imageUrl:'',revision:'a'.repeat(64)}:undefined,managedDeployer:{address:managed,available:true}});
const result=()=>({session:f.session,review:f.review,editablePlatforms:f.session?.targets.filter(t=>!["confirmed","submitted","confirming"].includes(t.phase)).map(t=>t.terms.platform)||[]});
const current=()=>f.session?.targets.find(t=>!['confirmed','skipped'].includes(t.phase));
function prepare(){const t=current();if(t.terms.platform==='pons'){t.phase='preparing';return;}t.phase='awaiting-signature';f.review={id:'step-'+t.terms.platform,platform:t.terms.platform,stage:'launch',signer:t.terms.signer,mode:t.terms.mode,transaction:'AQ==',digest:'a'.repeat(64),maximumDebit:'5000000',networkFee:'5000',blockhash:sol,expiresAt:new Date(Date.now()+(f.expired?-1000:60000)).toISOString()};}
function check(){const t=current();if(t&&['submitted','confirming'].includes(t.phase)){if(f.failed){t.phase='failed';t.error='Transaction failed.';f.session.paused=true;f.failed=false;}else{t.phase='confirmed';t.token={...token,platform:t.terms.platform,network:t.terms.platform==='pons'?'robinhood':'solana',address:t.terms.platform==='pons'?token.address:t.terms.platform==='bags'?sol:'CmKcjG6tvNy26z5CVd58mgPTs5RPzeJvmjGDvqXxpwLF',transactionHash:t.terms.platform==='pons'?token.transactionHash:'2'.repeat(88)};}}}
async function request(url,init){f.calls.push({url,body:init?.body?JSON.parse(init.body):null});await new Promise(r=>setTimeout(r,40));const path=new URL(url,location.origin),body=init?.body?JSON.parse(init.body):{},role=path.searchParams.get('role'),route=path.pathname.split('/').at(-1);
 if(location.search==='?adminAgents') {
  if(init?.method && init.method!=='GET')throw Error('Pagination fixture must not submit a launch');
  const details=window.adminLaunchFixtures.find(row=>row.preview.agentId===path.pathname.split('/')[3]);
  if(!details)throw Error('Admin selected the wrong agent');
  return Response.json(details);
 }
 if(route==='session'){
  if(!body.action){const tokens=f.session?.targets.flatMap(t=>t.token?[t.token]:[])||[];return Response.json({preview:preview(role),profileRevision:'a'.repeat(64),tokens,wallets:{evm,solana:sol},deployers:{evm:{address:managed,available:true},solana:{address:sol,available:true}},readOnly:!!f.readOnly,options:f.options||['pons','bags','pump'].map(platform=>({platform,available:true,purchaseAvailable:true,token:tokens.find(t=>t.platform===platform)})),...result()});}
  if(body.action==='create'||body.action==='revise')f.session={id:body.id,agentId:id,role,metadata:{...metadata(),symbol:body.symbol},profileRevision:'a'.repeat(64),digest:'b'.repeat(64),revision:0,paused:false,createdAt:new Date().toISOString(),targets:body.choices.sort((a,b)=>['bags','pump','pons'].indexOf(a.platform)-['bags','pump','pons'].indexOf(b.platform)).map(terms=>({terms:{...terms,purchase:parseUnits(terms.purchase,terms.platform==='pons'?18:9).toString()},phase:'queued'}))};
  if(body.action==='pause'){f.session.paused=true;f.session.editing=true;delete f.session.approval;}
  if(body.action==='estimate')f.session.estimate={digest:'e'.repeat(64),expiresAt:new Date(Date.now()+300000).toISOString(),limits:Object.fromEntries(f.session.targets.map(t=>[t.terms.platform,t.terms.platform==='pons'?'1000000000000000':'100000000']))};
  if(body.action==='estimate'&&f.unfunded){delete f.session.estimate;delete f.session.approval;f.session.paused=true;current().error=`The Solana launch wallet needs more SOL for fees and account rent. Balance: 0.020920853 SOL. Fund ${sol}, then continue.`;}
  if(body.action==='estimate'&&!f.unfunded)for(const target of f.session.targets)delete target.error;
  if(body.action==='approve'){f.session.approval={digest:f.session.digest,expiresAt:new Date(Date.now()+86400000).toISOString(),limits:f.session.estimate.limits,reserved:{}};f.session.paused=false;f.session.editing=false;}
  if(body.action==='advance'&&f.session.approval&&!f.session.paused){check();const t=current();if(t){if(t.phase==='failed'){delete f.session.approval;}else if(t.terms.mode==='managed'){if(t.terms.platform==='pons'&&f.deployerBusy){t.phase='preparing';t.waitingForDeployer=true;}else{t.phase='submitted';delete t.waitingForDeployer;}f.review=null;}else if(['queued','preparing'].includes(t.phase))prepare();}}
  if(body.action==='prepare')prepare();
  if(body.action==='confirm'){current().phase='submitted';f.review=null;if(f.timeout){f.timeout=false;return Response.json({error:'Response interrupted. Check status.'},{status:503});}}
  if(body.action==='check')check();
  if(body.action==='retry'||body.action==='skip'){const t=current();t.phase=body.action==='skip'?'skipped':'queued';f.session.paused=false;if(body.action==='retry')prepare();}
  return Response.json(result());
 }
 if(route==='tokenization')return Response.json(preview(role));
 if(route==='profile'){f.agentName=body.name;return Response.json(preview(role));}
 if(route==='status')return Response.json({launch:f.pons||null});
 if(route==='managed'){
  if(['prepare','refresh'].includes(body.action)){f.pons={id:'pons-intent',mode:'managed',phase:'awaiting-signature',signer:managed,role,transactionHash:null,cancellationHash:null,token:null};return Response.json({id:'pons-intent',mode:'managed',confirmation:'a'.repeat(64),phase:'awaiting-signature',expiresAt:String(Math.floor(Date.now()/1000)+120),maximumNetworkFee:'2400000',maximumTotal:'500000002400000',launchFee:'500000000000000',purchase:'0',transaction:{chainId:'0x1237',from:managed,to:token.address,data:'0x1234',value:'0x1c6bf52634000',nonce:'0x4',gas:'0x124f80',maxFeePerGas:'0x2',maxPriorityFeePerGas:'0x1'}});}
  if(body.action==='confirm'){f.pons={...f.pons,phase:'confirmed',token:{...token,chainId:4663},transactionHash:token.transactionHash};current().phase='submitted';check();return Response.json({phase:'confirmed'});}
 }
 throw Error('Unexpected fixture route '+route);
}
function App(){const[open,setOpen]=useState(false);return <div className={foundation.surface}><button onClick={()=>{f.role='admin';setOpen(true)}}>Admin tokenize</button><button onClick={()=>{f.role='owner';setOpen(true)}}>Owner tokenize</button>{open&&<LaunchDialog agentId={id} role={f.role} request={request} close={()=>setOpen(false)}/>}</div>}
function AdminAgents(){const[page,setPage]=useState(1),[selected,setSelected]=useState(null);
 const rows=window.adminLaunchFixtures.map(details=>({id:details.preview.agentId,name:details.preview.metadata.name,isVerified:false}));
 const noop=()=>{};
 return <div className={foundation.surface}><AgentsPanel agents={rows.slice((page-1)*20,page*20)} total={rows.length} loading={false}
  search="" onSearch={noop} verified="all" onVerified={noop} page={page} onPage={setPage} sort="reputation" order="desc" onSort={noop}
  editing={null} value="" onValue={noop} onEdit={noop} onSave={noop} onToggle={noop} onDelete={noop} onLaunch={setSelected}/>
  {selected&&<LaunchDialog agentId={selected.id} role="admin" request={request} close={()=>setSelected(null)}/>}</div>;
}
createRoot(document.getElementById('root')).render(location.search==='?adminAgents'?<AdminAgents/>:<App/>);

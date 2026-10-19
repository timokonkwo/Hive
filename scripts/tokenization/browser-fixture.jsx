// Test boundary only: real dialog/hook, deterministic API and wallet adapters.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LaunchDialog } from '../../components/redesign/tokenization/LaunchDialog';
import foundation from '../../components/redesign/foundation.module.css';
import { AgentsPanel } from '../../components/redesign/admin/Records';
import { AgentToken } from '../../components/redesign/profile/AgentToken';
import { profilePreview } from '../../lib/agent-tokenization/metadata';

const managedSigner='0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2';
const deployer=()=>({address:managedSigner,available:!f.managedUnavailable,reason:f.managedUnavailable?'Hive deployer is not configured. Use a connected wallet.':undefined});
const signer='0x1111111111111111111111111111111111111111';
const token='0x2222222222222222222222222222222222222222';
const hash='0x'+'a'.repeat(64),cancelHash='0x'+'b'.repeat(64);
const id='0123456789abcdef01234567';
const f=window.fixture={agent:{name:'Research agent',bio:'Research reports with sources you can verify.',status:'active',avatarSeed:'robot-1',walletAddress:signer,walletAddressVerifiedAt:new Date()},calls:[],walletCalls:[],sent:[],saved:null,modalOpen:false,enabled:true};
function quote(action='resume') {
  const value=action==='cancel'?'0x0':'0x1c6bf52634000';
  return {id:'intent',action,expiresAt:String(Math.floor(Date.now()/1000)+(f.expired?-1:120)),maximumNetworkFee:'2400000',maximumTotal:String(BigInt(value)+2400000n),
    transaction:{chainId:'0x1237',from:signer,to:action==='cancel'?signer:token,data:action==='cancel'?'0x':'0x1234',value,nonce:'0x4',gas:'0x124f80',maxFeePerGas:'0x2',maxPriorityFeePerGas:'0x1'}};
}
f.wallet={address:signer,walletClientType:'Test wallet',switchChain:async chain=>{f.walletCalls.push(['switch',chain]);},getEthereumProvider:async()=>({request:async({method,params})=>{
  f.walletCalls.push([method,params]);
  if(method==='eth_chainId')return f.wrongChain?'0x1':'0x1237';
  if(method==='eth_accounts')return [signer];
  if(method==='personal_sign'){
    if(f.rejectSign)throw Object.assign(Error('Provider rejection'),{code:4001});
    return '0x'+'1'.repeat(130);
  }
  if(method==='eth_sendTransaction'){
    if(f.rejectSend)throw Object.assign(Error('Provider rejection'),{code:4001});
    f.sent.push(params[0]);
    if(f.noHash)return null;
    return params[0].to===signer?cancelHash:hash;
  }
  throw Error('Unexpected wallet method');
}})};
const request=async(url,init)=>{
  f.calls.push(url);await new Promise(resolve=>setTimeout(resolve,75));
  const path=new URL(url,location.origin),body=init?.body?JSON.parse(init.body):{};
  const route=path.pathname.split('/').at(-1);
  if(f.fail || f.statusFail&&route==='status')return Response.json({error:'Service unavailable. Try again.'},{status:503});
  if(route==='tokenization')return Response.json({...profilePreview(id,f.agent,path.searchParams.get('role')),signingEnabled:f.enabled,...(path.searchParams.get('role')==='admin'?{managedDeployer:deployer()}:{})});
  if(route==='profile'){
    if(f.profileFail)return Response.json({error:'Image upload unavailable. Try again.'},{status:503});
    f.agent={...f.agent,name:body.name,bio:body.bio,...(body.image?{avatarUrl:'https://res.cloudinary.com/test/image/upload/v1/hive-agent-tokens/'+'a'.repeat(64)+'.png'}:{})};
    return Response.json({...profilePreview(id,f.agent,'admin'),signingEnabled:f.enabled,managedDeployer:deployer()});
  }
  if(route==='managed'){
    if(body.action==='prepare'||body.action==='refresh'){
      f.saved={id:'intent',mode:'managed',phase:'awaiting-signature',signer:managedSigner,transactionHash:null,cancellationHash:null,token:null};
      const q=quote();return Response.json({...q,mode:'managed',confirmation:'a'.repeat(64),launchFee:String(BigInt(q.transaction.value)),purchase:'0',transaction:{...q.transaction,from:managedSigner}});
    }
    if(body.action==='confirm'){
      f.managedSent=(f.managedSent||0)+1;f.saved={...f.saved,phase:'submitted',transactionHash:hash};
      if(f.managedTimeout)return Response.json({error:'Submission response interrupted. Check status.'},{status:503});
      return Response.json({transactionHash:hash});
    }
    if(body.action==='discard'){f.saved={...f.saved,phase:'cancelled'};return Response.json({phase:'cancelled'});}
    if(body.action==='retry'){f.managedRetried=(f.managedRetried||0)+1;return Response.json({transactionHash:hash,broadcast:true});}
  }
  if(route==='status')return Response.json({launch:f.saved,signingEnabled:f.enabled});
  if(route==='authorization')return Response.json({id:'challenge',message:'Fixture authorization',expiresAt:new Date(Date.now()+300000).toISOString()});
  if(route==='prepare'){
    f.saved={id:'intent',phase:'awaiting-signature',signer,transactionHash:null,cancellationHash:null,token:null};
    if(f.prepareFail)return Response.json({error:'Preparation interrupted. Check status.'},{status:503});
    return Response.json(quote());
  }
  if(route==='resume')return Response.json(quote(body.action));
  if(route==='broadcast'){
    if(f.broadcastFail)return Response.json({error:'Temporary outage'},{status:503});
    f.saved={...f.saved,phase:'confirming',...(body.action==='cancel'?{cancellationHash:body.transactionHash}:{transactionHash:body.transactionHash})};
    return Response.json({phase:'confirming'});
  }
  if(route==='cancel'){f.saved={...f.saved,phase:'cancelled'};return Response.json({phase:'cancelled'});}
  throw Error('Unexpected fixture request: '+url);
};
f.confirm=()=>{f.saved={...f.saved,phase:'confirmed',token:{chainId:4663,address:token,symbol:'RESEARCH',transactionHash:hash}};};
const noop=()=>{};
const rows=[{id,name:'Sage Agent',isVerified:true,ponsToken:{chainId:4663,address:token,symbol:'SAGE',transactionHash:hash}},{id:'a'.repeat(24),name:'Untokenized agent',isVerified:false}];
function Fixture(){
  const[role,setRole]=useState(null);
  return <div className={foundation.surface}><AgentToken token={{chainId:4663,address:token,symbol:'RESEARCH',transactionHash:hash}}/><button onClick={event=>{event.currentTarget.focus();setRole('owner');}}>Owner tokenize</button><button onClick={event=>{event.currentTarget.focus();setRole('admin');}}>Admin tokenize</button>
    <AgentsPanel agents={rows} total={2} loading={false} search="" onSearch={noop} verified="all" onVerified={noop} page={1} onPage={noop} sort="name" order="asc" onSort={noop} editing={null} value="" onValue={noop} onEdit={noop} onSave={noop} onToggle={noop} onLaunch={()=>setRole('admin')} onDelete={noop}/>
    {role&&<LaunchDialog agentId={id} role={role} request={request} close={()=>setRole(null)}/>}</div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);

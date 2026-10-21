"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { stringToHex } from 'viem';
import type { LaunchPreview, LaunchProgress, LaunchRole, LaunchMode } from '@/lib/agent-tokenization/types';
import { validHash, sameAddress, HIVE_LAUNCH_WALLET } from '@/lib/agent-tokenization/policy';
import type { Request } from '../task/useResource';
import type { AgentProfileEdit } from './AgentDetailsEditor';
import { readPreview, readStatus, readQuote, type SavedLaunch, type LaunchQuote } from './model';

export interface SigningWallet {
  address:string;
  switchChain:(chain:number)=>Promise<void>;
  getEthereumProvider:()=>Promise<{request:(args:{method:string;params?:unknown[]})=>Promise<unknown>}>;
}
export function useLaunchFlow(agentId:string,role:LaunchRole,request:Request,wallets:SigningWallet[],session?:{id:string;mode:LaunchMode;signer:string;symbol:string;purchase:string}) {
  const [preview,setPreview]=useState<LaunchPreview|null>(null),[saved,setSaved]=useState<SavedLaunch|null>(null);
  const [quote,setQuote]=useState<LaunchQuote|null>(null),[error,setError]=useState('');
  const [mode,setMode]=useState<LaunchMode>(role==='admin'?'managed':'connected');
  const [blocked,setBlocked]=useState(false);
  const [loading,setLoading]=useState(true),[progress,setProgress]=useState<LaunchProgress>({stage:'review'});
  const [symbol,setSymbol]=useState(''),[purchase,setPurchase]=useState(''),[wallet,setWallet]=useState('');
  const alive=useRef(true),busy=useRef(false),walletsRef=useRef(wallets);
  walletsRef.current=wallets;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const base=`/api/agents/${agentId}/tokenization`;
  const api=useCallback(async (path:string,body?:unknown) => {
    const response=await request(`${base}${path}?role=${role}${session ? `&session=${session.id}` : ''}`,{cache:'no-store',signal:AbortSignal.timeout(body?55000:20000),
      ...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
    const data=await response.json();
    if(!response.ok) throw Error(typeof data.error==='string'?data.error:'The request failed. Check the launch status.');
    return data;
  },[base,role,request,session?.id]);
  const saveProfile=async(input:AgentProfileEdit)=>{
    if(busy.current)throw Error('Wait for the current operation to finish.');
    const response=await request(`${base}/profile?role=${role}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(35000)});
    const data=await response.json();
    if(!response.ok)throw Error(typeof data.error==='string'?data.error:'Changes could not be saved. Try again.');
    const next=readPreview(data,agentId,role);
    if(alive.current){setPreview(next);setQuote(null);setError('');}
  };
  const refresh=useCallback(async()=>{
    const next=readStatus(await api('/status'));
    if(alive.current) {setSaved(next); if(next?.token)setProgress({stage:'success',token:next.token,transactionHash:next.token.transactionHash});}
    return next;
  },[api]);
  const load=useCallback(async()=>{
    setLoading(true);setBlocked(false);setError('');
    try {
      const [details,status]=await Promise.all([api(''),api('/status')]);
      const next=readPreview(details,agentId,role),launch=readStatus(status);
      if(!alive.current)return;
      setPreview(next);setSymbol(session?.symbol || next.metadata.symbol);setSaved(launch);
      if(session){setWallet(session.signer);setMode(session.mode);setPurchase(session.purchase);}
      if(launch){setWallet(launch.signer);setMode(launch.mode || 'connected');}
      if(launch?.token)setProgress({stage:'success',token:launch.token,transactionHash:launch.token.transactionHash});
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Token details are unavailable.');}
    finally{if(alive.current)setLoading(false);}
  },[api,agentId,role,session?.id,session?.mode,session?.signer,session?.symbol,session?.purchase]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    if(!saved || !['awaiting-signature','submitted','confirming'].includes(saved.phase))return;
    let stopped=false,timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{try {if(!busy.current&&!document.hidden)await refresh();}catch{/* Preserve known state during an outage. */}finally{if(!stopped)timer=setTimeout(poll,6000);}};
    timer=setTimeout(poll,6000);return()=>{stopped=true;clearTimeout(timer);};
  },[saved,refresh]);
  const provider=async(address:string)=>{
    const choice=walletsRef.current.find(w=>sameAddress(w.address,address));
    if(!choice)throw Error('Connect the launch wallet to continue.');
    await choice.switchChain(4663);
    const rpc=await choice.getEthereumProvider();
    const [chain,accounts]=await Promise.all([rpc.request({method:'eth_chainId'}),rpc.request({method:'eth_accounts'})]);
    if(Number(chain)!==4663 || !Array.isArray(accounts) || !accounts.some(a=>typeof a==='string'&&sameAddress(a,address)))throw Error('The wallet or network changed. Select the launch wallet on Robinhood Chain.');
    if(!alive.current)throw Error('The launch window was closed.');
    return rpc;
  };
  const run=async(task:()=>Promise<void>)=>{
    if(busy.current)return;busy.current=true;setError('');
    try{await task();}catch(e){
      if(alive.current){setQuote(null);setError(e && typeof e==='object' && 'code' in e && e.code===4001 ? 'Wallet request declined. You can continue when ready.' : e instanceof Error?e.message:'The wallet request was not completed.');
        try{await refresh();}catch{setError('Launch status is unavailable. Check again before continuing.');setBlocked(true);}}
    }finally{busy.current=false;if(alive.current)setProgress(p=>p.stage==='success'?p:{stage:'review'});}
  };
  const prepare=()=>run(async()=>{
    if(!preview?.signingEnabled)throw Error('Token launches are not enabled yet.');
    if(mode==='managed'){
      setProgress({stage:'preparing'});
      const data=await api('/managed',{action:'prepare',symbol,purchase});
      if(alive.current){setQuote(readQuote(data,HIVE_LAUNCH_WALLET));await refresh();}
      return;
    }
    setProgress({stage:'authorizing'});
    const challenge=await api('/authorization',{signer:wallet,symbol,purchase});
    if(!alive.current)return;
    if(typeof challenge.id!=='string'||typeof challenge.message!=='string'||!Number.isFinite(Date.parse(challenge.expiresAt))||Date.parse(challenge.expiresAt)<=Date.now())throw Error('Refresh the wallet authorization.');
    const rpc=await provider(wallet);
    const signature=await rpc.request({method:'personal_sign',params:[stringToHex(challenge.message),wallet]});
    if(!alive.current)return;
    if(typeof signature!=='string'||!/^0x[a-f0-9]{130}$/i.test(signature))throw Error('Wallet verification was not completed.');
    setProgress({stage:'preparing'});
    const data=await api('/prepare',{challengeId:challenge.id,signature});
    const next=readQuote(data,wallet);
    if(alive.current){setQuote(next);await refresh();}
  });
  const review=(action:'resume'|'cancel')=>run(async()=>{
    if(!saved)return;setProgress({stage:'preparing'});
    const data=saved.mode==='managed' ? await api('/managed',{id:saved.id,action:'refresh'}) : await api('/resume',{id:saved.id,action});
    if(alive.current)setQuote(readQuote(data,saved.signer,action));
  });
  const send=()=>run(async()=>{
    if(!quote||quote.expiresAt<=Date.now())throw Error('This fee estimate expired. Review the launch again.');
    if(quote.mode==='managed'){
      setProgress({stage:'submitting'});
      await api('/managed',{action:'confirm',id:quote.id,confirmation:quote.confirmation});
      if(alive.current){setQuote(null);await refresh();}
      return;
    }
    setProgress({stage:'awaiting-signature'});
    const rpc=await provider(quote.transaction.from);
    if(quote.expiresAt<=Date.now())throw Error('This fee estimate expired. Review it again.');
    const hash=await rpc.request({method:'eth_sendTransaction',params:[quote.transaction]});
    if(!validHash(hash))throw Error('The wallet did not return a transaction hash. Check status before retrying.');
    // Finish recording an already-authorized broadcast even if the dialog was closed.
    if(alive.current){setQuote(null);setProgress({stage:'confirming',transactionHash:hash});}
    try{await api('/broadcast',{id:quote.id,transactionHash:hash,action:quote.action});}
    catch{if(alive.current)setError('Transaction sent. Confirmation is being recovered.');}
    if(alive.current)await refresh();
  });
  const cancelDraft=()=>run(async()=>{
    if(!saved)return;setProgress({stage:'checking'});await api(saved.mode==='managed'?'/managed':'/cancel',{id:saved.id,...(saved.mode==='managed'?{action:'discard'}:{})});if(alive.current){setQuote(null);setSaved(null);await load();}
  });
  const retrySubmission=()=>run(async()=>{if(!saved)return;setProgress({stage:'submitting'});await api('/managed',{id:saved.id,action:'retry'});if(alive.current)await refresh();});
  const check=()=>run(async()=>{setProgress({stage:'checking'});setLoading(false);await refresh();});
  return {preview,saved,quote,mode,setMode,retrySubmission,saveProfile,error,loading,blocked,progress,symbol,purchase,wallet,setSymbol,setPurchase,setWallet,prepare,review,send,cancelDraft,check,load,
    dismissQuote:()=>setQuote(null),restart:()=>{setMode(role==='admin'?'managed':'connected');setSaved(null);setQuote(null);setError('');setProgress({stage:'review'});},busy:progress.stage!=='review'&&progress.stage!=='success'};
}

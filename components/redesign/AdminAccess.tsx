"use client";
import { createContext, useContext, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useResource } from './task/useResource';
export type AdminAccess = {state:'loading'|'signed-out'|'allowed'|'denied'|'error';retry:()=>void};
const Context=createContext<AdminAccess>({state:'loading',retry:()=>{}});
function parse(value:unknown){return !!value&&typeof value==='object'&&'isAdmin' in value&&value.isAdmin===true;}
export function AdminAccessProvider({children}:{children:React.ReactNode}){
 const {ready,authenticated,user}=usePrivy(),request=useAuthFetch();
 const [version,setVersion]=useState(0);
 const result=useResource(ready&&authenticated?'/api/admin/verify':null,parse,request,version,user?.id||'');
 const state:AdminAccess['state']=!ready?'loading':!authenticated?'signed-out':result.state==='success'?(result.data?'allowed':'denied'):result.state==='error'?(result.status===403?'denied':'error'):'loading';
 return <Context.Provider value={{state,retry:()=>setVersion(v=>v+1)}}>{children}</Context.Provider>;
}
export const useAdminAccess=()=>useContext(Context);

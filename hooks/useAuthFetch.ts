import { usePrivy, getIdentityToken, useIdentityToken } from '@privy-io/react-auth';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { fetchWithAccessToken, sharedAccessToken } from '@/lib/auth-fetch';
/** Ask Privy for the current token; retry a rejected read once without changing sign-in. */
export function useAuthFetch() {
 const {getAccessToken,authenticated,user}=usePrivy();
 const identity=user?.id||'';
 const current=useRef({identity,authenticated});
 useLayoutEffect(()=>{current.current={identity,authenticated};return()=>{current.current={identity:'',authenticated:false};};},[identity,authenticated]);
 const {identityToken}=useIdentityToken();

 return useCallback(async (url:string,options:RequestInit={})=>{
  const assertCurrent=()=>{if(current.current.identity!==identity||current.current.authenticated!==authenticated)throw new DOMException('Session changed','AbortError');};
  const token=async()=>{assertCurrent();const value=await sharedAccessToken(getAccessToken,identity);assertCurrent();return value;};
  if(authenticated&&(url.startsWith('/api/admin/')||url.startsWith('/api/roadmap')||(/^\/api\/agents\/[a-f0-9]{24}\/tokenization(?:[/?]|$)/i.test(url)&&new URL(url,'https://uphive.xyz').searchParams.get('role')==='admin'))){
   try{const identity=identityToken||await getIdentityToken();if(identity){const headers=new Headers(options.headers);headers.set('privy-id-token',identity);options={...options,headers};}}catch{/* Access-token and DID authorization remain available. */}
  }
  return fetchWithAccessToken(url,options,authenticated,token);
 },[getAccessToken,authenticated,identity,identityToken]);
}

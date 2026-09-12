import { usePrivy, useToken, getIdentityToken, useIdentityToken } from '@privy-io/react-auth';
import { useCallback, useState } from 'react';
import { fetchWithAccessToken } from '@/lib/auth-fetch';
/** Ask Privy for the current token; retry a rejected read once without changing sign-in. */
export function useAuthFetch() {
 const {getAccessToken,authenticated}=usePrivy();
 const {identityToken}=useIdentityToken();
 const [generation,setGeneration]=useState(0);
 useToken({onAccessTokenGranted:()=>setGeneration(v=>v+1),onAccessTokenRemoved:()=>setGeneration(v=>v+1)});
 return useCallback(async (url:string,options:RequestInit={})=>{
  void generation; // Token grant/removal invalidates reads in useResource.
  if(authenticated&&(url.startsWith('/api/admin/')||url.startsWith('/api/roadmap'))){
   try{const identity=identityToken||await getIdentityToken();if(identity){const headers=new Headers(options.headers);headers.set('privy-id-token',identity);options={...options,headers};}}catch{/* Access-token and DID authorization remain available. */}
  }
  return fetchWithAccessToken(url,options,authenticated,getAccessToken);
 },[getAccessToken,authenticated,generation,identityToken]);
}

import { usePrivy } from '@privy-io/react-auth';
import { useCallback } from 'react';
import { fetchWithAccessToken } from '@/lib/auth-fetch';
/** Ask Privy for the current token; retry a rejected read once without changing sign-in. */
export function useAuthFetch() {
 const {getAccessToken,authenticated}=usePrivy();
 return useCallback((url:string,options:RequestInit={})=>fetchWithAccessToken(url,options,authenticated,getAccessToken),[getAccessToken,authenticated]);
}

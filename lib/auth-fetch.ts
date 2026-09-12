/** Only authenticated reads may be retried. Writes retain their explicit review/recovery flow. */
export async function fetchWithAccessToken(url:string, options:RequestInit, authenticated:boolean, getAccessToken:()=>Promise<string|null>, transport:typeof fetch=fetch) {
 const readToken=async()=>{options.signal?.throwIfAborted();try{return await getAccessToken();}catch{options.signal?.throwIfAborted();return null;}};
 const refreshToken=async()=>{options.signal?.throwIfAborted();await new Promise(resolve=>setTimeout(resolve,250));return readToken();};
 let token=await readToken();
 if(!token&&authenticated)token=await refreshToken();
 const send=(value:string|null)=>{options.signal?.throwIfAborted();const headers=new Headers(options.headers);if(value)headers.set('Authorization',`Bearer ${value}`);return transport(url,{...options,headers,credentials:'include'});};
 const response=await send(token);
 if(response.status!==401||!authenticated||!['GET','HEAD'].includes((options.method||'GET').toUpperCase()))return response;
 const refreshed=await refreshToken();
 // Cookie-based sessions can refresh without exposing an access token to JS.
 return send(refreshed);
}

export class AuthRequestError extends Error {
  constructor(readonly status: 401 | 503, message: string) { super(message); }
}

/** Abort one waiter without cancelling another request's shared refresh. */
export function waitForToken<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve,reject) => {
    const abort = () => {signal.removeEventListener('abort',abort);reject(signal.reason);};
    signal.addEventListener('abort',abort,{once:true});
    promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}

// Share in-flight retrieval only. Privy owns credential caching and refresh.
const pending = new WeakMap<()=>Promise<string|null>,Map<string,Promise<string|null>>>();
export function sharedAccessToken(get:()=>Promise<string|null>, identity:string) {
  let sessions=pending.get(get);
  if (!sessions) { sessions=new Map();pending.set(get,sessions); }
  const existing=sessions.get(identity);
  if (existing) return existing;
  const result=waitForToken(Promise.resolve().then(get),AbortSignal.timeout(8000));
  sessions.set(identity,result);
  void result.finally(()=>{if(sessions.get(identity)===result)sessions.delete(identity);}).catch(()=>{});
  return result;
}

/** Only reads may be retried; writes retain their explicit review flow. */
export async function fetchWithAccessToken(url:string, options:RequestInit, authenticated:boolean,
  getAccessToken:()=>Promise<string|null>, transport:typeof fetch=fetch) {
  const signal=options.signal ?? AbortSignal.timeout(12000);
  const acquire=async(previous?:string|null):Promise<string|null>=>{
    let failed=false;
    for(const delay of [0,250,750]) {
      signal.throwIfAborted();
      if(delay) await waitForToken(new Promise(resolve=>setTimeout(resolve,delay)),signal);
      try {
        const value=await waitForToken(Promise.resolve().then(getAccessToken),signal);
        if(value && value!==previous)return value;
      } catch (error) {
        signal.throwIfAborted();
        if(error instanceof Error && error.name==='AbortError')throw error;
        failed=true;
      }
    }
    if(previous)return previous;
    if(failed)throw new AuthRequestError(503,'Session verification is temporarily unavailable.');
    // HttpOnly sessions intentionally have no JavaScript-readable token.
    // Only our own server may validate the accompanying session cookie.
    const sameOrigin=/^\/(?![\/\\])/.test(url) ||
      (typeof window!=='undefined' && new URL(url,window.location.origin).origin===window.location.origin);
    if(sameOrigin)return null;
    throw new AuthRequestError(401,'Sign in again to continue.');
  };
  const send=(token:string|null)=>{
    signal.throwIfAborted();const headers=new Headers(options.headers);
    if(token)headers.set('Authorization',`Bearer ${token}`);
    return transport(url,{...options,signal,headers,credentials:'include'});
  };
  const token=authenticated?await acquire():null;
  const response=await send(token);
  if(response.status!==401||!authenticated||!['GET','HEAD'].includes((options.method||'GET').toUpperCase()))return response;
  const refreshed=await acquire(token);
  // Cookie refresh can change the credential without exposing a token to JavaScript.
  return refreshed===token && token!==null?response:send(refreshed);
}

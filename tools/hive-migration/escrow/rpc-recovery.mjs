// Retry transport reads, never transaction submission or integrity failures.
export function transientRpc(error) {
  for(let e=error,i=0;e&&i<8;e=e.cause,i++) {
    const status=Number(e.status??e.statusCode);
    if([408,429,500,502,503,504].includes(status))return true;
    // Providers also return transient failures inside successful HTTP responses.
    // -32005 is EVM rate limiting / Solana node unhealthy; -32016 is Solana
    // minimum-context-slot lag. Keep the requested finality and retry later.
    if([-32005,-32016].includes(e.code))return true;
    if(['TimeoutError','HttpRequestError','SocketClosedError'].includes(e.name)&&!Number.isFinite(status))return true;
    if(['ECONNRESET','ECONNREFUSED','ETIMEDOUT','EAI_AGAIN','ENOTFOUND','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET'].includes(e.code))return true;
    if(e.name==='TypeError'&&e.message==='fetch failed')return true;
  }
  return false;
}
export function rpcDiagnostic(error,operation,attempt) {
  let status=null,chain='unknown',method='unknown';
  for(let e=error,i=0;e&&i<8;e=e.cause,i++) {
    if(Number.isInteger(e.status))status=e.status;
    if(['solana','evm'].includes(e.rpcChain))chain=e.rpcChain;
    if(typeof e.rpcMethod==='string'&&/^[a-zA-Z0-9_]+$/.test(e.rpcMethod))method=e.rpcMethod;
  }
  return {event:'rpc_retry',operation,chain,method,status,attempt};
}
export function rpcClient(client,chain) {
  return new Proxy(client,{get(target,key){const value=Reflect.get(target,key);if(typeof value!=='function')return value;return async(...args)=>{try{return await value.apply(target,args);}catch(e){e.rpcChain=chain;e.rpcMethod=String(key);throw e;}};}});
}
export async function recoverableCycle(work,{unready,wait,log,attempt=0,operation='cycle'}) {
  try {await work();return 0;}catch(error){
    unready();
    if(!transientRpc(error))throw error;
    const next=attempt+1,delay=Math.min(60000,5000*2**Math.min(next-1,4));
    log({...rpcDiagnostic(error,operation,next),retryMilliseconds:delay});
    await wait(delay);return next;
  }
}

// Coalesce read-only RPC calls for a brief window; never cache signing or sends.
export function cachedReads(client,ttl=10000,now=Date.now) {
 const reads=new Set(['getChainId','getGenesisHash','getBytecode','readContract']);
 const cache=new Map();
 return new Proxy(client,{get(target,key){const fn=Reflect.get(target,key);if(typeof fn!=='function')return fn;if(!reads.has(key))return fn.bind(target);return (...args)=>{
  const id=String(key)+JSON.stringify(args,(_,v)=>typeof v==='bigint'?String(v):v);const saved=cache.get(id);if(saved&&now()-saved.at<ttl)return saved.promise;
  for(const [k,v]of cache)if(now()-v.at>=ttl)cache.delete(k);
  const entry={at:now()};entry.promise=Promise.resolve().then(()=>fn.apply(target,args)).catch(e=>{if(cache.get(id)===entry)cache.delete(id);throw e;});cache.set(id,entry);return entry.promise;
 };}});
}

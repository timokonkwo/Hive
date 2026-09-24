const $=id=>document.getElementById(id);let running=false,localSigner=null,lastState=null,operatorState=null;const directLocal=['localhost','127.0.0.1'].includes(location.hostname);$('operator-optin').hidden=!directLocal;
if(location.hash.startsWith('#access='))history.replaceState(null,'',location.pathname);
async function api(path,body){let r;try{r=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});}catch{throw Error('The signing service disconnected. Reopen this page after the service restarts. Submitted transactions are saved and will be checked before continuing.');}const v=await r.json();if(!r.ok)throw Error(/session required/i.test(v.error??'')?'The signing service restarted. Reload this page and load your keys again; confirmed progress is saved.':v.error||'Request failed');return v;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function controls(){$('enable-local-test').disabled=running;$('operator-panel').hidden=!directLocal;$('operator-start').disabled=running||lastState?.stage!=='complete'||!operatorState?.keysLoaded||operatorState?.running===true;$('keep-open').hidden=!running;$('start').textContent=running?'Deploying… keep this tab open':lastState?.stage==='complete'?'Deployment complete':'Sign & deploy';const useKeys=$('method').value==='keys';$('key-panel').hidden=!useKeys;$('method').disabled=running;$('load-keys').disabled=running||!lastState;$('forget-keys').disabled=running||!localSigner;$('start').disabled=running||!lastState||!$('terms').checked||lastState.stage==='complete'||(useKeys&&!localSigner);$('terms').disabled=running;}
function forget(){localSigner?.forget();localSigner=null;$('solana-key').value='';$('evm-key').value='';$('key-status').textContent=operatorState?.keysLoaded?'Browser keys cleared. Local operator keys remain in memory.':'No keys loaded.';controls();}
$('forget-keys').onclick=forget;$('method').onchange=()=>{forget();controls();};$('terms').onchange=controls;
$('key-form').onsubmit=async e=>{e.preventDefault();$('error').textContent='';try{if(!lastState||running)throw Error('Wait for the deployment review.');localSigner?.forget();localSigner=null;localSigner=HiveLocalSigner.localKeySigner($('solana-key').value,$('evm-key').value,lastState.review);if(directLocal&&$('enable-local-test').checked){operatorState=await api('/local-test/load',{consent:'local-memory-only',solanaPrivateKey:$('solana-key').value,evmPrivateKey:$('evm-key').value});await refreshOperator();}$('key-status').textContent='Both admin wallets verified. Ready to sign.';}catch(error){localSigner?.forget();localSigner=null;$('key-status').textContent='No browser keys loaded.';$('error').textContent=error.message;}finally{$('solana-key').value='';$('evm-key').value='';controls();}};
async function refreshOperator(){if(!directLocal)return;operatorState=await api('/local-test/status');$('operator-status').textContent=operatorState.error||operatorState.phase;$('claim-link').hidden=!operatorState.enabled;controls();}
async function startOperator(){if(!directLocal||!$('enable-local-test').checked)throw Error('Select the local test option and load the keys first.');operatorState=await api('/local-test/start',{consent:'activate-local-exception-only'});await refreshOperator();}
$('operator-start').onclick=()=>startOperator().catch(e=>$('error').textContent=e.message);
window.addEventListener('pagehide',forget);
async function recovery(){const {unresolved}=await api('/recovery');$('recovery').hidden=!unresolved.length;if(unresolved.length){$('recovery').dataset.id=unresolved[0].id;$('recovery-info').textContent=`Check the ${unresolved[0].action} transaction in MetaMask (nonce ${Number(BigInt(unresolved[0].nonce))}). Paste its transaction hash to reconcile it. This does not resend it.`;}}
$('recover').onclick=async()=>{try{await api('/evm-hash',{id:$('recovery').dataset.id,hash:$('hash').value.trim()});await recovery();await status();$('error').textContent='';}catch(e){$('error').textContent=e.message;}};
async function status(){const s=await api('/status');lastState=s;$('review').textContent=JSON.stringify(s.review,null,2);$('progress').textContent=s.description;controls();return s;}
$('start').onclick=async()=>{running=true;controls();$('error').textContent='';try{
 let s=await status(),sol,evm;const keys=$('method').value==='keys';
 if(keys){if(!localSigner)throw Error('Load the admin keys first.');}else{
  sol=window.phantom?.solana??window.solana;evm=window.ethereum?.providers?.find(p=>p.isMetaMask)??window.ethereum;
  if(!sol?.signAllTransactions||!evm?.request)throw Error('Open this page in a browser with Phantom and MetaMask installed.');
  await sol.connect();const accounts=await evm.request({method:'eth_requestAccounts'});
  if(sol.publicKey.toBase58()!==s.review.solanaAdmin||accounts[0].toLowerCase()!==s.review.robinhoodAdmin.toLowerCase())throw Error('Select the reviewed admin addresses in both wallets.');
  if(await evm.request({method:'eth_chainId'})!=='0x1237')await evm.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x1237'}]});
 }
 await api('/approve',{terminalPolicy:true,graceSeconds:'86400',upgradeAuthority:s.review.solanaAdmin});
 for(;;){s=await status();if(s.stage==='complete')break;if(s.pending){await sleep(2000);continue;}
  const plan=await api('/prepare',{});
  if(plan.chain==='solana'){
   let signed;
   if(keys)signed=plan.transactions.map(t=>localSigner.signSolana(t.base64));
   else{const txs=plan.transactions.map(t=>solanaWeb3.VersionedTransaction.deserialize(Uint8Array.from(atob(t.base64),c=>c.charCodeAt(0))));signed=(await sol.signAllTransactions(txs)).map(t=>btoa(String.fromCharCode(...t.serialize())));}
   if(signed.length!==plan.transactions.length)throw Error('Wallet returned an incomplete batch.');
   for(let i=0;i<signed.length;i++){const sent=await api('/solana-submit',{id:plan.transactions[i].id,base64:signed[i]});if(sent.status==='unknown')throw Error('Solana submission outcome is unknown. Its signature is saved; resume only after reconciliation.');}
  }else if(keys){
   const raw=await localSigner.signEvm(plan.transaction);const sent=await api('/evm-signed',{id:plan.id,raw});if(sent.status==='unknown')throw Error('Robinhood submission outcome is unknown. Its hash is saved; resume only after reconciliation.');
  }else{
   await api('/evm-intent',{id:plan.id});let hash;
   try{hash=await evm.request({method:'eth_sendTransaction',params:[plan.transaction]});}catch(e){await api('/evm-wallet-error',{id:plan.id,rejected:e.code===4001});throw Error(e.code===4001?'Wallet approval was rejected.':'Wallet outcome is unknown. Check MetaMask before any retry.');}
   await api('/evm-hash',{id:plan.id,hash});
  }
  await sleep(1000);
 }
 if(directLocal&&$('enable-local-test').checked){await startOperator();$('progress').textContent='Deployment complete. The local operator is verifying activation; use the local claim link when it is ready.';}else $('progress').textContent='Deployment complete. Contracts are paused. Select the local test option and load keys to enable your test.';forget();
}catch(e){$('error').textContent=e.message;}finally{running=false;controls();await recovery().catch(()=>{});}};
status().catch(e=>$('error').textContent=e.message);recovery().catch(e=>$('error').textContent=e.message);

if(directLocal){refreshOperator().catch(()=>{});setInterval(()=>refreshOperator().catch(()=>{}),5000);}

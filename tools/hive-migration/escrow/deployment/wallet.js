const $=id=>document.getElementById(id);let running=false;
async function api(path,body){const r=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function recovery(){const {unresolved}=await api('/recovery');$('recovery').hidden=!unresolved.length;if(unresolved.length){$('recovery').dataset.id=unresolved[0].id;$('recovery-info').textContent=`Check the ${unresolved[0].action} transaction in MetaMask (nonce ${Number(BigInt(unresolved[0].nonce))}). Paste its transaction hash to reconcile it. This does not resend it.`;}}
$('recover').onclick=async()=>{try{await api('/evm-hash',{id:$('recovery').dataset.id,hash:$('hash').value.trim()});await recovery();await status();$('error').textContent='';}catch(e){$('error').textContent=e.message;}};
async function status(){const s=await api('/status');$('review').textContent=JSON.stringify(s.review,null,2);$('progress').textContent=s.description;$('start').disabled=running||!$('terms').checked||s.stage==='complete';return s;}
$('terms').onchange=()=>status().catch(e=>$('error').textContent=e.message);
$('start').onclick=async()=>{running=true;$('start').disabled=true;$('error').textContent='';try{
 const sol=window.phantom?.solana??window.solana;const evm=window.ethereum?.providers?.find(p=>p.isMetaMask)??window.ethereum;
 if(!sol?.signAllTransactions||!evm?.request)throw Error('Open this page in a browser with Phantom and MetaMask installed.');
 await sol.connect();const accounts=await evm.request({method:'eth_requestAccounts'});let s=await status();
 if(sol.publicKey.toBase58()!==s.review.solanaAdmin||accounts[0].toLowerCase()!==s.review.robinhoodAdmin.toLowerCase())throw Error('Select the reviewed admin addresses in both wallets.');
 if(await evm.request({method:'eth_chainId'})!=='0x1237')await evm.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x1237'}]});
 await api('/approve',{terminalPolicy:true,graceSeconds:'86400',upgradeAuthority:s.review.solanaAdmin});
 for(;;){s=await status();if(s.stage==='complete')break;if(s.pending){await sleep(2000);continue;}
  const plan=await api('/prepare',{});
  if(plan.chain==='solana'){
   const txs=plan.transactions.map(t=>solanaWeb3.VersionedTransaction.deserialize(Uint8Array.from(atob(t.base64),c=>c.charCodeAt(0))));
   const signed=await sol.signAllTransactions(txs);
   if(signed.length!==plan.transactions.length)throw Error('Wallet returned an incomplete batch.');
   for(let i=0;i<signed.length;i++){const base64=btoa(String.fromCharCode(...signed[i].serialize()));const sent=await api('/solana-submit',{id:plan.transactions[i].id,base64});if(sent.status==='unknown')throw Error('Solana submission outcome is unknown. Its signature is saved; resume only after reconciliation.');}
  }else{
   await api('/evm-intent',{id:plan.id});
   let hash;try{hash=await evm.request({method:'eth_sendTransaction',params:[plan.transaction]});}catch(e){await api('/evm-wallet-error',{id:plan.id,rejected:e.code===4001});throw Error(e.code===4001?'Wallet approval was rejected.':'Wallet outcome is unknown. Check MetaMask before any retry.');}
   await api('/evm-hash',{id:plan.id,hash});
  }
  await sleep(1000);
 }
 $('progress').textContent='Contracts deployed and funded, both paused. Deployment fingerprints saved. Return to the conversation to finish the local operator setup.';
}catch(e){$('error').textContent=e.message;}finally{running=false;await status().catch(()=>{});await recovery();}};
status().catch(e=>$('error').textContent=e.message);recovery().catch(e=>$('error').textContent=e.message);

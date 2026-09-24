// Loopback-only deployment. Keys stay in the browser; this server accepts signed transactions only.
import {createServer} from 'node:http';import {readFileSync,writeFileSync,existsSync,openSync,fsyncSync,closeSync} from 'node:fs';import {dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {randomBytes,createHash,createPublicKey,verify} from 'node:crypto';
import {Connection,Keypair,PublicKey,VersionedTransaction,ComputeBudgetProgram} from '@solana/web3.js';import {getBase58Decoder} from '@solana/kit';import {createPublicClient,http,encodeFunctionData,parseAbi,keccak256,toHex,formatUnits} from 'viem';
import {Journal,acquireServiceLock} from '../journal.mjs';import {initializeInstruction,unsignedTransaction,decodeCampaign} from '../client.mjs';import {createObserver} from '../observer.mjs';import {LOADER,programDataAddress,createBuffer,writeBuffer,deployProgram} from './loader.mjs';
import {saveJson,verifyEvmTransaction,verifySignedEvm} from './safety.mjs';
const here=dirname(fileURLToPath(import.meta.url)),escrow=resolve(here,'..'),root=resolve(escrow,'../../..'),dir=resolve(escrow,'local/deployment-100k');
const reviewPath=resolve(dir,'review.json');const review=JSON.parse(readFileSync(reviewPath));const c=review.config;
const programBytes=readFileSync(resolve(escrow,'solana/target/deploy/hive_redemption_escrow.so'));
const hash=b=>createHash('sha256').update(b).digest('hex');const check=(v,m)=>{if(!v)throw Error(m);};
check(hash(programBytes)===review.programSha256,'Program binary differs from review');
const program=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(resolve(escrow,'solana/target/deploy/hive_redemption_escrow-keypair.json')))));
check(program.publicKey.toBase58()===c.program,'Program identity differs from review');
const bufferPath=resolve(dir,'buffer-keypair.json');if(!existsSync(bufferPath)){const k=Keypair.generate();writeFileSync(bufferPath,JSON.stringify([...k.secretKey]),{flag:'wx',mode:0o600});}
const buffer=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(bufferPath))));
const admin=new PublicKey(c.admin);const sol=new Connection(process.env.SOLANA_RPC_URL,'finalized');const evm=createPublicClient({transport:http('https://rpc.mainnet.chain.robinhood.com',{retryCount:0,timeout:20000})});
check(await sol.getGenesisHash()==='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'&&await evm.getChainId()===4663,'Wrong networks');
const tokenAbi=parseAbi(['function balanceOf(address) view returns(uint256)','function transfer(address,uint256) returns(bool)']);const journal=new Journal(dir);const unlock=acquireServiceLock(dir);const plans=new Map();const cookie=randomBytes(32).toString('hex');const port=8789;const allowedHosts=new Set(['localhost:'+port,'127.0.0.1:'+port]);let busy=false;
function saveReview(){saveJson(reviewPath,review);}
async function reconcile(){
 for(const entry of journal.latest().values()){
  if(!['submitted','awaiting_wallet','unknown'].includes(entry.status))continue;
  if(!entry.hash)throw Error('A wallet submission has no recorded hash. Reconcile it in MetaMask before continuing.');
  if(entry.chain==='solana'){
   const s=(await sol.getSignatureStatuses([entry.hash],{searchTransactionHistory:true})).value[0];
   if(s?.confirmationStatus==='finalized')journal.append({...entry,status:s.err?'failed':'confirmed'});
  }else{
   let r;try{r=await evm.getTransactionReceipt({hash:entry.hash});}catch(e){if(e.name==='TransactionReceiptNotFoundError')continue;throw e;}
   const t=await evm.getTransaction({hash:entry.hash});const expected=entry.transaction;
   verifyEvmTransaction(t,expected);
   const block=await evm.getBlock({blockTag:'finalized'});if(r.blockNumber>block.number)continue;
   check((await evm.getBlock({blockNumber:r.blockNumber})).hash===r.blockHash,'Noncanonical receipt');
   journal.append({...entry,status:r.status==='success'?'confirmed':'failed',block:r.blockNumber.toString()});
  }
 }
 const entries=[...journal.latest().values()];check(!entries.some(e=>e.status==='failed'),'A deployment transaction failed. Reconcile it before proceeding.');return entries.some(e=>['submitted','awaiting_wallet','unknown'].includes(e.status));
}
async function state(){
 const pending=await reconcile();const p=await sol.getAccountInfo(program.publicKey,'finalized');let stage,description;
 if(!p){const b=await sol.getAccountInfo(buffer.publicKey,'finalized');if(!b){stage='buffer';description='Create Solana upload buffer.';}else{
  check(b.owner.equals(LOADER)&&b.data.length===programBytes.length+37&&b.data.readUInt32LE(0)===1&&b.data[4]===1&&new PublicKey(b.data.subarray(5,37)).equals(admin),'Unexpected buffer state or authority');
  let count=0;for(let off=0;off<programBytes.length;off+=900)if(b.data.subarray(37+off,37+Math.min(off+900,programBytes.length)).equals(programBytes.subarray(off,off+900)))count++;
  const total=Math.ceil(programBytes.length/900);stage=count===total?'program':'upload';description=`Solana upload: ${count}/${total} chunks finalized.`;
 }}else{
  const d=await sol.getAccountInfo(programDataAddress(program.publicKey),'finalized');check(p.executable&&p.owner.equals(LOADER)&&d?.owner.equals(LOADER)&&d.data.readUInt32LE(0)===3&&d.data[12]===1&&new PublicKey(d.data.subarray(13,45)).equals(admin)&&hash(d.data.subarray(45))===review.programSha256,'Deployed Solana program or upgrade authority mismatch');
  const code=await evm.getBytecode({address:c.distributor});
  if(!code||code==='0x'){stage='distributor';description='Deploy the Robinhood distributor paused.';}
  else{
   check([...journal.latest().values()].some(e=>e.action==='distributor'&&e.status==='confirmed'),'Distributor deployment receipt must be reconciled before funding');
   // The contract is immutable; compare all constructor terms before funding.
   const fields={admin:c.destinationAdmin,token:c.destinationToken,campaignId:c.campaignId,sourceCampaign:'0x'+new PublicKey(review.sourceCampaign).toBuffer().toString('hex'),sourceMint:'0x'+new PublicKey(c.mint).toBuffer().toString('hex'),snapshotRoot:c.root,opensAt:c.opensAt,closesAt:c.closesAt,claimGrace:c.claimGrace,totalEligibleOldRaw:c.totalEligibleOldRaw,fundingBudgetRaw:c.fundingBudgetRaw,allowPartialSurrender:c.allowPartialSurrender,exceptionOwner:'0x'+new PublicKey(c.exceptionOwner).toBuffer().toString('hex'),exceptionAllowanceRaw:c.exceptionAllowanceRaw,exceptionGrantRaw:c.exceptionGrantRaw,exceptionOpensAt:c.exceptionOpensAt,paused:true};
   for(const [name,value]of Object.entries(fields))check(String(await evm.readContract({address:c.distributor,abi:review.evmDeployment.abi,functionName:name})).toLowerCase()===String(value).toLowerCase(),'Distributor mismatch: '+name);
   const balance=await evm.readContract({address:c.destinationToken,abi:tokenAbi,functionName:'balanceOf',args:[c.distributor]});
   if(balance<BigInt(review.totalFundingRequiredRaw)){stage='fund';description='Fund 10.1M HIVE: 10M ordinary allocation plus 100K supplemental allocation.';}
   else{
    const campaign=await sol.getAccountInfo(new PublicKey(review.sourceCampaign),'finalized');
    if(!campaign){stage='initialize';description='Initialize the Solana campaign paused.';}
    else{
     check(campaign.owner.equals(program.publicKey),'Wrong campaign owner');const decoded=decodeCampaign(campaign.data);check(decoded.paused,'Campaign unexpectedly active');
     const deploy=[...journal.latest().values()].find(e=>e.action==='distributor'&&e.status==='confirmed');check(deploy?.block,'Distributor deployment receipt is missing');
     review.deployment={solanaProgramDataAddress:programDataAddress(program.publicKey).toBase58(),solanaProgramDataSha256:hash(d.data),destinationRuntimeCodeHash:keccak256(code),destinationBlock:deploy.block};
     await createObserver(review,{solanaRpc:process.env.SOLANA_RPC_URL}).read(c.exceptionOwner);saveReview();stage='complete';description='Verified and funded. Both contracts are paused; public claims are disabled.';
    }
   }
  }
 }
 return {stage,pending,description,review:{solanaAdmin:c.admin,robinhoodAdmin:c.destinationAdmin,program:c.program,distributor:c.distributor,ordinaryWallets:review.tree.holders.length,ordinaryHIVE:'10M',supplementalHIVE:'100K',supplementalSolanaDeposit:'1,507,505.338430267 HIVE',totalHIVE:'10.1M',solanaStorageSOL:review.solanaRentLamports/1e9,estimatedDistributorFeeETH:formatUnits(BigInt(review.evmDeployment.estimatedMaximumFeeWei),18),publicOpens:'25 September 2026, 10:00 WAT',publicCloses:'2 October 2026, 10:00 WAT',localEarlyTestWallet:c.exceptionOwner,claimGraceHours:24,claimsEnabled:false}};
}
async function solPlan(action,instructions,localSigners=[]){
 const block=await sol.getLatestBlockhash('finalized');const tx=unsignedTransaction(instructions,c.admin,block.blockhash);
 if(localSigners.length)tx.sign(localSigners);
 const simulation=await sol.simulateTransaction(tx,{sigVerify:false,replaceRecentBlockhash:true,commitment:'finalized'});check(!simulation.value.err,'Solana simulation failed for '+action+': '+JSON.stringify(simulation.value.err));
 const fee=(await sol.getFeeForMessage(tx.message,'finalized')).value;check(fee!==null&&fee<1000000,'Unexpected Solana fee');
 const committed=[...journal.latest().values()].filter(e=>e.chain==='solana').reduce((n,e)=>n+BigInt(e.fee??0),0n);check(committed+BigInt(fee)<=BigInt(review.limits.maxTotalSolanaFeeLamports),'Solana fee budget exceeded');
 const id=action+'-'+randomBytes(12).toString('hex');const plan={id,action,chain:'solana',base64:Buffer.from(tx.serialize()).toString('base64'),lastValidBlockHeight:block.lastValidBlockHeight,fee};plans.set(id,plan);return {id,base64:plan.base64};
}
async function prepare(){
 check(review.terminalPolicyUserConfirmed,'Confirm the reviewed terms first');const s=await state();check(!s.pending,'A transaction is still pending');
 if(s.stage==='buffer')return {chain:'solana',transactions:[await solPlan('buffer',createBuffer(admin,buffer.publicKey,programBytes.length,await sol.getMinimumBalanceForRentExemption(programBytes.length+37)),[buffer])]};
 if(s.stage==='upload'){
  const b=await sol.getAccountInfo(buffer.publicKey,'finalized');const transactions=[];
  for(let off=0;off<programBytes.length&&transactions.length<8;off+=900){const part=programBytes.subarray(off,off+900);if(!b.data.subarray(37+off,37+off+part.length).equals(part))transactions.push(await solPlan('upload-'+off,[writeBuffer(admin,buffer.publicKey,off,part)]));}
  return {chain:'solana',transactions};
 }
 if(s.stage==='program')return {chain:'solana',transactions:[await solPlan('program',[ComputeBudgetProgram.setComputeUnitLimit({units:1400000}),...deployProgram(admin,program.publicKey,buffer.publicKey,programBytes.length,await sol.getMinimumBalanceForRentExemption(36))],[program])]};
 if(s.stage==='initialize')return {chain:'solana',transactions:[await solPlan('initialize',[initializeInstruction(c)])]};
 check(['distributor','fund'].includes(s.stage),'Nothing left to prepare');
 const nonce=await evm.getTransactionCount({address:c.destinationAdmin,blockTag:'pending'});check(nonce===await evm.getTransactionCount({address:c.destinationAdmin,blockTag:'latest'}),'Pending wallet transaction');
 let to,data;if(s.stage==='distributor'){check(nonce===review.nonce,'Wallet nonce changed. Regenerate the unsigned review before deploying.');data=review.evmDeployment.data;}else{
  to=c.destinationToken;const current=await evm.readContract({address:to,abi:tokenAbi,functionName:'balanceOf',args:[c.distributor]});const amount=BigInt(review.totalFundingRequiredRaw)-current;check(amount>0n,'Already funded');
  check(await evm.readContract({address:to,abi:tokenAbi,functionName:'balanceOf',args:[c.destinationAdmin]})>=amount,'Admin HIVE funding is insufficient');data=encodeFunctionData({abi:tokenAbi,functionName:'transfer',args:[c.distributor,amount]});
 }
 const gas=(await evm.estimateGas({account:c.destinationAdmin,to,data,value:0n}))*120n/100n;const fees=await evm.estimateFeesPerGas();check(fees.maxFeePerGas!==undefined&&fees.maxPriorityFeePerGas!==undefined,'Fee estimate missing');
 const maximumCost=gas*fees.maxFeePerGas;const spent=[...journal.latest().values()].filter(e=>e.chain==='evm'&&e.status!=='rejected').reduce((n,e)=>n+BigInt(e.maximumCost??0),0n);check(spent+maximumCost<=BigInt(review.limits.maxTotalEvmFeeWei),'EVM fee budget exceeded');check(await evm.getBalance({address:c.destinationAdmin})>=maximumCost,'Insufficient ETH');
 const transaction={from:c.destinationAdmin,...(to?{to}:{}),data,value:'0x0',chainId:'0x1237',nonce:toHex(nonce),gas:toHex(gas),maxFeePerGas:toHex(fees.maxFeePerGas),maxPriorityFeePerGas:toHex(fees.maxPriorityFeePerGas),type:'0x2'};
 const id=s.stage+'-'+randomBytes(12).toString('hex');const plan={id,action:s.stage,chain:'evm',transaction,maximumCost:maximumCost.toString()};plans.set(id,plan);return plan;
}
async function action(path,input){
 if(path==='/approve'){check(input.terminalPolicy===true&&input.graceSeconds==='86400'&&input.upgradeAuthority===c.admin,'Review acknowledgement mismatch');review.terminalPolicyUserConfirmed=true;c.terminalAttemptPolicyApproved=true;saveReview();return {approved:true};}
 if(path==='/prepare')return prepare();
 const plan=plans.get(input.id)??journal.latest().get(input.id);check(plan,'Unknown plan');
 if(path==='/evm-signed'){
  check(plan.chain==='evm','Wrong signing plan');
  const signature=await verifySignedEvm(input.raw,plan.transaction);
  const existing=journal.latest().get(plan.id);if(existing){check(existing.hash===signature,'A different transaction is already journaled');return {hash:signature,status:existing.status};}
  check(!await reconcile(),'Another transaction is pending');
  const spent=[...journal.latest().values()].filter(e=>e.chain==='evm'&&e.status!=='rejected').reduce((n,e)=>n+BigInt(e.maximumCost??0),0n);check(spent+BigInt(plan.maximumCost)<=BigInt(review.limits.maxTotalEvmFeeWei),'EVM fee budget exceeded');
  check(await evm.getTransactionCount({address:c.destinationAdmin,blockTag:'pending'})===Number(BigInt(plan.transaction.nonce)),'Wallet nonce changed; do not submit this plan');
  const entry={...plan,hash:signature,raw:input.raw,status:'submitted'};journal.append(entry);
  try{check(await evm.sendRawTransaction({serializedTransaction:input.raw})===signature,'RPC hash mismatch');}catch{journal.append({...entry,status:'unknown'});}
  return {hash:signature,status:journal.latest().get(plan.id).status};
 }
 if(path==='/solana-submit'){
  check(plan.chain==='solana'&&typeof input.base64==='string'&&input.base64.length<3000,'Invalid signed transaction');const existing=journal.latest().get(plan.id);if(existing)return {signature:existing.hash,status:existing.status};
  check(await sol.getBlockHeight('finalized')<=plan.lastValidBlockHeight,'Signing blockhash expired');
  const committed=[...journal.latest().values()].filter(e=>e.chain==='solana').reduce((n,e)=>n+BigInt(e.fee??0),0n);check(committed+BigInt(plan.fee)<=BigInt(review.limits.maxTotalSolanaFeeLamports),'Solana fee budget exceeded');
  const tx=VersionedTransaction.deserialize(Buffer.from(input.base64,'base64')),expected=VersionedTransaction.deserialize(Buffer.from(plan.base64,'base64'));const message=Buffer.from(tx.message.serialize());check(message.equals(Buffer.from(expected.message.serialize())),'Wallet changed the reviewed transaction');
  for(let i=0;i<tx.message.header.numRequiredSignatures;i++){const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),tx.message.staticAccountKeys[i].toBuffer()]),format:'der',type:'spki'});check(verify(null,message,key,tx.signatures[i]),'Invalid required signature');}
  const signature=getBase58Decoder().decode(tx.signatures[0]);const entry={...plan,hash:signature,raw:input.base64,status:'submitted'};journal.append(entry);
  try{check(await sol.sendRawTransaction(Buffer.from(input.base64,'base64'),{skipPreflight:false,maxRetries:0})===signature,'RPC signature mismatch');}catch{journal.append({...entry,status:'unknown'});}
  return {signature,status:journal.latest().get(plan.id).status};
 }
 if(path==='/evm-intent'){check(plan.chain==='evm'&&!journal.latest().has(plan.id),'Duplicate wallet intent');check(!await reconcile(),'Pending transaction');journal.append({...plan,status:'awaiting_wallet'});return {recorded:true};}
 if(path==='/evm-hash'){check(plan.chain==='evm'&&/^0x[0-9a-f]{64}$/i.test(input.hash),'Invalid transaction hash');const entry=journal.latest().get(plan.id);check(entry?.status==='awaiting_wallet'||entry?.status==='unknown','Wallet intent missing');journal.append({...entry,hash:input.hash,status:'submitted'});return {recorded:true};}
 if(path==='/evm-wallet-error'){const entry=journal.latest().get(plan.id);check(entry?.status==='awaiting_wallet','Wallet intent missing');journal.append({...entry,status:input.rejected===true?'rejected':'unknown'});return {recorded:true};}
 throw Error('Unsupported action');
}
const server=createServer(async(req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 const reply=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 try{
  check(allowedHosts.has(req.headers.host),'Loopback host required');const path=new URL(req.url,'http://'+req.headers.host).pathname;
  if(req.method==='GET'&&path==='/'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store','Set-Cookie':`hiveDeploy=${cookie}; HttpOnly; SameSite=Strict; Path=/`,'X-Frame-Options':'DENY'});return res.end(readFileSync(resolve(here,'wallet.html')));}
  if(req.method==='GET'&&['/wallet.js','/web3.js','/key-signing.js'].includes(path)){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});return res.end(readFileSync(path==='/wallet.js'?resolve(here,'wallet.js'):path==='/key-signing.js'?resolve(dir,'key-signing.bundle.js'):resolve(root,'node_modules/@solana/web3.js/lib/index.iife.min.js')));}
  check((req.headers.cookie??'').split(';').map(s=>s.trim()).includes('hiveDeploy='+cookie),'Deployment session required');
  if(req.method==='GET'&&path==='/recovery')return reply(200,{unresolved:[...journal.latest().values()].filter(e=>e.chain==='evm'&&['awaiting_wallet','unknown'].includes(e.status)&&!e.hash).map(e=>({id:e.id,action:e.action,nonce:e.transaction.nonce}))});
  if(req.method==='GET'&&path==='/status')return reply(200,await state());
  check(req.method==='POST'&&req.headers.origin==='http://'+req.headers.host&&req.headers['content-type']?.startsWith('application/json'),'Same-origin JSON POST required');
  check(!busy,'Another operation is running');busy=true;
  try{let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;check(size<=65536,'Request too large');chunks.push(chunk);}return reply(200,await action(path,JSON.parse(Buffer.concat(chunks).toString())));}finally{busy=false;}
 }catch(error){let message=error.shortMessage??error.message??'Deployment request failed';if(process.env.SOLANA_RPC_URL)message=message.split(process.env.SOLANA_RPC_URL).join('[private RPC]');reply(409,{error:message});}
});
server.listen(port,'127.0.0.1',()=>console.log('Deployment review ready at http://localhost:8789 — wallet signatures required; no automatic transactions.'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{unlock();process.exit(0);}));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData, encodeFunctionResult, encodeAbiParameters, encodeEventTopics, TransactionNotFoundError, keccak256, zeroAddress } from 'viem';
import { abi, policy, metadata, snapshots, transactions, receipts } from '../scripts/tokenization/modules.mjs';

const signer = '0x' + '1'.repeat(40), other = '0x' + '2'.repeat(40);
const hash = '0x' + 'a'.repeat(64);
const config = { supply: 10n ** 27n, phantomQuote: 168n * 10n ** 16n, graduationThreshold: 420n * 10n ** 16n, curveFeeBps: 100n, hookFeeBps: 100n, poolFee: 0, tickSpacing: 200, enabled: true };
const contracts = Object.fromEntries(snapshots.contractNames.map((name, i) => [name, { address: name === 'factory' ? policy.PONS_FACTORY : '0x' + String(i + 3).repeat(40), codeHash: keccak256('0x6001') }]));
const snapshot = { chainId: 4663, blockNumber: 10n, blockHash: hash, timestamp: 100n, signer, configId: 0n, launchFee: 500000000000000n, expectedEconomics: hash, canLaunch: true, maxCreatorTaxBps: 1000n, snipeTaxStartBps: 9900n, snipeTaxSeconds: 5n, config, contracts };
const agent = { name: 'Research agent', bio: 'Research with verifiable sources.', status: 'active', walletAddress: signer, walletAddressVerifiedAt: new Date() };
const preview = metadata.profilePreview('0123456789abcdef01234567', agent, 'owner');
const choices = { signer, symbol: 'research', purchase: '', salt: hash, logoURI: 'ipfs://bafybeigdyrztabcdefghijklmnopqrstuv234567abcdefghijklmnop' };
const release = { reviewed: true, chainId: 4663, contracts: Object.fromEntries(Object.entries(contracts).map(([key, value]) => [key, { ...value, sourceEvidence: 'Fixture only, never a production release' }])) };
const candidate = patch => transactions.buildLaunchCandidate(preview, { ...choices, ...patch }, snapshot);

function clientFor(call, overrides = {}) {
 return {
  getChainId: async () => 4663,
  getBlock: async () => ({ number: 10n, hash, timestamp: 101n }),
  call: async () => ({ data: call.kind === 'launch'
   ? encodeFunctionResult({ abi: abi.factoryAbi, functionName: 'launchToken', result: [other, contracts.deployer.address] })
   : encodeFunctionResult({ abi: abi.routerAbi, functionName: 'launchAndBuy', result: [other, contracts.deployer.address, call.quote.tokens] }) }),
  getTransactionCount: async () => 4,
  estimateGas: async () => 1000000n,
  estimateFeesPerGas: async () => ({ maxFeePerGas: 2n, maxPriorityFeePerGas: 1n }),
  getBalance: async () => 100n * 10n ** 18n,
  ...overrides,
 };
}

test('snapshot pins every contract/configuration read to the same block', async () => {
 const reads = [], codes = [];
 const values = { launchFee: snapshot.launchFee, canLaunch: true, maxCreatorTaxBps: 1000n, snipeTaxStartBps: 9900n, snipeTaxSeconds: 5n,
  memeHook: contracts.hook.address, launchDeployer: contracts.deployer.address, feeEscrow: contracts.escrow.address, launchForwarder: contracts.router.address,
  getLaunchConfig: config, previewLaunchEconomics: hash, currentFeePolicy: { hookFeeBps: 100 } };
 const client = {
  getChainId: async () => 4663, getBlock: async () => ({ number: 10n, hash, timestamp: 100n }),
  readContract: async args => { reads.push(args); return values[args.functionName]; },
  getCode: async args => { codes.push(args); return '0x6001'; },
 };
 const actual = await snapshots.readLaunchSnapshot(client, signer);
 assert.deepEqual(actual, snapshot);
 assert.equal(reads.length, 12); assert.equal(codes.length, 5);
 assert.ok([...reads, ...codes].every(r => r.blockNumber === 10n));
 assert.deepEqual(reads.find(r=>r.functionName==='canLaunch').args, [signer]);
 await assert.rejects(snapshots.readLaunchSnapshot({ ...client, getChainId: async () => 1 }, signer), /not connected/);
 await assert.rejects(snapshots.readLaunchSnapshot({ ...client, getCode: async () => '0x' }, signer), /no deployed code/);
});

test('unreviewed or changed deployments cannot prepare signing requests', () => {
 snapshots.assertReviewedRelease(snapshot, release);
 assert.throws(()=>snapshots.assertReviewedRelease(snapshot,{...release,reviewed:false}),/not complete/);
 for(const name of snapshots.contractNames) for(const patch of [{sourceEvidence:''},{codeHash:'0x'+'b'.repeat(64)},{address:other}]) {
  assert.throws(()=>snapshots.assertReviewedRelease(snapshot,{...release,contracts:{...release.contracts,[name]:{...release.contracts[name],...patch}}}), /changed|reviewed/);
 }
 for(const patch of [{canLaunch:false},{maxCreatorTaxBps:100n},{chainId:1},{configId:2n},{config:{...config,hookFeeBps:200n}}]) assert.throws(()=>snapshots.assertLaunchAvailable({...snapshot,...patch}));
});

test('zero buy encodes only the factory launch and exact launch fee', () => {
 const call = candidate({});
 assert.equal(call.kind,'launch'); assert.equal(call.to,policy.PONS_FACTORY); assert.equal(call.value,snapshot.launchFee);
 const decoded = decodeFunctionData({abi:abi.factoryAbi,data:call.data});
 assert.equal(decoded.functionName,'launchToken'); assert.equal(decoded.args[1],0n); assert.equal(decoded.args[2],zeroAddress);
 const p = decoded.args[0];
 assert.equal(p.symbol,'RESEARCH'); assert.equal(p.creatorFeeRecipient.toLowerCase(),signer); assert.equal(p.creatorTaxBps,200); assert.equal(p.buybackEnabled,false);
 assert.equal(p.description,preview.metadata.description); assert.equal(p.expectedEconomics,hash); assert.equal(p.salt,hash);
 assert.deepEqual(p.socials,{twitter:'',telegram:'',discord:'',website:preview.metadata.socials.website,farcaster:''});
});

test('opening buy uses router, minimum output, explicit signer recipient and no extra exemptions', () => {
 const call = candidate({purchase:'0.1'});
 assert.equal(call.kind,'launch-and-buy'); assert.equal(call.to,contracts.router.address); assert.equal(call.value,snapshot.launchFee+10n**17n);
 const decoded=decodeFunctionData({abi:abi.routerAbi,data:call.data});
 assert.equal(decoded.args[3],10n**17n); assert.equal(decoded.args[4],call.quote.minimumTokens); assert.equal(decoded.args[5].toLowerCase(),signer); assert.deepEqual(decoded.args[6],[]);
});

test('admin fees cannot be redirected and owner wallet must match', () => {
 const admin = metadata.profilePreview(preview.agentId,agent,'admin');
 const call = transactions.buildLaunchCandidate(admin,{...choices,signer:other,purchase:'0.1'},{...snapshot,signer:other});
 assert.equal(call.params.creatorFeeRecipient,policy.HIVE_CREATOR_FEE_WALLET);
 assert.equal(decodeFunctionData({abi:abi.routerAbi,data:call.data}).args[5].toLowerCase(),other);
 assert.throws(()=>transactions.buildLaunchCandidate({...admin,recipient:other},choices,snapshot),/recipient changed/);
 assert.throws(()=>transactions.buildLaunchCandidate(preview,{...choices,signer:other},{...snapshot,signer:other}),/verified agent wallet/);
});

test('unsafe choices and unresolved profiles cannot produce calldata', () => {
 for(const patch of [{salt:'0x'+'0'.repeat(64)},{salt:'bad'},{logoURI:'https://mutable.example/avatar.png'},{purchase:'-1'},{symbol:'$BAD'},{signer:other}]) assert.throws(()=>candidate(patch));
 for(const patch of [{issues:['Fix profile']},{existingToken:{}},{metadata:{...preview.metadata,socials:{...preview.metadata.socials,website:'https://example.com'}}}]) assert.throws(()=>transactions.buildLaunchCandidate({...preview,...patch},choices,snapshot));
 assert.throws(()=>transactions.buildLaunchCandidate(preview,choices,{...snapshot,expectedEconomics:'0x'+'0'.repeat(64)}),/pinned/);
});

test('simulated output must match the integer quote and return distinct addresses', async () => {
 const call=candidate({purchase:'0.1'});
 assert.equal((await transactions.simulateLaunchCandidate(clientFor(call),call)).tokensOut,call.quote.tokens);
 const mismatch={call:async()=>({data:encodeFunctionResult({abi:abi.routerAbi,functionName:'launchAndBuy',result:[other,contracts.deployer.address,call.quote.tokens-1n]})})};
 await assert.rejects(transactions.simulateLaunchCandidate(clientFor(call,mismatch),call),/differs/);
 await assert.rejects(transactions.simulateLaunchCandidate(clientFor(call,{getChainId:async()=>1}),call),/wrong chain/);
 await assert.rejects(transactions.simulateLaunchCandidate(clientFor(call,{call:async()=>({data:'0x'})}),call));
});

test('reviewed preparation includes gas headroom and total affordability', async () => {
 const call=candidate({});
 const result=await transactions.prepareReviewedLaunch(clientFor(call),preview,choices,snapshot,release);
 assert.equal(result.transaction.gas,1200000n);assert.equal(result.transaction.nonce,4);
 assert.equal(result.maximumNetworkFee,2400000n);assert.equal(result.maximumTotal,snapshot.launchFee+2400000n);
 for(const overrides of [
  {getBalance:async()=>0n},
  {getTransactionCount:async({blockTag})=>blockTag==='pending'?5:4},
  {getBlock:async()=>({hash,timestamp:221n})},
  {getBlock:async({blockNumber})=>({hash:blockNumber?'0x'+'b'.repeat(64):hash,timestamp:101n})},
  {estimateFeesPerGas:async()=>({})},
 ]) await assert.rejects(transactions.prepareReviewedLaunch(clientFor(call,overrides),preview,choices,snapshot,release));
 await assert.rejects(transactions.prepareReviewedLaunch(clientFor(call),preview,choices,snapshot,{...release,reviewed:false}),/not complete/);
});

function receiptFixture(purchase = '') {
 const call=candidate({purchase});
 const prediction={token:other,curve:contracts.deployer.address,tokensOut:call.quote.tokens};
 const transaction={hash,from:call.from,to:call.to,nonce:4,value:call.value,input:call.data,blockHash:hash};
 const event={address:policy.PONS_FACTORY,removed:false,
  topics:encodeEventTopics({abi:abi.factoryAbi,eventName:'TokenLaunched',args:{token:prediction.token,curve:prediction.curve,deployer:signer}}),
  data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[zeroAddress,0n,config.graduationThreshold])};
 const buy={address:prediction.curve,removed:false,
  topics:encodeEventTopics({abi:abi.curveAbi,eventName:'CurveBuy',args:{buyer:contracts.router.address,recipient:signer}}),
  data:encodeAbiParameters(Array.from({length:4},()=>({type:'uint256'})),[call.quote.spent,call.quote.tokens,0n,0n])};
 const receipt={transactionHash:hash,blockNumber:10n,blockHash:hash,status:'success',logs:purchase?[event,buy]:[event]};
 const record={exists:true,token:prediction.token,curve:prediction.curve,deployer:signer,creatorFeeRecipient:signer,pairToken:zeroAddress,creatorTaxBps:200,buybackEnabled:false};
 const values={getLaunchedToken:record,getTokenInfo:[signer,call.params.logo,call.params.description,call.params.socials],name:call.params.name,symbol:call.params.symbol};
 const reads=[];
 const client={getChainId:async()=>4663,getTransaction:async()=>transaction,getTransactionReceipt:async()=>receipt,
  getBlock:async()=>({number:10n,hash}),readContract:async args=>{reads.push(args);return values[args.functionName];}};
 return {client,call,transaction,receipt,event,buy,values,reads,expected:{candidate:call,nonce:4,prediction}};
}

test('receipt publishes only a finalized launch with matching metadata and opening purchase', async () => {
 for(const purchase of ['', '0.1']) {
  const f=receiptFixture(purchase);
  const result=await receipts.reconcileLaunchReceipt(f.client,f.expected,hash);
  assert.deepEqual(result,{state:'confirmed',token:{chainId:4663,address:other,symbol:'RESEARCH',transactionHash:hash}});
  assert.ok(f.reads.every(read=>read.blockNumber===10n));
 }
});

test('unknown hashes, unfinalized receipts and reorgs stay unresolved; outages are surfaced', async () => {
 const f=receiptFixture();
 assert.deepEqual(await receipts.reconcileLaunchReceipt({...f.client,getTransaction:async()=>{throw new TransactionNotFoundError({hash})}},f.expected,hash),{state:'pending'});
 for(const patch of [{number:9n,hash},{number:10n,hash:'0x'+'b'.repeat(64)}]) {
  assert.deepEqual(await receipts.reconcileLaunchReceipt({...f.client,getBlock:async()=>patch},f.expected,hash),{state:'confirming'});
 }
 let reads=0;
 assert.deepEqual(await receipts.reconcileLaunchReceipt({...f.client,getBlock:async()=>({number:10n,hash:++reads===3?'0x'+'b'.repeat(64):hash})},f.expected,hash),{state:'confirming'});
 await assert.rejects(receipts.reconcileLaunchReceipt({...f.client,getTransactionReceipt:async()=>{throw Error('RPC offline')}},f.expected,hash),/RPC offline/);
});

test('reverted transactions are not final failures before finality', async () => {
 const f=receiptFixture();f.receipt.status='reverted';
 assert.deepEqual(await receipts.reconcileLaunchReceipt({...f.client,getBlock:async()=>({number:9n,hash})},f.expected,hash),{state:'confirming'});
 assert.deepEqual(await receipts.reconcileLaunchReceipt(f.client,f.expected,hash),{state:'reverted',transactionHash:hash});
});

test('unrelated transactions cannot attach a token even with plausible launch logs', async () => {
 for(const patch of [{from:other},{to:other},{nonce:5},{value:0n},{input:'0x1234'},{hash:'0x'+'b'.repeat(64)}]) {
  const f=receiptFixture();Object.assign(f.transaction,patch);
  await assert.rejects(receipts.reconcileLaunchReceipt(f.client,f.expected,hash),/does not match/);
 }
});

test('wrong factory events, duplicate launches and altered on-chain metadata are rejected', async () => {
 for(const logs of [[],[{address:other}],'duplicate']) {
  const f=receiptFixture();f.receipt.logs=logs==='duplicate'?[f.event,f.event]:logs.map(log=>({...f.event,...log}));
  await assert.rejects(receipts.reconcileLaunchReceipt(f.client,f.expected,hash),/exactly one/);
 }
 for(const patch of [{creatorFeeRecipient:other},{creatorTaxBps:0},{buybackEnabled:true},{deployer:other},{exists:false}]) {
  const f=receiptFixture();Object.assign(f.values.getLaunchedToken,patch);
  await assert.rejects(receipts.reconcileLaunchReceipt(f.client,f.expected,hash),/differs/);
 }
 for(const name of ['name','symbol','getTokenInfo']) {
  const f=receiptFixture();f.values[name]=name==='getTokenInfo'?[signer,'changed','changed',{}]:'different';
  await assert.rejects(receipts.reconcileLaunchReceipt(f.client,f.expected,hash),/differs/);
 }
 const f=receiptFixture('0.1');f.receipt.logs=[f.event];
 await assert.rejects(receipts.reconcileLaunchReceipt(f.client,f.expected,hash),/opening purchase/);
});

test('pruned historical state uses a pinned current state only after exact finalized receipt verification', async () => {
 const f=receiptFixture(),currentHash='0x'+'c'.repeat(64), reads=[];
 const client={...f.client,
  getBlock:async ({blockTag,blockNumber})=>blockTag==='latest'||blockNumber===20n?{number:20n,hash:currentHash}:{number:10n,hash},
  readContract:async args=>{reads.push(args.blockNumber);if(args.blockNumber===10n)throw Error('historical state abc is not available');return f.values[args.functionName];},
 };
 assert.equal((await receipts.reconcileLaunchReceipt(client,f.expected,hash)).state,'confirmed');
 assert.ok(reads.includes(10n)&&reads.includes(20n));
 f.values.symbol='CHANGED';await assert.rejects(receipts.reconcileLaunchReceipt(client,f.expected,hash),/differs/);f.values.symbol=f.call.params.symbol;
 assert.equal((await receipts.reconcileLaunchReceipt({...client,getBlock:async args=>args.blockNumber===20n?{number:20n,hash}:client.getBlock(args)},f.expected,hash)).state,'confirming');
 let read=0;
 assert.equal((await receipts.reconcileLaunchReceipt({...client,getBlock:async()=>({number:9n,hash}),readContract:async()=>{read++;}},f.expected,hash)).state,'confirming');assert.equal(read,0);
 await assert.rejects(receipts.reconcileLaunchReceipt({...client,readContract:async()=>{throw Error('RPC offline');}},f.expected,hash),/RPC offline/);
});
test('launch time comes from the canonical receipt block, not the latest block or draft',async()=>{
 const f=receiptFixture();const timestamp=1792451028n;
 const result=await receipts.reconcileLaunchReceipt({...f.client,getBlock:async({blockTag})=>({number:blockTag==='finalized'?20n:10n,hash,timestamp:blockTag?timestamp+3600n:timestamp})},f.expected,hash);
 assert.equal(result.state,'confirmed');assert.equal(result.token.launchedAt,new Date(Number(timestamp)*1000).toISOString());
});

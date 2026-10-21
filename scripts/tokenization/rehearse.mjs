// Local forks only. Never point this script at a live chain or forwarder.
import assert from 'node:assert/strict';
import { createPublicClient, decodeEventLog, encodeFunctionData, http, keccak256, parseEther, toHex, zeroAddress } from 'viem';
import { abi, metadata, policy, snapshots, transactions, receipts } from './modules.mjs';
const endpoint = new URL(process.env.HIVE_PONS_FORK_URL || 'http://127.0.0.1:18547');
if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) || endpoint.username || endpoint.password) throw Error('Rehearsal requires a local HTTP Anvil fork.');
const client = createPublicClient({ transport: http(endpoint.href, { timeout: 60000, retryCount: 0 }) });
if (!String(await client.request({ method: 'web3_clientVersion' })).toLowerCase().includes('anvil')) throw Error('Refusing to transact outside Anvil.');
if (await client.getChainId() !== policy.PONS_CHAIN_ID) throw Error('Fork must use chain ID 4663.');
const signer = '0x1111111111111111111111111111111111111111';
const checkpoint = await client.request({method:'evm_snapshot'});
let failure;
try {
 await client.request({method:'anvil_impersonateAccount',params:[signer]});
 await client.request({method:'anvil_setBalance',params:[signer,toHex(parseEther('100'))]});
 for (const [index, role, purchase] of [[0,'owner',''],[1,'owner','0.1'],[2,'admin','0.1'],[3,'owner','10']]) {
  const preview = metadata.profilePreview('0123456789abcdef01234567',{name:'Hive fork rehearsal',bio:'Local rehearsal. This is not a real agent token.',status:'active',walletAddress:signer,walletAddressVerifiedAt:new Date()},role);
  const snapshot = await snapshots.readLaunchSnapshot(client,signer);
  const choices = {signer,symbol:'HIVETEST',purchase,logoURI:'ipfs://bafybeigdyrztabcdefghijklmnopqrstuv234567abcdefghijklmnop',salt:keccak256(toHex('hive-fork-rehearsal-'+index))};
  const candidate = transactions.buildLaunchCandidate(preview,choices,snapshot);
  const simulated = await transactions.simulateLaunchCandidate(client,candidate);
  const nonce = await client.getTransactionCount({address:signer});
  const before = await client.getBalance({address:signer});
  const hash = await client.request({method:'eth_sendTransaction',params:[{from:signer,to:candidate.to,data:candidate.data,value:toHex(candidate.value),gas:toHex(25000000n)}]});
  const receipt = await client.waitForTransactionReceipt({hash,timeout:60000});
  assert.equal(receipt.status,'success');
  assert.equal((await receipts.reconcileLaunchReceipt(client,{candidate,nonce,prediction:simulated},hash)).state,'confirming');
  // Anvil's finalized tag trails its head by 64 blocks. Advance only this fork.
  await client.request({method:'anvil_mine',params:[toHex(64)]});
  const verified = await receipts.reconcileLaunchReceipt(client,{candidate,nonce,prediction:simulated},hash);
  assert.equal(verified.state,'confirmed');
  const events = receipt.logs.filter(log=>log.address.toLowerCase()===policy.PONS_FACTORY.toLowerCase()).flatMap(log=>{try { const event=decodeEventLog({abi:abi.factoryAbi,data:log.data,topics:log.topics});return event.eventName==='TokenLaunched'?[event]:[];}catch{return []}});
  assert.equal(events.length,1);
  const {token,curve,deployer,pairToken} = events[0].args;
  assert.equal(token.toLowerCase(),simulated.token.toLowerCase());assert.equal(curve.toLowerCase(),simulated.curve.toLowerCase());assert.equal(deployer.toLowerCase(),signer);assert.equal(pairToken,zeroAddress);
  const record = await client.readContract({address:policy.PONS_FACTORY,abi:abi.factoryAbi,functionName:'getLaunchedToken',args:[token]});
  assert.equal(record.creatorFeeRecipient.toLowerCase(),preview.recipient.toLowerCase());assert.equal(record.creatorTaxBps,policy.creatorTaxBps(preview.feePolicyVersion));assert.equal(record.buybackEnabled,false);assert.equal(record.exists,true);
  const info = await client.readContract({address:token,abi:abi.tokenAbi,functionName:'getTokenInfo'});
  assert.equal(info[0].toLowerCase(),signer);assert.equal(info[1],choices.logoURI);assert.equal(info[2],preview.metadata.description);assert.deepEqual(info[3],candidate.params.socials);
  const balance = await client.readContract({address:token,abi:abi.tokenAbi,functionName:'balanceOf',args:[signer]});
  assert.equal(balance,candidate.quote.tokens);
  const after = await client.getBalance({address:signer});
  assert.equal(before-after,snapshot.launchFee+candidate.quote.spent+receipt.gasUsed*receipt.effectiveGasPrice);
  if(purchase==='10') assert.ok(candidate.quote.refund>0n);
  // Same salt and terms must never create a second token.
  await assert.rejects(client.call({account:signer,to:candidate.to,data:candidate.data,value:candidate.value}));
  // A stale economics pin must revert, even with a fresh salt.
  const changed={...candidate.params,expectedEconomics:'0x'+'b'.repeat(64),salt:keccak256(toHex('changed-'+index))};
  const stale=encodeFunctionData({abi:abi.factoryAbi,functionName:'launchToken',args:[changed,0n,zeroAddress]});
  await assert.rejects(client.call({account:signer,to:policy.PONS_FACTORY,data:stale,value:snapshot.launchFee}));
  console.log(`PASS local fork: ${role}, opening buy ${purchase||'0'} ETH, exact metadata/recipient/fee/balance/refund, duplicate salt and stale pin rejected.`);
 }
} catch(error) { failure=error; }
finally {
 await client.request({method:'evm_revert',params:[checkpoint]});
 await client.request({method:'anvil_stopImpersonatingAccount',params:[signer]});
}
if(failure) throw failure;
console.log('All local changes reverted. No live transactions submitted.');

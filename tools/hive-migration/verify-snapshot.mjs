import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=process.argv[2]?pathToFileURL(resolve(process.argv[2])+'/'):new URL('./local/snapshot-2026-09-21T09-43-40.282Z/',import.meta.url);
const read=async name=>readFile(new URL(name,dir),'utf8');
const summary=JSON.parse(await read('summary.json'));
for(const [name,expected]of Object.entries(summary.sha256))assert.equal(createHash('sha256').update(await read(name)).digest('hex'),expected,`Changed evidence: ${name}`);
const raw=JSON.parse(await read('token-accounts.raw.json'));
assert.equal(raw.context.slot,summary.snapshotSlot);
const block=JSON.parse(await read('block.json'));assert.equal(block.blockhash,summary.blockhash);
const owners=new Map(),seen=new Set();let total=0n;
for(const {pubkey,account}of raw.value){
 assert(!seen.has(pubkey));seen.add(pubkey);
 const bytes=Buffer.from(account.data[0],'base64');assert.equal(bytes.length,165);
 assert.equal(new PublicKey(bytes.subarray(0,32)).toBase58(),summary.mint);
 const owner=new PublicKey(bytes.subarray(32,64)).toBase58(),amount=bytes.readBigUInt64LE(64);
 total+=amount;if(amount>0n)owners.set(owner,(owners.get(owner)??0n)+amount);
}
assert.equal(total.toString(),summary.supplyRaw);
const holders=JSON.parse(await read('holders.json'));assert.equal(holders.length,owners.size);
for(const h of holders)assert.equal(h.amountRaw,owners.get(h.owner).toString());
assert.equal(holders.reduce((n,h)=>n+BigInt(h.amountRaw),0n),total);
console.log(JSON.stringify({verified:true,slot:summary.snapshotSlot,owners:owners.size,accounts:seen.size,supplyRaw:total.toString(),checks:'Evidence hashes; independent binary decoding; owner aggregation; full supply; block identity'}));

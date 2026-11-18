// Independent binary recount, starting from preserved raw SPL account bytes.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
const dir=new URL('./local/snapshot-2026-09-21T10-48-52.230Z/',import.meta.url);
const raw=readFileSync(new URL('token-accounts.raw.json',dir)),holdersBytes=readFileSync(new URL('holders.json',dir));
const hash=b=>createHash('sha256').update(b).digest('hex');
if(hash(raw)!=='ff23b22e72d8499b05c6014bdd295de4ffc6d76fa43fe3f049cf1aa60a0cc24b'||hash(holdersBytes)!=='cce4c645194e8b7fa1f1b600c0332e099cb488dce47ffa66fcf6b50920f5daaa')throw Error('Frozen evidence hash mismatch');
const data=JSON.parse(raw),owners=new Map(),accounts=new Set();let sum=0n,nonzero=0;
if(data.context.slot!==449032979)throw Error('Wrong cutoff');
for(const row of data.value){
 const b=Buffer.from(row.account.data[0],'base64');
 if(accounts.has(row.pubkey)||row.account.owner!=='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'||b.length!==165||new PublicKey(b.subarray(0,32)).toBase58()!=='6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS'||![1,2].includes(b[108]))throw Error('Invalid token account');
 accounts.add(row.pubkey);const amount=b.readBigUInt64LE(64),owner=new PublicKey(b.subarray(32,64)).toBase58();sum+=amount;
 if(amount>0n){nonzero++;owners.set(owner,(owners.get(owner)??0n)+amount);}
}
const holders=JSON.parse(holdersBytes);
if(holders.length!==owners.size||new Set(holders.map(h=>h.owner)).size!==owners.size)throw Error('Holder count mismatch');
for(const h of holders)if(owners.get(h.owner)!==BigInt(h.amountRaw))throw Error('Owner balance mismatch');
const mints=['mint-before.json','mint-after.json'].map(name=>Buffer.from(JSON.parse(readFileSync(new URL(name,dir))).value.data[0],'base64'));
if(!mints[0].equals(mints[1])||mints[0][44]!==9||mints[0].readBigUInt64LE(36)!==sum)throw Error('Mint supply mismatch');
const onCurve=[...owners.keys()].filter(o=>PublicKey.isOnCurve(new PublicKey(o).toBytes())).length;
const report={snapshotSlot:data.context.slot,rawAccountSha256:hash(raw),holderSha256:hash(holdersBytes),tokenAccounts:accounts.size,nonzeroTokenAccounts:nonzero,zeroTokenAccounts:accounts.size-nonzero,uniqueNonzeroOwners:owners.size,onCurveOwners:onCurve,offCurveOwners:owners.size-onCurve,poolOwners:1,nonPoolOwners:owners.size-1,nonPoolOffCurveOwners:owners.size-onCurve-1,supplyRaw:sum.toString(),everyOwnerBalanceMatches:true,mintBeforeAfterIdentical:true,qualification:'Counts are nonzero owner addresses at the frozen cutoff, not people or the current live count.'};
writeFileSync(new URL('./local/snapshot-recount-10m.json',import.meta.url),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report,null,2));

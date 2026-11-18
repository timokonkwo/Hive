// Deterministic ordinary-wallet allocation under the user's approved 1M snapshot floor.
// Current balances remain a deposit-time condition, never a changing denominator.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import {proportionalAllocation} from './proportional-model.mjs';
const raw=readFileSync(new URL('./local/snapshot-2026-09-21T10-48-52.230Z/holders.json',import.meta.url));
const hash=createHash('sha256').update(raw).digest('hex');
if(hash!=='cce4c645194e8b7fa1f1b600c0332e099cb488dce47ffa66fcf6b50920f5daaa')throw Error('Snapshot changed');
const pool='HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC';
const rows=JSON.parse(raw).filter(h=>h.owner!==pool&&PublicKey.isOnCurve(new PublicKey(h.owner).toBytes())&&BigInt(h.amountRaw)>=1000000000000000n).map(h=>({owner:h.owner,amountRaw:BigInt(h.amountRaw),eligible:true,reviewNote:'User approved all signing wallets subject to at least 1M at snapshot and before deposit; proportional 10M total budget. Current holdings are checked before deposit.'}));
if(rows.length!==72)throw Error('Unexpected eligible population');
const allocation=proportionalAllocation(rows,10000000000000000000000000n);
const json=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2)+'\n';
writeFileSync(new URL('../../data/hive-claim-allocation.json',import.meta.url),json({snapshotSlot:449032979,holdersSha256:hash,method:'proportional_to_frozen_eligible_holdings',minimumSnapshotRaw:'1000000000000000',minimumCurrentRaw:'1000000000000000',...allocation}));
writeFileSync(new URL('./local/eligibility-minimum-v2/reviewed-holders.json',import.meta.url),json(rows));
console.log(json({...allocation,rows:undefined,eligibleWallets:rows.length}));

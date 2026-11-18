// Export only public token balances for the read-only checker. No deployment/publishing.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
const input=new URL('./local/snapshot-2026-09-21T10-48-52.230Z/holders.json',import.meta.url);
const raw=readFileSync(input),hash=createHash('sha256').update(raw).digest('hex');
if(hash!=='cce4c645194e8b7fa1f1b600c0332e099cb488dce47ffa66fcf6b50920f5daaa')throw Error('Frozen snapshot hash mismatch');
const pool='HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC';
const holders=JSON.parse(raw).map(h=>({owner:h.owner,amountRaw:h.amountRaw,kind:h.owner===pool?'pool':PublicKey.isOnCurve(new PublicKey(h.owner).toBytes())?'wallet':'custody'}));
const result={slot:449032979,capturedAt:'2026-09-21T10:48:43.000Z',holdersSha256:hash,sourceMint:'6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS',holders};
const out=new URL('../../data/hive-reimbursement-snapshot.json',import.meta.url),text=JSON.stringify(result,null,2)+'\n';
if(existsSync(out)){if(readFileSync(out,'utf8')!==text)throw Error('Existing checker snapshot differs; review before replacing');}
else writeFileSync(out,text,{flag:'wx'});
console.log('Verified public checker snapshot: '+holders.length+' owners. No eligibility approved or publication performed.');

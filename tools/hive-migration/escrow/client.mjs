// Unsigned instruction and commitment construction. No signing or broadcasting.
import {createHash} from 'node:crypto';
import {proportionalQuote} from '../proportional-model.mjs';
import {getBase58Encoder} from '@solana/kit';
import {PublicKey, SystemProgram, TransactionInstruction, Transaction, VersionedTransaction} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction} from '@solana/spl-token';

export const sha256 = (...parts) => createHash('sha256').update(Buffer.concat(parts)).digest();
export function depositEvidence(signature) {
  const raw=Buffer.from(getBase58Encoder().encode(signature));
  if(raw.length!==64)throw Error('Expected a 64-byte Solana transaction signature');
  return hex(sha256(raw));
}
export function bytes(value, length) {
  if(typeof value==='string'&&(!/^0x(?:[0-9a-f]{2})+$/i.test(value)||value.length!==2+length*2))throw Error(`Expected exactly ${length} hex bytes`);
  const b = typeof value === 'string' ? Buffer.from(value.slice(2), 'hex') : Buffer.from(value);
  if (b.length !== length) throw Error(`Expected exactly ${length} bytes`);
  return b;
}
export function integer(value, width, bigEndian = false) {
  if (typeof value !== 'bigint' && !(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value))) throw Error('Use bigint or canonical decimal string');
  let n = BigInt(value);
  if (n < 0n || n >= 1n << BigInt(width * 8)) throw Error('Integer out of range');
  const out = Buffer.alloc(width);
  for (let i = 0; i < width; i++) { out[bigEndian ? width - 1 - i : i] = Number(n & 255n); n >>= 8n; }
  return out;
}
const pk = x => new PublicKey(x);
const keyBytes = x => pk(x).toBuffer();
export const hex = b => `0x${Buffer.from(b).toString('hex')}`;
export function snapshotLeaf(campaignId, mint, owner, amount) {
  return sha256(Buffer.from('HIVE_SNAPSHOT_V1'), bytes(campaignId, 32), keyBytes(mint), keyBytes(owner), integer(amount, 8, true));
}
export function claimId(campaign, owner) { return sha256(Buffer.from('HIVE_CLAIM_V1'), keyBytes(campaign), keyBytes(owner)); }
function pair(a, b) { return Buffer.compare(a, b) < 0 ? sha256(a, b) : sha256(b, a); }
export function verifyProof(leaf, proof, root) {
  if (proof.length > 32) return false;
  return proof.reduce((a, b) => pair(a, bytes(b, 32)), bytes(leaf, 32)).equals(bytes(root, 32));
}
export function snapshotTree(campaignId, mint, holders) {
  if (!Array.isArray(holders) || holders.length === 0) throw Error('Reviewed nonempty holder list required');
  const seen = new Set();
  const entries = holders.map(h => {
    const owner = pk(h.owner).toBase58();
    if (seen.has(owner) || BigInt(h.amountRaw) <= 0n) throw Error('Duplicate owner or nonpositive allowance');
    seen.add(owner);
    return {...h, owner, leaf: snapshotLeaf(campaignId, mint, owner, h.amountRaw)};
  }).sort((a, b) => Buffer.compare(a.leaf, b.leaf));
  const levels = [entries.map(x => x.leaf)];
  while (levels.at(-1).length > 1) {
    const previous = levels.at(-1), next = [];
    for (let i = 0; i < previous.length; i += 2) next.push(pair(previous[i], previous[i + 1] ?? previous[i]));
    levels.push(next);
  }
  return {root: hex(levels.at(-1)[0]), holders: entries.map((e, index) => {
    const proof = []; let i = index;
    for (let level = 0; level < levels.length - 1; level++) {
      const row = levels[level]; proof.push(hex(row[i ^ 1] ?? row[i])); i >>= 1;
    }
    return {owner: e.owner, amountRaw: BigInt(e.amountRaw).toString(), leaf: hex(e.leaf), proof};
  })};
}
export function addresses(program, admin, campaignId, owner) {
  const p = pk(program);
  const campaign = PublicKey.findProgramAddressSync([Buffer.from('campaign'), keyBytes(admin), bytes(campaignId, 32)], p)[0];
  const vault = PublicKey.findProgramAddressSync([Buffer.from('vault'), campaign.toBuffer()], p)[0];
  const claim = owner ? PublicKey.findProgramAddressSync([Buffer.from('claim'), campaign.toBuffer(), keyBytes(owner)], p)[0] : undefined;
  return {campaign, vault, claim};
}
const meta = (pubkey, isWritable = false, isSigner = false) => ({pubkey: pk(pubkey), isWritable, isSigner});
const ix = (programId, keys, data) => new TransactionInstruction({programId: pk(programId), keys, data: Buffer.concat(data)});
export const NO_EXCEPTION_OWNER = '11111111111111111111111111111111';
export function exceptionTerms(c) {
  return { exceptionOwner:c.exceptionOwner??NO_EXCEPTION_OWNER, exceptionAllowanceRaw:c.exceptionAllowanceRaw??'0', exceptionGrantRaw:c.exceptionGrantRaw??'0', exceptionOpensAt:c.exceptionOpensAt??'0' };
}
export const isException = (c,owner) => exceptionTerms(c).exceptionOwner!==NO_EXCEPTION_OWNER && owner===c.exceptionOwner;
export const openingFor = (c,owner) => isException(c,owner)?c.exceptionOpensAt:c.opensAt;
export function reviewedHolder(review,owner) {
  return isException(review.config,owner)?{owner,amountRaw:review.config.exceptionAllowanceRaw,proof:[],basis:'supplemental_exception'}:review.tree.holders.find(h=>h.owner===owner);
}
export function validateAllocationConfig(c) {
  integer(c.totalEligibleOldRaw, 8); integer(c.fundingBudgetRaw, 16);
  integer(c.minimumCurrentHoldingRaw ?? '0', 8);
  if (BigInt(c.totalEligibleOldRaw) === 0n || BigInt(c.fundingBudgetRaw) === 0n || typeof c.allowPartialSurrender !== 'boolean') throw Error('Explicit positive allocation terms and partial-surrender policy required');
  const e=exceptionTerms(c);
  pk(e.exceptionOwner); integer(e.exceptionAllowanceRaw,8);integer(e.exceptionGrantRaw,16);integer(e.exceptionOpensAt,8);
  if(e.exceptionOwner===NO_EXCEPTION_OWNER) {
    if([e.exceptionAllowanceRaw,e.exceptionGrantRaw,e.exceptionOpensAt].some(v=>v!=='0'))throw Error('Incomplete supplemental exception');
  } else if(!PublicKey.isOnCurve(pk(e.exceptionOwner).toBytes()) || BigInt(e.exceptionAllowanceRaw)<=0n || BigInt(e.exceptionAllowanceRaw)<BigInt(c.minimumCurrentHoldingRaw??'0') || BigInt(e.exceptionGrantRaw)<=0n || BigInt(e.exceptionGrantRaw)>BigInt(e.exceptionAllowanceRaw)*700000000n || BigInt(e.exceptionOpensAt)>BigInt(c.opensAt))throw Error('Invalid supplemental exception');
  if ('minimums' in c || 'grants' in c) throw Error('Legacy tier configuration is incompatible');
}
export function grantForDeposit(c, amount, snapshotAmount, owner) {
  validateAllocationConfig(c); integer(amount,8); integer(snapshotAmount,8);
  const a=BigInt(amount), cap=BigInt(snapshotAmount), extra=isException(c,owner);
  if(exceptionTerms(c).exceptionOwner!==NO_EXCEPTION_OWNER && !owner)throw Error('Owner required for supplemental allocation');
  if(extra && snapshotAmount!==c.exceptionAllowanceRaw)throw Error('Supplemental allowance mismatch');
  if(cap<BigInt(c.minimumCurrentHoldingRaw??'0'))throw Error('Snapshot holding is below the minimum');
  if(a<=0n || a>cap || (!extra && cap>BigInt(c.totalEligibleOldRaw)))throw Error('Deposit exceeds snapshot cap or eligible total');
  if(!c.allowPartialSurrender && a!==cap)throw Error('Full snapshot allowance must be surrendered');
  const grant=proportionalQuote(a,BigInt(extra?c.exceptionAllowanceRaw:c.totalEligibleOldRaw),BigInt(extra?c.exceptionGrantRaw:c.fundingBudgetRaw));
  if(grant===0n)throw Error('Deposit would produce zero allocation');
  return grant.toString();
}
export function initializeInstruction(c) {
  validateAllocationConfig(c);
  const extra=exceptionTerms(c);
  const {campaign, vault} = addresses(c.program, c.admin, c.campaignId);
  return ix(c.program, [meta(c.admin, true, true), meta(campaign, true), meta(vault, true), meta(c.mint), meta(TOKEN_PROGRAM_ID), meta(SystemProgram.programId)], [
    Buffer.from([0]), bytes(c.campaignId, 32), keyBytes(c.collection), bytes(c.root, 32),
    integer(c.destinationChain, 8), bytes(c.distributor, 20), integer(c.opensAt, 8), integer(c.closesAt, 8), integer(c.claimGrace, 8),
    integer(c.totalEligibleOldRaw,8), integer(c.fundingBudgetRaw,16), Buffer.from([Number(c.allowPartialSurrender)]), integer(c.minimumCurrentHoldingRaw ?? '0',8), keyBytes(extra.exceptionOwner), integer(extra.exceptionAllowanceRaw,8), integer(extra.exceptionGrantRaw,16), integer(extra.exceptionOpensAt,8),
  ]);
}
export function pauseInstruction(c, paused) {
  if (typeof paused !== 'boolean') throw Error('Boolean pause required');
  return ix(c.program, [meta(addresses(c.program, c.admin, c.campaignId).campaign, true), meta(c.admin, false, true)], [Buffer.from([1, Number(paused)])]);
}
export function depositInstruction(c, q) {
  const {campaign, vault, claim} = addresses(c.program, c.admin, c.campaignId, q.owner);
  if (isException(c,q.owner) ? q.proof.length!==0 || q.snapshotAmount!==c.exceptionAllowanceRaw : q.proof.length > 32 || !verifyProof(snapshotLeaf(c.campaignId, c.mint, q.owner, q.snapshotAmount), q.proof, c.root)) throw Error('Invalid snapshot proof or supplemental allowance');
  grantForDeposit(c,q.amount,q.snapshotAmount,q.owner);
  return ix(c.program, [meta(q.owner, true, true), meta(campaign), meta(claim, true), meta(q.sourceTokenAccount, true), meta(vault, true), meta(c.mint), meta(TOKEN_PROGRAM_ID), meta(SystemProgram.programId), meta(c.admin, false, true)], [
    Buffer.from([2]), integer(q.snapshotAmount, 8), integer(q.amount, 8), bytes(q.recipient, 20), integer(q.depositDeadline, 8), integer(BigInt(q.proof.length), 4), ...q.proof.map(p => bytes(p, 32)),
  ]);
}
export function settleInstruction(c, owner, destinationTokenAccount, paid, evidence) {
  if (typeof paid !== 'boolean' || bytes(evidence, 32).equals(Buffer.alloc(32))) throw Error('Explicit settlement outcome and evidence required');
  const {campaign, vault, claim} = addresses(c.program, c.admin, c.campaignId, owner);
  return ix(c.program, [meta(campaign), meta(claim, true), meta(vault, true), meta(destinationTokenAccount, true), meta(c.mint), meta(TOKEN_PROGRAM_ID), meta(c.admin, false, true)], [Buffer.from([3, Number(paid)]), bytes(evidence, 32)]);
}
// Accept only token accounts independently read as spendable for this owner/mint.
// Consolidate only the shortfall, then deposit atomically in the SAME transaction.
export function depositFromAccounts(c, q, spendableAccounts) {
  const seen=new Set();
  for(const a of spendableAccounts){
    const address=pk(a.address).toBase58();
    if(seen.has(address)||pk(a.owner).toBase58()!==pk(q.owner).toBase58()||pk(a.mint).toBase58()!==pk(c.mint).toBase58()||a.frozen!==false)throw Error('Wrong or duplicate spendable account');
    integer(a.amountRaw,8);seen.add(address);
  }
  const primary=spendableAccounts.find(a=>pk(a.address).equals(pk(q.sourceTokenAccount)));
  if(!primary)throw Error('Primary source account not verified');
  const required=BigInt(q.amount)>BigInt(c.minimumCurrentHoldingRaw??'0')?BigInt(q.amount):BigInt(c.minimumCurrentHoldingRaw??'0');
  let shortfall=required-BigInt(primary.amountRaw);
  const instructions=[];
  for(const a of spendableAccounts){
    if(shortfall<=0n)break;
    if(a===primary)continue;
    const take=BigInt(a.amountRaw)<shortfall?BigInt(a.amountRaw):shortfall;
    if(take>0n)instructions.push(createTransferCheckedInstruction(pk(a.address),pk(c.mint),pk(primary.address),pk(q.owner),take,9));
    shortfall-=take;
  }
  if(shortfall>0n)throw Error('Insufficient current spendable balance');
  instructions.push(depositInstruction(c,q));
  return instructions;
}
export function settlementInstructions(c, owner, paid, evidence, feePayer) {
  const recipient=paid?pk(c.collection):pk(owner),mint=pk(c.mint);
  const destination=getAssociatedTokenAddressSync(mint,recipient,true);
  return [createAssociatedTokenAccountIdempotentInstruction(pk(feePayer),destination,recipient,mint),settleInstruction(c,owner,destination,paid,evidence)];
}
export function serializeInstruction(instruction) {
  return {programId: instruction.programId.toBase58(), accounts: instruction.keys.map(k => ({...k, pubkey: k.pubkey.toBase58()})), dataBase64: instruction.data.toString('base64')};
}
export function unsignedTransaction(instructions, feePayer, recentBlockhash) {
  if(!instructions.length)throw Error('At least one instruction required');
  const legacy=new Transaction({feePayer:pk(feePayer),recentBlockhash}).add(...instructions);
  const transaction=new VersionedTransaction(legacy.compileMessage());
  if(transaction.serialize().length>1232)throw Error('Transaction exceeds Solana packet size; consolidate source accounts separately before requesting a deposit quote');
  return transaction;
}

// Borsh account decoding is strict: no trailing bytes, no unsafe JS numbers.
function reader(data) {
  const b = Buffer.from(data); let i = 0;
  const take = n => { if (i + n > b.length) throw Error('Truncated account'); const part = b.subarray(i, i += n); return part; };
  return {take, key: () => pk(take(32)).toBase58(), num: n => {
    const part = take(n); let value = 0n; for (let j = n - 1; j >= 0; j--) value = (value << 8n) + BigInt(part[j]); return value.toString();
  }, done: () => { if (i !== b.length) throw Error('Unexpected account length'); }};
}
export function decodeClaim(data) {
  const r = reader(data);
  if (r.take(1)[0] !== 2) throw Error('Wrong account tag');
  const value = {campaign: r.key(), owner: r.key(), recipient: hex(r.take(20)), snapshotAmount: r.num(8), amount: r.num(8), grant: r.num(16), depositDeadline: r.num(8), claimDeadline: r.num(8), status: r.take(1)[0], settlementEvidence: hex(r.take(32))};
  r.done(); if (![1,2,3].includes(value.status)) throw Error('Invalid claim state'); return value;
}
export function decodeCampaign(data) {
  const r = reader(data);
  if (r.take(1)[0] !== 1) throw Error('Wrong account tag');
  const value = {campaignId: hex(r.take(32)), admin: r.key(), collection: r.key(), mint: r.key(), root: hex(r.take(32)), destinationChain: r.num(8), distributor: hex(r.take(20)), opensAt: r.num(8), closesAt: r.num(8), claimGrace: r.num(8), totalEligibleOldRaw: r.num(8), fundingBudgetRaw: r.num(16), allowPartialSurrender: r.take(1)[0], minimumCurrentHoldingRaw: r.num(8), exceptionOwner:r.key(), exceptionAllowanceRaw:r.num(8), exceptionGrantRaw:r.num(16), exceptionOpensAt:r.num(8), paused: r.take(1)[0], bump: r.take(1)[0], vaultBump: r.take(1)[0]};
  r.done(); if (value.paused > 1 || value.allowPartialSurrender > 1) throw Error('Invalid boolean flag'); value.paused = Boolean(value.paused); value.allowPartialSurrender=Boolean(value.allowPartialSurrender); validateAllocationConfig(value); return value;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {bands,tierFor} from './tier-model.mjs';
test('every boundary assigns exactly one fixed grant, including sub-token dust',()=>{
 assert.equal(tierFor(0n),null);assert.equal(tierFor(1n).grantTokens,60n);
 bands.forEach((b,i)=>{assert.equal(tierFor(b.minimumRaw),b);if(i)assert.equal(tierFor(b.minimumRaw-1n),bands[i-1]);
 if(b.maximumExclusiveRaw)assert.equal(tierFor(b.maximumExclusiveRaw-1n).grantTokens,b.grantTokens)});
 assert.equal(tierFor(999_999_999n*10n**9n).grantTokens,150000n);
});
test('exact raw units required and within-tier grants are not proportional',()=>{
 assert.throws(()=>tierFor(1000));assert.throws(()=>tierFor(-1n));
 assert.equal(tierFor(1000000n*10n**9n).grantTokens,tierFor(9000000n*10n**9n).grantTokens);
});

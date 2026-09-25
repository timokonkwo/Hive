import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {bootstrapOperator} from './bootstrap.mjs';
import {operatorReady,writeOperatorHealth} from '../operator-health.mjs';

test('operator readiness requires a successful recent heartbeat',()=>{
 const path=join(mkdtempSync(join(tmpdir(),'hive-health-')),'health.json');
 assert.equal(operatorReady(path,100),false);
 writeOperatorHealth(path,true,100);
 assert.equal(operatorReady(path,100),true);assert.equal(operatorReady(path,60099),true);
 assert.equal(operatorReady(path,60100),false);assert.equal(operatorReady(path,99),false);
 writeOperatorHealth(path,false,200);assert.equal(operatorReady(path,200),false);
});
test('history imports once and never rolls back new public claims on restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hive-import-'));
 const seed={campaignId:'campaign',files:{'verifier/transactions.jsonl':'original\n'}};
 bootstrapOperator(dir,seed,'campaign');
 const path=join(dir,'verifier/transactions.jsonl');
 assert.equal(readFileSync(path,'utf8'),'original\n');writeFileSync(path,'original\nnew\n');
 bootstrapOperator(dir,seed,'campaign');assert.equal(readFileSync(path,'utf8'),'original\nnew\n');
 assert.throws(()=>bootstrapOperator(dir,{...seed,files:{'verifier/transactions.jsonl':'old\n'}},'campaign'),/changed/);
});
test('history rejects traversal, wrong campaigns, and conflicting existing journals',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hive-import-'));
 assert.throws(()=>bootstrapOperator(dir,{campaignId:'other',files:{}},'campaign'),/Invalid/);
 assert.throws(()=>bootstrapOperator(dir,{campaignId:'campaign',files:{'../secret':'bad'}},'campaign'),/Invalid/);
 const seed={campaignId:'campaign',files:{'verifier/transactions.jsonl':'original\n'}};
 bootstrapOperator(dir,seed,'campaign');
 const fresh=mkdtempSync(join(tmpdir(),'hive-import-'));
 writeFileSync(join(fresh,'dummy'),'unused');
 bootstrapOperator(fresh,{campaignId:'campaign',files:{}},'campaign');
 assert.throws(()=>bootstrapOperator(fresh,seed,'campaign'),/changed/);
});

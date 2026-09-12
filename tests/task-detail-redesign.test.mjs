import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = path => ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const modelUri = uri(compile('../components/redesign/task/model.ts'));
const m = await import(modelUri);
const p = await import(uri(compile('../components/redesign/task/payment.ts').replace("'./model'",JSON.stringify(modelUri))));
const id='0123456789abcdef01234567', aid='1123456789abcdef01234567';
const task = m.readTask({id,title:'Review work',status:'Open',budget:'$25 USDC',budgetAmount:25,access:{isOwner:true},assignedAgentId:aid,assignedAgentName:'Sage'});
test('task access comes only from explicit server result and payment amounts preserve absence',()=>{
 assert.equal(m.readTask({...task,access:undefined,clientAddress:'me'}).isOwner,false);
 assert.equal(m.readTask({id,title:'Task',status:'In Review'}).budgetAmount,null);
 assert.equal(m.readTask({id,title:'Task',status:'In Review',budgetAmount:0}).budgetAmount,0);
 assert.throws(()=>m.readTask({id:'../task',title:'Task',status:'Open'}));
});
test('role and state matrix does not enable owner actions on closed tasks or pretend a wallet is an agent',()=>{
 assert.equal(m.actions(task,'',[]).manageProposals,true);
 for(const status of ['In Progress','In Review','Completed','Cancelled','Unknown'])assert.equal(m.actions({...task,status},'',[]).manageProposals,false);
 assert.equal(m.actions({...task,isOwner:false},'',[]).propose,false);
 assert.equal(m.actions({...task,isOwner:false},aid,[]).propose,true);
 assert.equal(m.actions({...task,isOwner:false,direct:true,requestedAgentId:id},aid,[]).propose,false);
 assert.equal(m.actions({...task,isOwner:false,status:'In Progress'},aid,[{agentId:aid,status:'accepted'}]).submit,true);
 assert.equal(m.actions({...task,isOwner:false,status:'Completed'},aid,[{agentId:aid,status:'accepted'}]).submit,false);
 assert.equal(m.actions({...task,status:'In Review'},'',[]).reviewWork,true);
 assert.equal(m.actions({...task,status:'Completed',hasReview:true},'',[]).rate,false);
});
test('proposal prices retain supplied currency instead of becoming task budgets',()=>{
 const bids=m.readBids({bids:[{id,agentId:aid,amount:'12 USDC',status:'Pending'},{id:aid,amount:12}]});
 assert.equal(bids[0].amount,'12 USDC');assert.equal(bids[1].amount,'12 (currency not listed)');
 assert.equal(m.price(null),'Not listed');assert.equal(m.price(0),'0 (currency not listed)');
});
test('unsafe links, malformed history and invalid payment references stay noninteractive',()=>{
 for(const value of ['javascript:alert(1)','data:text/html,test','https://user:pass@example.com','//example.com'])assert.equal(m.safeLink(value),null);
 assert.equal(m.safeLink('https://example.com/output'),'https://example.com/output');
 assert.equal(m.signature('../wallet'),false);assert.throws(()=>m.readEvents({events:[{id:'bad'}]}));
 assert.equal(m.readTab('unknown'),'brief');assert.equal(m.readTab('work'),'work');
});
test('submission versions preserve written work and reject unsafe report links',()=>{
 const [s]=m.readSubmissions({submissions:[{id,summary:'Actual work',status:'Rejected',rejectionReason:'Cite the sources',reportUri:'javascript:alert(1)',deliverables:[{type:'code',content:'const x = 1;',label:'Code'}]}]});
 assert.equal(s.report,null);assert.equal(s.reason,'Cite the sources');assert.equal(s.outputs[0].content,'const x = 1;');
});
test('payment preview binds exact currency, chain, sender and amount',()=>{
 const from='1'.repeat(32),to='2'.repeat(32);const input={transaction:'unsigned',paymentDetails:{chain:'solana',token:'USDC',amount:25,fromAddress:from,toAddress:to,toName:'Sage'}};
 assert.equal(p.readPayment(input,25,from).to,to);
 for(const change of [{chain:'ethereum'},{amount:26},{fromAddress:to},{token:'USDT'},{toAddress:'invalid'}])assert.throws(()=>p.readPayment({...input,paymentDetails:{...input.paymentDetails,...change}},25,from));
});
test('base58 preserves signature bytes and leading zeros',()=>{
 assert.equal(p.base58(new Uint8Array([0,0,1])),'112');assert.equal(p.base58(new Uint8Array([255])),'5Q');
});
test('verification retry never builds or broadcasts another transfer',async()=>{
 const calls=[];const sig='3'.repeat(88);
 await p.finishPayment(async(url,init)=>{calls.push([url,JSON.parse(init.body)]);return Response.json({success:true});},id,'owner',sig,5,'Good work');
 assert.equal(calls.length,1);assert.equal(calls[0][0],`/api/tasks/${id}/complete`);assert.equal(calls[0][1].txSignature,sig);
 await assert.rejects(()=>p.finishPayment(async()=>{throw Error('network');},id,'owner',sig,0,''));
});

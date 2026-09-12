import fs from 'node:fs';
import ts from 'typescript';
const compile = file => ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const dataUrl = text => 'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const apiSource=compile('components/redesign/docs/api-reference.ts');
const source=compile('components/redesign/docs/content.ts').replace("'./api-reference'",JSON.stringify(dataUrl(apiSource)));
const {topics,resolveTopic,searchTopics,sectionHash}=await import(dataUrl(source));
const {apiReference}=await import(dataUrl(apiSource));
const failures=[];let count=0;
const check=(name,ok)=>{count++;if(!ok)failures.push(name);};
const ids=['intro','how-it-works','platform-roles','getting-started','create-task','reviewing-proposals','task-lifecycle','categories','dashboard-client','register-agent','finding-work','delivering-work','reputation','dashboard-agent','agent-sdk','openclaw-skill','mcp-server','rest-api','x402-api','hive-staking','hive-points','changelog','faq'];
for(const id of ids)check('Existing topic '+id,resolveTopic('#'+id)?.topic.id===id);
const all=new Set();
for(const t of topics){for(const s of t.sections){const hash=sectionHash(t,s);check('Unique section '+hash,!all.has(hash)&&resolveTopic(hash)?.topic.id===t.id);all.add(hash);for(const b of s.blocks){if(b.kind==='links')for(const l of b.items){if(l.href.startsWith('#'))check('Internal link '+l.href,!!resolveTopic(l.href));else if(l.href.startsWith('/'))check('Page link '+l.href,fs.existsSync('app'+l.href+'/page.tsx')||fs.existsSync('app'+l.href+'/route.ts'));}if(b.kind==='api')check('Nonempty API reference '+s.id,apiReference.some(e=>b.paths.some(p=>e.path.startsWith(p))));}}}
for(const e of apiReference){const file='app'+e.path.replace(/:([a-zA-Z]+)/g,'[$1]')+'/route.ts';check('API path '+e.path,fs.existsSync(file));if(fs.existsSync(file)){const code=fs.readFileSync(file,'utf8');for(const method of e.method.split('/'))check(method+' '+e.path,new RegExp('export (?:async )?function '+method+'\\b|export \\{[^}]*\\b'+method+'\\b').test(code));}}
check('Search indexes body text',searchTopics('recovery code').some(t=>t.id==='dashboard-agent'));
check('Search indexes endpoint names',searchTopics('/api/webhooks').some(t=>t.id==='rest-api'));
check('Unmatched query is empty',searchTopics('xyzzzzneverexists').length===0);
check('Malformed hash safe',resolveTopic('#%ZZ')===null&&resolveTopic('#unknown')===null);
console.log(JSON.stringify({passed:count-failures.length,total:count,failures},null,2));process.exitCode=failures.length?1:0;

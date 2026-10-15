import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync(new URL('../components/redesign/dashboard/DashboardPage.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function render(authenticated,status){
 const imports={
  react:{...React,useState:v=>[v,()=>{}],useRef:()=>({current:null}),useEffect:()=>{}},
  'next/navigation':{useRouter:()=>({push(){}}),useSearchParams:()=>new URLSearchParams()},
  'next/link':{default:({children,...props})=>React.createElement('a',props,children)},
  '@/hooks/useAuth':{useAuth:()=>({ready:true,authenticated,user:authenticated?{id:'verified-account'}:null,login(){},logout(){}})},
  '@/hooks/useAuthFetch':{useAuthFetch:()=>()=>{}},
  '../AppShell':{AppShell:({children})=>children},
  '../task/useResource':{useResource:()=>({state:'error',status,message:'Could not load.'})},
  './model':{readQuery:()=>({view:'tasks',q:'',page:1,filter:'all',sort:'newest'}),selectRows:()=>[],filters:[]},
 };
 const m={exports:{}};
 new Function('require','module','exports',code)(name=>imports[name]|| (name.endsWith('.css')?{default:{}}:name.startsWith('.')||name.startsWith('@/')?{}:require(name)),m,m.exports);
 return renderToStaticMarkup(m.exports.DashboardPage());
}
test('authenticated 401 shows session recovery with explicit reauthentication',()=>{const html=render(true,401);assert.match(html,/Sign in to continue./);assert.doesNotMatch(html,/>Try again</);assert.match(html,/Sign in again/);assert.doesNotMatch(html,/dashboard-sign-in-title/);});
test('signed-out 401 shows the sign-in gate',()=>{const html=render(false,401);assert.match(html,/Sign in to view your tasks/);assert.doesNotMatch(html,/Sign in to continue./);});
test('server failure is not mislabeled as a lost sign-in',()=>{const html=render(true,500);assert.match(html,/Couldn’t load your tasks/);assert.doesNotMatch(html,/dashboard-sign-in-title|Sign in to continue./);});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync(new URL('../components/redesign/AccountControl.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function render(overrides){let logins=0,connections=0,logouts=0;const auth={ready:true,authenticated:false,user:null,login(){logins++},connectWallet(){connections++},async logout(){logouts++},...overrides};const m={exports:{}};new Function('require','module','exports',code)(name=>name==='react'?{...React,useEffect(){},useRef:()=>({current:null}),useState:v=>[v,()=>{}]}:name==='@privy-io/react-auth'?{usePrivy:()=>auth,useWallets:()=>({wallets:overrides.evmWallets||[]})}:name==='@privy-io/react-auth/solana'?{useWallets:()=>({wallets:overrides.solanaWallets||[]})}:name==='next/link'?{default:({children,prefetch,...p})=>React.createElement('a',p,children)}:name.endsWith('.css')?{default:{}}:require(name),m,m.exports);const tree=m.exports.AccountControl();return {tree,html:renderToStaticMarkup(tree),counts:()=>({logins,connections,logouts})};}
function find(node,match){if(!node||typeof node!=='object')return null;if(match(node))return node;return React.Children.toArray(node.props?.children).map(child=>find(child,match)).find(Boolean)||null;}
test('sign in is visible and only opens after a click',()=>{const r=render({});assert.match(r.html,/Sign in/);assert.equal(r.counts().logins,0);r.tree.props.onClick();assert.equal(r.counts().logins,1);});
test('initializing auth cannot open a second login',()=>{const r=render({ready:false});assert.equal(r.tree.props.disabled,true);assert.match(r.html,/Loading/);});
test('signed-in account exposes settings, wallet connection and explicit sign out',async()=>{const r=render({authenticated:true,user:{email:{address:'owner@example.test'}}});assert.match(r.html,/Account settings/);assert.match(r.html,/Connect wallet/);assert.match(r.html,/Sign out/);assert.match(r.html,/owner@example.test/);assert.doesNotMatch(r.html,/>Sign in</);find(r.tree,n=>n.type==='button'&&React.Children.toArray(n.props.children).includes('Connect wallet')).props.onClick();assert.equal(r.counts().connections,1);assert.equal(r.counts().logouts,0);await find(r.tree,n=>n.type==='button'&&React.Children.toArray(n.props.children).includes('Sign out')).props.onClick();assert.equal(r.counts().logouts,1);});

test('connected EVM wallet shows its address and Change wallet',()=>{const r=render({authenticated:true,user:{id:'owner'},evmWallets:[{address:'0x1234567890123456789012345678901234567890'}]});assert.match(r.html,/Change wallet/);assert.match(r.html,/Connected/);assert.doesNotMatch(r.html,/>Connect wallet</);});
test('connected Solana wallet is recognized without an EVM connection',()=>{const r=render({authenticated:true,user:{id:'owner'},solanaWallets:[{address:'So11111111111111111111111111111111111111112'}]});assert.match(r.html,/Change wallet/);assert.match(r.html,/So1111/);});
test('a linked but disconnected wallet still offers Connect wallet',()=>{const r=render({authenticated:true,user:{wallet:{address:'0x1234567890123456789012345678901234567890'}}});assert.match(r.html,/Connect wallet/);assert.doesNotMatch(r.html,/>Connected</);});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as jose from 'jose';
const require=createRequire(import.meta.url);
function load(path,imports={}){const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(n=>imports[n]||require(n),m,m.exports);return m.exports;}
const {verifyAdminWallet}=load('../lib/admin-wallet-auth.ts');
const pair=await jose.generateKeyPair('ES256'),other=await jose.generateKeyPair('ES256');
const jwk=await jose.exportJWK(pair.publicKey);jwk.kid='test-key';
const keys=jose.createLocalJWKSet({keys:[jwk]});
const address='0x1234567890abcdef1234567890abcdef12345678';
const userId='did:privy:admin-test';
async function identity({sub=userId,aud='test-app',expired=false,signer=pair.privateKey,linked=[{type:'wallet',chain_type:'ethereum',address}]}={}){return new jose.SignJWT({linked_accounts:JSON.stringify(linked)}).setProtectedHeader({alg:'ES256',kid:'test-key'}).setSubject(sub).setIssuer('privy.io').setAudience(aud).setIssuedAt().setExpirationTime(expired?1:'5m').sign(signer);}
test('signed linked EVM admin wallet matches case-insensitively',async()=>{assert.equal(await verifyAdminWallet(await identity(),userId,address.toUpperCase().replace('0X','0x'),'test-app',keys),true)});
test('signed wallet proof cannot cross accounts, apps, expiry or signatures',async()=>{for(const args of [{sub:'did:privy:other'},{aud:'other-app'},{expired:true},{signer:other.privateKey},{linked:[{type:'wallet',chain_type:'ethereum',address:'0x0000000000000000000000000000000000000000'}]}])assert.equal(await verifyAdminWallet(await identity(args),userId,address,'test-app',keys),false)});
test('Solana admin addresses remain case-sensitive',async()=>{const a='So11111111111111111111111111111111111111112';const token=await identity({linked:[{type:'wallet',chain_type:'solana',address:a}]});assert.equal(await verifyAdminWallet(token,userId,a,'test-app',keys),true);assert.equal(await verifyAdminWallet(token,userId,a.toLowerCase(),'test-app',keys),false)});
test('unsigned, missing or mismatched account types cannot grant admin',async()=>{assert.equal(await verifyAdminWallet('forged',userId,address,'test-app',keys),false);assert.equal(await verifyAdminWallet('',userId,address,'test-app',keys),false);assert.equal(await verifyAdminWallet(await identity({linked:[{type:'email',address}]}),userId,address,'test-app',keys),false)});
function request(headers={}){return {headers:new Headers(headers),cookies:{get:()=>null},url:'https://local/api/admin/verify?address='+address};}
test('DID authorization, signed-out and forged legacy wallet claims',async()=>{
 const saved={...process.env};
 try{
  delete process.env.ADMIN_API_KEY;process.env.ADMIN_PRIVY_DID='admin-test';process.env.ADMIN_ADDRESS=address;process.env.ENABLE_LEGACY_ADMIN_ADDRESS_AUTH='true';
  let client={userId};
  const {verifyAdmin}=load('../lib/admin-auth.ts',{'next/server':{NextResponse:{json:(d,o)=>Response.json(d,o)}},'./client-auth':{authenticateClient:async()=>client},'./admin-wallet-auth':{verifyAdminWallet:async()=>false}});
  assert.equal((await verifyAdmin(request())).error,undefined);
  client={userId:'did:privy:ordinary'};assert.equal((await verifyAdmin(request({'x-admin-address':address}))).error.status,403);
  client=null;assert.equal((await verifyAdmin(request())).error.status,401);
  process.env.ADMIN_API_KEY='test-server-key';assert.equal((await verifyAdmin(request({'x-admin-key':'test-server-key'}))).error,undefined);
 }finally{for(const k of ['ADMIN_API_KEY','ADMIN_PRIVY_DID','ADMIN_ADDRESS','ENABLE_LEGACY_ADMIN_ADDRESS_AUTH']){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
test('role endpoint preserves denial status and forbids caching',async()=>{for(const status of [200,401,403]){const {GET}=load('../app/api/admin/verify/route.ts',{'next/server':{NextResponse:{json:(d,o)=>Response.json(d,o)}},'@/lib/admin-auth':{verifyAdmin:async()=>status===200?{}:{error:new Response(null,{status})}}});const r=await GET(request());assert.equal(r.status,status);assert.equal((await r.json()).isAdmin,status===200);assert.match(r.headers.get('Cache-Control'),/no-store/);}});
test('access token verifier validates signature, issuer, audience, expiry and session claims',async()=>{
 const saved=process.env.NEXT_PUBLIC_PRIVY_APP_ID;process.env.NEXT_PUBLIC_PRIVY_APP_ID='test-app';
 try{
 const {authenticateClient}=load('../lib/client-auth.ts',{'jose':{...jose,createRemoteJWKSet:()=>keys},'@/lib/logger':{logger:{error(){}}}});
 const token=async(overrides={})=>new jose.SignJWT({sid:'fixture-session',...overrides}).setProtectedHeader({alg:'ES256',kid:'test-key'}).setSubject(userId).setIssuer('privy.io').setAudience('test-app').setIssuedAt().setExpirationTime('5m').sign(pair.privateKey);
 const valid=await token();const r=request({authorization:'Bearer '+valid});const verified=await authenticateClient(r);assert.equal(verified.userId,userId);assert.equal(verified.sessionId,'fixture-session');
 assert.equal(await authenticateClient(request()),null);
 assert.equal(await authenticateClient(request({authorization:'Bearer forged'})),null);
 const missingSession=await token({sid:undefined});assert.equal(await authenticateClient(request({authorization:'Bearer '+missingSession})),null);
 const idToken=await identity();assert.equal(await authenticateClient(request({authorization:'Bearer '+idToken})),null);
 const cookieReq=request();cookieReq.cookies.get=name=>name==='privy-token'?{value:valid}:undefined;assert.equal((await authenticateClient(cookieReq)).userId,userId);
 const wrong=new jose.SignJWT({sid:'fixture-session'}).setProtectedHeader({alg:'ES256',kid:'test-key'}).setSubject(userId).setIssuer('other').setAudience('test-app').setIssuedAt().setExpirationTime('5m');assert.equal(await authenticateClient(request({authorization:'Bearer '+await wrong.sign(pair.privateKey)})),null);
 }finally{if(saved===undefined)delete process.env.NEXT_PUBLIC_PRIVY_APP_ID;else process.env.NEXT_PUBLIC_PRIVY_APP_ID=saved;}
});

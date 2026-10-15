import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MongoClient,ObjectId} from 'mongodb';
import {metadata,avatar,profileEdit,profileLease,authorization} from '../scripts/tokenization/modules.mjs';
import {loadTypeScript} from './helpers/load-typescript.mjs';
import {agent,agentId} from './helpers/tokenization-fixture.mjs';
const fields=loadTypeScript(new URL('../lib/agent-tokenization/profile-fields.ts',import.meta.url));
const imageUrl='https://res.cloudinary.com/test/image/upload/v1/hive-agent-tokens/'+ 'a'.repeat(64)+'.png';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA8sAAAAASUVORK5CYII=';
test('profile fields enforce display and deployed UTF-8 metadata limits',()=>{
 assert.equal(fields.validateAgentDetails(' Agent ',' A useful agent biography. ').name,'Agent');
 for(const [name,bio]of [['','A useful biography'],['x\n','A useful biography'],['😀'.repeat(20),'A useful biography'],['Agent','x'],['Agent','😀'.repeat(500)]])assert.throws(()=>fields.validateAgentDetails(name,bio));
});
test('uploaded images require bounded raster data and freeze into the metadata digest',()=>{
 assert.match(avatar.uploadedImage(image).digest,/^[a-f0-9]{64}$/);
 for(const value of ['https://example.com/image.png','data:image/svg+xml;base64,PHN2Zy8+','data:image/png;base64,SGVsbG8=','data:image/png;base64,'+'A'.repeat(3*1024*1024)])assert.throws(()=>avatar.uploadedImage(value));
 const before=metadata.profilePreview(agentId,agent,'admin'),after=metadata.profilePreview(agentId,{...agent,avatarUrl:imageUrl},'admin');
 assert.equal(after.metadata.imageUrl,imageUrl);assert.notEqual(before.adminProfile.revision,after.adminProfile.revision);
 const signer='0x'+'1'.repeat(40),choices={symbol:'TEST',purchase:'0'};
 assert.notEqual(authorization.launchReview(before,signer,choices).digest,authorization.launchReview(after,signer,choices).digest);
});

test('profile endpoint rejects owners before any save and bounds upload requests',async()=>{
 let calls=0,role='owner';
 const route=loadTypeScript(new URL('../app/api/agents/[address]/tokenization/profile/route.ts',import.meta.url),{
  '@/lib/agent-tokenization/http':{withLaunchAccess:async(_r,_p,fn)=>{try{return await fn({db:{},preview:{role,agentId}});}catch(e){return Response.json({error:e.message},{status:e.status||503});}},readLaunchBody:async(_r,keys,max)=>{assert.deepEqual(keys,['name','bio','image','revision']);assert.equal(max,3*1024*1024);return {};},launchReply:body=>Response.json(body),LaunchHttpError:class extends Error{constructor(status,message){super(message);this.status=status;}}},
  '@/lib/agent-tokenization/profile-edit':{saveAgentProfile:async()=>{calls++;return {};},ProfileEditError:class extends Error{}},
  '@/lib/agent-tokenization/avatar':{persistUploadedAvatar(){},uploadedImage(){}},
  '@/lib/agent-tokenization/store':{LaunchConflict:class extends Error{}},
  '@/lib/agent-tokenization/release':{launchesEnabled:()=>false},
  '@/lib/agent-tokenization/managed-signer':{managedDeployerStatus:()=>({available:false})},
 });
 assert.equal((await route.PATCH({}, {params:Promise.resolve({address:agentId})})).status,403);assert.equal(calls,0);
 role='admin';assert.equal((await route.PATCH({}, {params:Promise.resolve({address:agentId})})).status,200);assert.equal(calls,1);
});
const uri=process.env.HIVE_TOKENIZATION_TEST_MONGO_URI;
if(uri&&!/^mongodb:\/\/127\.0\.0\.1:\d+\/?$/.test(uri))throw Error('Tests require isolated loopback MongoDB');
test('admin profile saves are durable, unique and serialized against launches',{skip:!uri},async t=>{
 const client=new MongoClient(uri);await client.connect();
 const db=client.db('hive_profile_test_'+randomUUID().replaceAll('-',''));t.after(async()=>{await db.dropDatabase();await client.close();});
 const agents=db.collection('agents');await agents.insertOne({...agent,_id:new ObjectId(agentId)});
 const draft=()=>agents.findOne({_id:new ObjectId(agentId)});
 const edit=async patch=>({name:'Updated agent',bio:'An updated agent biography.',revision:metadata.profileRevision(await draft()),...patch});
 let uploaded=0;const persist=async()=>{uploaded++;return imageUrl;};
 const old=await edit({image});const saved=await profileEdit.saveAgentProfile(db,agentId,old,persist);
 assert.equal(saved.metadata.name,'Updated agent');assert.equal(saved.metadata.imageUrl,imageUrl);assert.equal(saved.adminProfile.bio,'An updated agent biography.');assert.equal(uploaded,1);
 assert.equal((await draft()).nameKey,'updated agent');
 await assert.rejects(profileEdit.saveAgentProfile(db,agentId,old,persist),/changed/);assert.equal(uploaded,1);
 await agents.insertOne({name:'Other Agent',nameKey:'other agent'});
 await assert.rejects(profileEdit.saveAgentProfile(db,agentId,await edit({name:'OTHER AGENT'}),persist),/already uses/);
 const update=await edit({name:'Concurrent agent'});
 const both=await Promise.allSettled([profileEdit.saveAgentProfile(db,agentId,update,persist),profileEdit.saveAgentProfile(db,agentId,update,persist)]);
 assert.equal(both.filter(r=>r.status==='fulfilled').length,1);
 let release,started;const waiting=new Promise(r=>release=r),begin=new Promise(r=>started=r);
 const held=profileLease.withAgentProfileLease(db,agentId,async()=>{started();await waiting;});await begin;
 await assert.rejects(profileEdit.saveAgentProfile(db,agentId,await edit({}),persist),/being updated or prepared/);release();await held;
 await db.collection('pons_launch_intents').insertOne({agentId,active:true,phase:'awaiting-signature'});
 await assert.rejects(profileEdit.saveAgentProfile(db,agentId,await edit({image}),persist),/already has a launch/);assert.equal(uploaded,1);
 await db.collection('pons_launch_intents').deleteMany({});
 await agents.updateOne({_id:new ObjectId(agentId)},{$set:{ponsToken:{address:'exists'}}});
 await assert.rejects(profileEdit.saveAgentProfile(db,agentId,await edit({}),persist),/already has a launch/);
});

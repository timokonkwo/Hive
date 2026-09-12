import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { authenticateClient } from '@/lib/client-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { createBagsClient, HIVE_DEFAULT_FEE_SHARING } from '@/lib/bags';
import { validateTokenSymbol } from '@/lib/bags-agent';
import { logger } from '@/lib/logger';
export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(`bags-launch-tool:${getClientIp(req)}`, {windowSeconds:3600,maxRequests:5});
    if (!rl.allowed) return NextResponse.json({error:'Too many launch attempts.'},{status:429,headers:{'Retry-After':String(rl.resetInSeconds)}});
    const db=await getDb();
    const agentAuth=req.headers.has('x-hive-api-key')?await authenticateRequest(req.headers,db):null;
    const client=req.headers.has('x-hive-api-key')?null:await authenticateClient(req);
    if (!agentAuth&&!client) return NextResponse.json({error:'Agent access required.'},{status:401});
    const {agentId,capability,tokenSymbol,tokenImageUrl}=await req.json();
    if (typeof agentId!=='string'||!ObjectId.isValid(agentId)||typeof capability!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{2,63}$/.test(capability)||typeof tokenSymbol!=='string') return NextResponse.json({error:'Choose an agent, registered tool and token symbol.'},{status:400});
    if (agentAuth&&agentAuth.agent.id!==agentId) return NextResponse.json({error:'This key belongs to another agent.'},{status:403});
    const symbol=validateTokenSymbol(tokenSymbol);
    if (!symbol.valid) return NextResponse.json({error:symbol.error},{status:400});
    if (tokenImageUrl) {try {const u=new URL(tokenImageUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{return NextResponse.json({error:'Use an https image URL.'},{status:400});}}
    const agent=agentAuth?.agent||await db.collection(COLLECTIONS.AGENTS).findOne({_id:new ObjectId(agentId),$or:[{id:client!.userId},{walletAddress:client!.userId},{solanaAddress:client!.userId}]});
    if (!agent) return NextResponse.json({error:'You do not own this agent.'},{status:403});
    const tool=(Array.isArray(agent.registeredTools)?agent.registeredTools:[]).find((t:any)=>t.name===capability);
    if (!tool) return NextResponse.json({error:'Register this tool before launching its token.'},{status:400});
    if (agent.toolTokens?.[capability]?.mintAddress||tool.tokenMint) return NextResponse.json({error:'This tool already has a token.'},{status:409});
    const bags=createBagsClient();if(!bags)return NextResponse.json({error:'Token launch is unavailable.'},{status:503});
    const field=`toolLaunches.${capability}`,now=new Date(),collection=db.collection(COLLECTIONS.AGENTS);
    const claimed=await collection.findOneAndUpdate({_id:new ObjectId(agentId),'registeredTools.name':capability,[`toolTokens.${capability}.mintAddress`]:{$exists:false},[`${field}.status`]:{$exists:false}},{$set:{[field]:{status:'launching',symbol:symbol.normalized,startedAt:now},updatedAt:now}},{returnDocument:'after'});
    if(!claimed)return NextResponse.json({error:'A launch already exists. Refresh the token status.'},{status:409});
    let result;
    try {result=await bags.launchToken({metadata:{name:`${agent.name} - ${capability}`,symbol:symbol.normalized!,description:tool.description,image:tokenImageUrl||undefined},feeSharing:HIVE_DEFAULT_FEE_SHARING.filter(c=>c.walletAddress),initialBuyAmountSol:0});}
    catch {await collection.updateOne({_id:new ObjectId(agentId)},{$set:{[`${field}.status`]:'unknown'}});return NextResponse.json({error:'Launch was not confirmed. Check the token status before any further action.'},{status:502});}
    if(!result.success||!result.mintAddress){await collection.updateOne({_id:new ObjectId(agentId)},{$set:{[`${field}.status`]:'unknown'}});return NextResponse.json({error:'Launch was not confirmed. Check the token status.'},{status:502});}
    const token={mintAddress:result.mintAddress,symbol:symbol.normalized,feeVaultAddress:result.meteoraConfigKey||result.mintAddress,transactionId:result.transactionId,launchedAt:new Date()};
    await collection.updateOne({_id:new ObjectId(agentId)},{$set:{[`toolTokens.${capability}`]:token,[`${field}.status`]:'launched',updatedAt:new Date()}});
    await collection.updateOne({_id:new ObjectId(agentId),'registeredTools.name':capability},{$set:{'registeredTools.$.tokenMint':result.mintAddress,'registeredTools.$.tokenSymbol':symbol.normalized,'registeredTools.$.feeVaultAddress':token.feeVaultAddress}});
    try {await db.collection(COLLECTIONS.TOKEN_LAUNCHES).insertOne({agentId,agentName:agent.name,capability,tokenSymbol:symbol.normalized,mintAddress:result.mintAddress,transactionId:result.transactionId,status:'launched',launchType:'tool-token',createdAt:new Date()});}catch{/* Mint is already recorded on the agent. */}
    return NextResponse.json({success:true,agentId,capability,mintAddress:result.mintAddress,transactionId:result.transactionId,bagsUrl:`https://bags.fm/${result.mintAddress}`},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {logger.error('[TOOL-LAUNCH] Error:',error);return NextResponse.json({error:'Launch was not confirmed. Refresh the token status.'},{status:500});}
}

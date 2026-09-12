import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { agentWorkQuery, workQuery } from '@/lib/agent-work';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(req: NextRequest) {
  try {
    const limit = checkRateLimit(`agent-work:${getClientIp(req)}`, RATE_LIMITS.READ);
    if (!limit.allowed) return NextResponse.json({error:'Try again shortly.'},{status:429,headers:{...headers,'Retry-After':String(limit.resetInSeconds)}});
    const db = await getDb(), auth = await authenticateRequest(req.headers, db);
    if (!auth) return NextResponse.json({error:'Agent access required.'},{status:401,headers});
    const {page,q,status} = workQuery(new URL(req.url).searchParams);
    const query = { ...agentWorkQuery(auth.agent), ...(status ? {status} : {}), ...(q ? {title:{$regex:q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'}} : {}) };
    const collection = db.collection('tasks'), total = await collection.countDocuments(query), pages = Math.max(1, Math.ceil(total/20)), current = Math.min(page,pages);
    const tasks = await collection.find(query,{projection:{title:1,status:1,budget:1,bountyAmount:1,category:1,updatedAt:1,createdAt:1}}).sort({updatedAt:-1,_id:-1}).skip((current-1)*20).limit(20).toArray();
    return NextResponse.json({agentId:auth.agent.id,tasks:tasks.map(t=>({id:t._id.toString(),title:t.title,status:t.status,budget:t.budget??t.bountyAmount??null,category:t.category,updatedAt:t.updatedAt||t.createdAt})),page:current,pages,total},{headers});
  } catch { return NextResponse.json({error:'Your work could not be loaded.'},{status:500,headers}); }
}

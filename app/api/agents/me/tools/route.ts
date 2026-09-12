import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { validateOutboundUrl } from '@/lib/ssrf';
import { isValidSolanaAddress } from '@/lib/solana-pay';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const TOOL_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]{2,63}$/;
const MAX_SCHEMA_BYTES = 20 * 1024;

function normalizeToolName(name: string) {
  return name.trim().replace(/\s+/g, '_');
}

function validateSchema(schema: unknown): { ok: true; value: any } | { ok: false; error: string } {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { ok: false, error: 'inputSchema must be a JSON object.' };
  }
  const bytes = Buffer.byteLength(JSON.stringify(schema), 'utf8');
  if (bytes > MAX_SCHEMA_BYTES) {
    return { ok: false, error: 'inputSchema must be 20KB or smaller.' };
  }
  return { ok: true, value: schema };
}

function agentObjectId(agent: any): ObjectId | null {
  const id = agent?._id?.toString?.() || agent?.id;
  return id && ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`agent-tools-get:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required. Provide x-hive-api-key header.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      agentId: auth.agent.id,
      currency: 'USDC',
      paymentChain: 'solana',
      tools: Array.isArray(auth.agent.registeredTools) ? auth.agent.registeredTools : [],
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: any) {
    logger.error('GET /api/agents/me/tools error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load tools.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`agent-tools-post:${ip}`, RATE_LIMITS.MANAGE_BID);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required. Provide x-hive-api-key header.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const name = normalizeToolName(String(body.name || ''));
    const description = String(body.description || '').trim();
    const endpoint = String(body.endpoint || '').trim();
    const costPerCall = Number(body.costPerCall || 0);
    const inputSchema = body.inputSchema;

    if (!TOOL_NAME_REGEX.test(name)) {
      return NextResponse.json(
        { error: 'Tool name must start with a letter and contain 3-64 letters, numbers, underscores, or hyphens.' },
        { status: 400 }
      );
    }

    if (name.toLowerCase().startsWith('hive_')) {
      return NextResponse.json(
        { error: 'Tool names starting with hive_ are reserved for native Hive MCP tools.' },
        { status: 400 }
      );
    }

    if (description.length < 10 || description.length > 500) {
      return NextResponse.json(
        { error: 'description must be between 10 and 500 characters.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(costPerCall) || costPerCall < 0 || costPerCall > 10_000) {
      return NextResponse.json(
        { error: 'costPerCall must be a non-negative number no greater than 10,000.' },
        { status: 400 }
      );
    }

    if (costPerCall > 0 && (!auth.agent.solanaAddress || !isValidSolanaAddress(auth.agent.solanaAddress))) {
      return NextResponse.json(
        { error: 'Set a valid Solana payout wallet on your agent profile before registering a paid tool.' },
        { status: 400 }
      );
    }

    const schema = validateSchema(inputSchema);
    if (!schema.ok) return NextResponse.json({ error: schema.error }, { status: 400 });

    let safeEndpoint: URL;
    try {
      safeEndpoint = await validateOutboundUrl(endpoint, { purpose: 'Tool endpoint' });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Invalid endpoint.' }, { status: 400 });
    }

    const now = new Date();
    const objectId = agentObjectId(auth.agent);
    try {
      await db.collection(COLLECTIONS.AGENTS).createIndex(
        { 'registeredTools.name': 1 },
        {
          unique: true,
          sparse: true,
          background: true,
          name: 'unique_registered_tool_name',
        }
      );
    } catch (indexError: any) {
      logger.warn('Could not ensure registered tool uniqueness index:', indexError?.message || indexError);
    }

    const duplicateQuery: any = { 'registeredTools.name': name };
    if (objectId) duplicateQuery._id = { $ne: objectId };
    else if (auth.agent.apiKeyHash) duplicateQuery.apiKeyHash = { $ne: auth.agent.apiKeyHash };
    const duplicate = await db.collection(COLLECTIONS.AGENTS).findOne(
      duplicateQuery,
      { projection: { _id: 1, name: 1 } }
    );
    if (duplicate) {
      return NextResponse.json(
        { error: 'That MCP tool name is already registered by another provider. Choose a unique name.' },
        { status: 409 }
      );
    }

    const existingTools = Array.isArray(auth.agent.registeredTools) ? auth.agent.registeredTools : [];
    const existingIndex = existingTools.findIndex((tool: any) => tool?.name === name);
    const prior = existingIndex >= 0 ? existingTools[existingIndex] : {};
    const nextTool = {
      ...prior,
      name,
      description,
      endpoint: safeEndpoint.toString(),
      costPerCall,
      inputSchema: schema.value,
      status: 'active',
      updatedAt: now,
      createdAt: prior.createdAt || now,
    };
    const registeredTools = existingIndex >= 0
      ? existingTools.map((tool: any, index: number) => index === existingIndex ? nextTool : tool)
      : [...existingTools, nextTool];

    if (registeredTools.length > 25) {
      return NextResponse.json({ error: 'Agents can register at most 25 tools.' }, { status: 400 });
    }

    const query = { ...(objectId ? { _id: objectId } : { apiKeyHash: auth.agent.apiKeyHash }), registeredTools: auth.agent.registeredTools === undefined ? { $exists: false } : auth.agent.registeredTools };
    try {
      const saved = await db.collection(COLLECTIONS.AGENTS).updateOne(
        query,
        {
          $set: {
            registeredTools,
            updatedAt: now,
          },
          $addToSet: {
            capabilities: name,
          },
        }
      );
      if (saved.matchedCount !== 1) return NextResponse.json({ error: 'Tools changed. Refresh before saving again.' }, { status: 409 });
    } catch (updateError: any) {
      if (updateError?.code === 11000) {
        return NextResponse.json(
          { error: 'That MCP tool name is already registered by another provider. Choose a unique name.' },
          { status: 409 }
        );
      }
      throw updateError;
    }

    try { await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: existingIndex >= 0 ? 'McpToolUpdated' : 'McpToolRegistered',
      actorName: auth.agent.name,
      metadata: {
        agentId: auth.agent.id || auth.agent._id?.toString?.(),
        toolName: name,
        endpoint: safeEndpoint.origin,
        costPerCall,
      },
      createdAt: now,
    }); } catch { /* Keep the completed write visible if activity logging fails. */ }

    return NextResponse.json({ success: true, tool: nextTool });
  } catch (error: any) {
    logger.error('POST /api/agents/me/tools error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save tool.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`agent-tools-delete:${ip}`, RATE_LIMITS.MANAGE_BID);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required. Provide x-hive-api-key header.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const name = normalizeToolName(String(body.name || ''));
    if (!TOOL_NAME_REGEX.test(name)) {
      return NextResponse.json({ error: 'Valid tool name required.' }, { status: 400 });
    }

    const existingTools = Array.isArray(auth.agent.registeredTools) ? auth.agent.registeredTools : [];
    const registeredTools = existingTools.filter((tool: any) => tool?.name !== name);
    if (registeredTools.length === existingTools.length) {
      return NextResponse.json({ error: 'Tool not found.' }, { status: 404 });
    }

    const objectId = agentObjectId(auth.agent);
    const query = { ...(objectId ? { _id: objectId } : { apiKeyHash: auth.agent.apiKeyHash }), registeredTools: auth.agent.registeredTools === undefined ? { $exists: false } : auth.agent.registeredTools };
    const update: any = {
      $set: {
        registeredTools,
        updatedAt: new Date(),
      },
      $pull: {
        capabilities: name,
      },
    };
    const removed = await db.collection(COLLECTIONS.AGENTS).updateOne(query, update);
    if (removed.matchedCount !== 1) return NextResponse.json({ error: 'Tools changed. Refresh before removing again.' }, { status: 409 });

    try { await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'McpToolRemoved',
      actorName: auth.agent.name,
      metadata: {
        agentId: auth.agent.id || auth.agent._id?.toString?.(),
        toolName: name,
      },
      createdAt: new Date(),
    }); } catch { /* The tool is already removed. */ }

    return NextResponse.json({ success: true, name });
  } catch (error: any) {
    logger.error('DELETE /api/agents/me/tools error:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove tool.' }, { status: 500 });
  }
}

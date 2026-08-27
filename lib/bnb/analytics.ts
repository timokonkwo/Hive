import { createHash } from "node:crypto";
import { after } from "next/server";
import { COLLECTIONS, getDb } from "@/lib/db";
import type { BnbAgentProfile, BnbExecutionStatus } from "@/lib/bnb/types";

export type BnbAnalyticsEventName =
  | "discovery.list"
  | "profile.view"
  | "job.validation"
  | "hire.created"
  | "payment.updated"
  | "settlement.updated"
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "delivery.ready"
  | "report.view";

type PublicAgentRef = {
  chainId?: unknown;
  tokenId?: unknown;
  name?: unknown;
  category?: unknown;
  executionStatus?: unknown;
  sourceFreshness?: unknown;
};

export type BnbAnalyticsEventInput = {
  name: BnbAnalyticsEventName;
  route: string;
  clientAddress?: string;
  agent?: PublicAgentRef | Pick<BnbAgentProfile, "chainId" | "tokenId" | "name" | "category" | "executionStatus" | "sourceFreshness">;
  recordId?: string;
  receiptId?: string;
  status?: string;
  ok?: boolean;
  durationMs?: number;
  metadata?: Record<string, unknown>;
};

type BnbAnalyticsEventDocument = {
  name: BnbAnalyticsEventName;
  route: string;
  createdAt: Date;
  clientHash?: string;
  recordId?: string;
  receiptId?: string;
  agentKey?: string;
  chainId?: number;
  tokenId?: string;
  agentName?: string;
  category?: string;
  source?: string;
  executionStatus?: BnbExecutionStatus;
  status?: string;
  ok?: boolean;
  durationMs?: number;
  metadata?: Record<string, unknown>;
};

type NormalizedAnalyticsAgent = {
  chainId?: number;
  tokenId?: string;
  agentKey?: string;
  name?: string;
  category?: string;
  source?: string;
  executionStatus?: BnbExecutionStatus;
};

const MAX_METADATA_KEYS = 40;
const MAX_STRING_LENGTH = 180;
const MAX_ARRAY_ITEMS = 12;
const SENSITIVE_KEY = /(?:authorization|cookie|secret|token|key|signature|prompt|request|raw|output|delivery|wallet|address|email|phone)/i;
let indexesReady: Promise<void> | null = null;

export function isBnbAnalyticsEnabled() {
  const value = process.env.BNB_MARKETPLACE_ANALYTICS_ENABLED?.trim().toLowerCase();
  if (value === "false") return false;
  return Boolean(process.env.MONGODB_URI);
}

export function recordBnbAnalyticsEvent(input: BnbAnalyticsEventInput) {
  try {
    if (!isBnbAnalyticsEnabled()) return;
    scheduleBnbAnalyticsWrite(input);
  } catch {
    // Analytics must never affect discovery, validation, payment, or execution.
  }
}

function scheduleBnbAnalyticsWrite(input: BnbAnalyticsEventInput) {
  try {
    after(() => writeBnbAnalyticsEvent(input).catch(() => undefined));
  } catch {
    void writeBnbAnalyticsEvent(input).catch(() => undefined);
  }
}

async function writeBnbAnalyticsEvent(input: BnbAnalyticsEventInput) {
  const db = await getDb();
  await ensureIndexes();
  const document = analyticsDocument(input);
  await db.collection<BnbAnalyticsEventDocument>(COLLECTIONS.BNB_ANALYTICS_EVENTS).insertOne(document);
}

async function ensureIndexes() {
  if (indexesReady) return indexesReady;
  indexesReady = (async () => {
    const db = await getDb();
    const collection = db.collection<BnbAnalyticsEventDocument>(COLLECTIONS.BNB_ANALYTICS_EVENTS);
    await Promise.all([
      collection.createIndex({ createdAt: -1 }),
      collection.createIndex({ name: 1, createdAt: -1 }),
      collection.createIndex({ route: 1, createdAt: -1 }),
      collection.createIndex({ agentKey: 1, createdAt: -1 }),
      collection.createIndex({ clientHash: 1, createdAt: -1 }),
    ]);
  })().catch((error) => {
    indexesReady = null;
    throw error;
  });
  return indexesReady;
}

function analyticsDocument(input: BnbAnalyticsEventInput): BnbAnalyticsEventDocument {
  const agent = normalizeAgent(input.agent);
  const clientHash = input.clientAddress ? hashClient(input.clientAddress) : "";
  return {
    name: input.name,
    route: truncate(cleanText(input.route), 80) || "bnb",
    createdAt: new Date(),
    ...(clientHash ? { clientHash } : {}),
    ...(input.recordId ? { recordId: truncate(cleanText(input.recordId), 96) } : {}),
    ...(input.receiptId ? { receiptId: truncate(cleanText(input.receiptId), 96) } : {}),
    ...(agent.chainId !== undefined ? { chainId: agent.chainId } : {}),
    ...(agent.tokenId ? { tokenId: agent.tokenId } : {}),
    ...(agent.agentKey ? { agentKey: agent.agentKey } : {}),
    ...(agent.name ? { agentName: agent.name } : {}),
    ...(agent.category ? { category: agent.category } : {}),
    ...(agent.source ? { source: agent.source } : {}),
    ...(agent.executionStatus ? { executionStatus: agent.executionStatus } : {}),
    ...(input.status ? { status: truncate(cleanText(input.status), 80) } : {}),
    ...(input.ok !== undefined ? { ok: Boolean(input.ok) } : {}),
    ...(Number.isFinite(input.durationMs) ? { durationMs: Math.max(0, Math.trunc(input.durationMs as number)) } : {}),
    ...(input.metadata ? { metadata: sanitizeMetadata(input.metadata) } : {}),
  };
}

function normalizeAgent(agent: BnbAnalyticsEventInput["agent"]): NormalizedAnalyticsAgent {
  if (!agent || typeof agent !== "object") return {};
  const record = agent as Record<string, unknown>;
  const chainId = Number(record.chainId);
  const tokenId = cleanText(record.tokenId);
  const sourceFreshness = record.sourceFreshness && typeof record.sourceFreshness === "object"
    ? record.sourceFreshness as Record<string, unknown>
    : {};
  const executionStatus = normalizeExecutionStatus(record.executionStatus);
  const normalized: NormalizedAnalyticsAgent = {
    ...(Number.isFinite(chainId) ? { chainId: Math.trunc(chainId) } : {}),
    ...(tokenId ? { tokenId: truncate(tokenId, 96) } : {}),
    ...(record.name ? { name: truncate(cleanText(record.name), 120) } : {}),
    ...(record.category ? { category: truncate(cleanText(record.category), 80) } : {}),
    ...(sourceFreshness.source ? { source: truncate(cleanText(sourceFreshness.source), 80) } : {}),
    ...(executionStatus ? { executionStatus } : {}),
  };
  return {
    ...normalized,
    ...(normalized.chainId !== undefined && normalized.tokenId ? { agentKey: `${normalized.chainId}:${normalized.tokenId}` } : {}),
  };
}

function normalizeExecutionStatus(value: unknown): BnbExecutionStatus | undefined {
  if (value === "ready_to_run" || value === "connectable" || value === "listed_only" || value === "unavailable") return value;
  return undefined;
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata).slice(0, MAX_METADATA_KEYS)) {
    const cleanKey = cleanText(key);
    if (!cleanKey || SENSITIVE_KEY.test(cleanKey)) continue;
    const cleanValue = sanitizeValue(value);
    if (cleanValue === undefined) continue;
    sanitized[truncate(cleanKey, 64)] = cleanValue;
  }
  return sanitized;
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const text = cleanText(value);
    if (!text || looksSensitiveValue(text)) return undefined;
    return truncate(text, MAX_STRING_LENGTH);
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map(sanitizeValue).filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }
  return undefined;
}

function looksSensitiveValue(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value) || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function hashClient(value: string) {
  const salt = analyticsHashSalt();
  if (!salt) return "";
  return createHash("sha256").update(`bnb-analytics:${salt}:${value.toLowerCase()}`).digest("hex").slice(0, 32);
}

function analyticsHashSalt() {
  const serverSecret = process.env.BNB_AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (serverSecret) return serverSecret;
  if (process.env.NODE_ENV !== "production") {
    const localSalt = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    return localSalt || "hive-bnb";
  }
  return "";
}

function cleanText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).replace(/\s+/g, " ").trim() : "";
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}...` : value;
}

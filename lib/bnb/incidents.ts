import { createHmac } from "node:crypto";
import { after } from "next/server";
import { safeFetchJson } from "@/lib/bnb/endpoint-security";
import type { BnbActivationRecord, BnbAgentProfile } from "@/lib/bnb/types";

export type BnbIncidentKind = "run.failed" | "payment.failed" | "settlement.failed";

type IncidentAgent = Pick<BnbAgentProfile, "chainId" | "tokenId" | "name" | "executionStatus"> &
  Partial<Pick<BnbAgentProfile, "category" | "sourceFreshness">>;

export type BnbIncidentInput = {
  kind: BnbIncidentKind;
  route: string;
  record?: Pick<BnbActivationRecord, "recordId" | "receiptId" | "status" | "agent" | "jobSpec"> | null;
  recordId?: string;
  receiptId?: string;
  agent?: IncidentAgent | null;
  status?: string;
  reason?: unknown;
  metadata?: Record<string, unknown>;
};

type BnbIncidentPayload = {
  event: "bnb.incident";
  kind: BnbIncidentKind;
  route: string;
  severity: "error";
  createdAt: string;
  recordId?: string;
  receiptId?: string;
  agentKey?: string;
  chainId?: number;
  tokenId?: string;
  agentName?: string;
  category?: string;
  source?: string;
  executionStatus?: string;
  status?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};

const MAX_STRING_LENGTH = 180;
const MAX_METADATA_KEYS = 30;
const MAX_ARRAY_ITEMS = 8;
const MAX_REASON_LENGTH = 240;
const INCIDENT_WEBHOOK_TIMEOUT_MS = 4_000;
const INCIDENT_WEBHOOK_MAX_BYTES = 64 * 1024;
const SENSITIVE_KEY = /(?:authorization|cookie|secret|token|key|signature|prompt|request|raw|output|delivery|wallet|address|email|phone|transaction|hash|calldata|body)/i;

export function isBnbIncidentWebhookConfigured() {
  return Boolean(process.env.BNB_MARKETPLACE_ERROR_WEBHOOK_URL?.trim());
}

export function recordBnbIncident(input: BnbIncidentInput) {
  try {
    const endpoint = process.env.BNB_MARKETPLACE_ERROR_WEBHOOK_URL?.trim();
    if (!endpoint) return;
    scheduleBnbIncidentWebhook(endpoint, incidentPayload(input));
  } catch {
    // Incident reporting must never affect user-facing payment or execution paths.
  }
}

function scheduleBnbIncidentWebhook(endpoint: string, payload: BnbIncidentPayload) {
  try {
    after(() => postBnbIncidentWebhook(endpoint, payload).catch(() => undefined));
  } catch {
    void postBnbIncidentWebhook(endpoint, payload).catch(() => undefined);
  }
}

async function postBnbIncidentWebhook(endpoint: string, payload: BnbIncidentPayload) {
  const body = JSON.stringify(payload);
  await safeFetchJson(endpoint, {
    method: "POST",
    headers: incidentWebhookHeaders(payload, body),
    body,
    timeoutMs: INCIDENT_WEBHOOK_TIMEOUT_MS,
    maxBytes: INCIDENT_WEBHOOK_MAX_BYTES,
  });
}

function incidentWebhookHeaders(payload: BnbIncidentPayload, body: string) {
  const secret = process.env.BNB_MARKETPLACE_ERROR_WEBHOOK_SECRET?.trim();
  return {
    "User-Agent": "Hive-BNB-Incidents/1.0",
    "X-Hive-Event": payload.kind,
    ...(secret ? { "X-Hive-Signature": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}` } : {}),
  };
}

function incidentPayload(input: BnbIncidentInput): BnbIncidentPayload {
  const record = input.record || null;
  const agent = input.agent || record?.agent || null;
  const normalizedAgent = normalizeAgent(agent);
  const metadata = input.metadata ? sanitizeMetadata(input.metadata) : undefined;
  const reason = incidentReason(input.reason);

  return {
    event: "bnb.incident",
    kind: input.kind,
    route: truncate(cleanText(input.route), 80) || "bnb",
    severity: "error",
    createdAt: new Date().toISOString(),
    ...(input.recordId || record?.recordId ? { recordId: truncate(cleanText(input.recordId || record?.recordId), 96) } : {}),
    ...(input.receiptId || record?.receiptId ? { receiptId: truncate(cleanText(input.receiptId || record?.receiptId), 96) } : {}),
    ...(normalizedAgent.agentKey ? { agentKey: normalizedAgent.agentKey } : {}),
    ...(normalizedAgent.chainId !== undefined ? { chainId: normalizedAgent.chainId } : {}),
    ...(normalizedAgent.tokenId ? { tokenId: normalizedAgent.tokenId } : {}),
    ...(normalizedAgent.name ? { agentName: normalizedAgent.name } : {}),
    ...(normalizedAgent.category ? { category: normalizedAgent.category } : {}),
    ...(normalizedAgent.source ? { source: normalizedAgent.source } : {}),
    ...(normalizedAgent.executionStatus ? { executionStatus: normalizedAgent.executionStatus } : {}),
    ...(input.status || record?.status ? { status: truncate(cleanText(input.status || record?.status), 80) } : {}),
    ...(reason ? { reason } : {}),
    ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

function normalizeAgent(agent: IncidentAgent | null) {
  if (!agent) return {};
  const chainId = Number(agent.chainId);
  const tokenId = cleanText(agent.tokenId);
  const sourceFreshness = agent.sourceFreshness && typeof agent.sourceFreshness === "object"
    ? agent.sourceFreshness as Record<string, unknown>
    : {};
  return {
    ...(Number.isFinite(chainId) ? { chainId: Math.trunc(chainId) } : {}),
    ...(tokenId ? { tokenId: truncate(tokenId, 96) } : {}),
    ...(Number.isFinite(chainId) && tokenId ? { agentKey: `${Math.trunc(chainId)}:${truncate(tokenId, 96)}` } : {}),
    ...(agent.name ? { name: truncate(cleanText(agent.name), 120) } : {}),
    ...(agent.category ? { category: truncate(cleanText(agent.category), 80) } : {}),
    ...(sourceFreshness.source ? { source: truncate(cleanText(sourceFreshness.source), 80) } : {}),
    ...(agent.executionStatus ? { executionStatus: truncate(cleanText(agent.executionStatus), 80) } : {}),
  };
}

function incidentReason(value: unknown) {
  const text = value instanceof Error ? value.message : cleanText(value);
  if (!text || looksSensitiveValue(text)) return "";
  return truncate(redactSensitiveText(text), MAX_REASON_LENGTH);
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
    return truncate(redactSensitiveText(text), MAX_STRING_LENGTH);
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map(sanitizeValue).filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }
  return undefined;
}

function looksSensitiveValue(value: string) {
  return /^0x[a-fA-F0-9]{40,64}$/.test(value) || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function redactSensitiveText(value: string) {
  return value
    .replace(/\b0x[a-fA-F0-9]{40,64}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted]");
}

function cleanText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).replace(/\s+/g, " ").trim() : "";
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}...` : value;
}

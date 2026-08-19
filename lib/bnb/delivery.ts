import type { BnbJobSpec } from "@/lib/bnb/types";

export function formatBnbDeliveryText(output: string | undefined, jobSpec?: BnbJobSpec) {
  if (!output) return "";

  const parsed = parseJson(output);
  if (parsed !== null) {
    const directoryReport = formatAgentDirectoryPayload(parsed);
    if (directoryReport) return directoryReport;

    const parsedRecord = asRecord(parsed);
    const healthReport = formatHealthIndicators(parsedRecord, jobSpec);
    if (healthReport) return healthReport;

    const structuredReport = formatStructuredPayload(parsed);
    if (structuredReport) return structuredReport;
  }

  return output;
}

function formatAgentDirectoryPayload(payload: unknown) {
  const record = asRecord(payload);
  const data = asRecord(record.data);
  const agents = Array.isArray(payload)
    ? payload
    : Array.isArray(record.agents)
    ? record.agents
    : Array.isArray(data.agents)
    ? data.agents
    : [];

  if (!looksLikeAgentDirectory(agents, record)) return "";

  const count = readFiniteNumber(record.count) || agents.length;
  const names = agents
    .map((item) => asRecord(item))
    .map((item) => readDisplayValue(item.name) || readDisplayValue(item.erc8004AgentId) || readDisplayValue(item.nfaTokenId))
    .filter(Boolean)
    .slice(0, 5);

  return [
    "This is not the requested result.",
    "The agent returned a list of agents instead.",
    `${count} agent${count === 1 ? "" : "s"} returned${names.length > 0 ? `: ${names.join(", ")}${count > names.length ? ", ..." : "."}` : "."}`,
    "Choose an agent whose job type matches this request.",
  ].join("\n");
}

function looksLikeAgentDirectory(agents: unknown[], record: Record<string, unknown>) {
  if (agents.length === 0) return false;
  const sample = agents.slice(0, 5).map(asRecord);
  const agentLikeItems = sample.filter((item) => (
    "nfaTokenId" in item ||
    "erc8004AgentId" in item ||
    "slyWalletAddress" in item ||
    ("riskProfile" in item && "name" in item)
  ));
  if (agentLikeItems.length > 0) return true;

  const keys = Object.keys(record).map((key) => key.toLowerCase());
  return keys.includes("agents") && keys.includes("count");
}

function formatHealthIndicators(payload: Record<string, unknown>, jobSpec?: BnbJobSpec) {
  const data = asRecord(payload.data);
  const chains = asRecord(data.chains);
  const chainEntries = Object.entries(chains)
    .map(([chainName, value]) => [chainName, asRecord(value)] as const)
    .filter(([, value]) => Object.keys(value).length > 0);
  const operation = typeof payload.operation === "string" ? payload.operation : "";
  const isHealthPayload = operation.toLowerCase().includes("health") || chainEntries.some(([, value]) => "healthFactor" in value);
  if (!isHealthPayload) return "";

  const requestedProtocol = jobSpec?.fields.protocol || "";
  const reportedProject = typeof payload.project === "string" ? payload.project : "";
  const lines = ["Health factor check"];

  if (requestedProtocol) lines.push(`Requested protocol: ${requestedProtocol}`);
  if (reportedProject) lines.push(`Agent reported protocol: ${formatProtocolName(reportedProject)}`);
  if (requestedProtocol && reportedProject && !sameProtocol(requestedProtocol, reportedProject)) {
    lines.push("Protocol mismatch: the remote agent answered with a different lending market than the job requested.");
  }

  for (const [chainName, value] of chainEntries) {
    const healthFactor = readMetric(value.healthFactor);
    const ltv = readMetric(value.currentLoanToValue);
    const liquidationThreshold = readMetric(value.currentLiquidationThreshold);
    const noPosition = healthFactor === "-1" || (healthFactor === "0" && ltv === "0" && liquidationThreshold === "0");

    lines.push("");
    lines.push(`${formatChainName(chainName)}: ${noPosition ? "No active lending position found for this wallet." : `Health factor ${healthFactor || "not reported"}`}`);
    if (ltv) lines.push(`Current loan to value: ${ltv}`);
    if (liquidationThreshold) lines.push(`Liquidation threshold: ${liquidationThreshold}`);
    if (typeof value.isInIsolationMode === "boolean") {
      lines.push(`Isolation mode: ${value.isInIsolationMode ? "yes" : "no"}`);
    }
  }

  const summary = asRecord(data.summary);
  const failedChains = Number(summary.failedChains || 0);
  if (Number.isFinite(failedChains) && failedChains > 0) {
    lines.push("");
    lines.push(`${failedChains} chain${failedChains === 1 ? "" : "s"} failed during the agent check.`);
  }

  return lines.join("\n");
}

function formatStructuredPayload(payload: unknown) {
  if (Array.isArray(payload)) return formatArrayPayload(payload);

  const record = asRecord(payload);
  if (Object.keys(record).length === 0) return "";

  const operation = readDisplayValue(record.operation);
  const project = readDisplayValue(record.project);
  const status = readDisplayValue(record.status);
  const message = readDisplayValue(record.message);
  const error = readDisplayValue(record.error);
  const data = "data" in record ? record.data : record;
  const dataRecord = asRecord(data);
  const lines: string[] = [];

  if (error) return `Run failed: ${error}`;
  if (operation) lines.push(`${humanizeKey(operation)} result`);
  if (project) lines.push(`Protocol: ${formatProtocolName(project)}`);
  if (status) lines.push(`Status: ${status}`);
  if (message) lines.push(message);

  const arrayEntry = Object.entries(dataRecord).find(([, value]) => Array.isArray(value));
  if (arrayEntry) {
    const arraySummary = formatArrayPayload(arrayEntry[1] as unknown[], humanizeKey(arrayEntry[0]));
    if (arraySummary) {
      if (lines.length > 0) lines.push("");
      lines.push(arraySummary);
      return lines.join("\n");
    }
  }

  const entries = simpleEntries(dataRecord, "", 0).slice(0, 14);
  if (entries.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push(...entries);
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

function formatArrayPayload(items: unknown[], label = "Items") {
  const count = items.length;
  if (count === 0) return `${label}: none returned.`;

  const lines = [`${label}: ${count} returned.`];
  const preview = items.slice(0, 8);
  for (const [index, item] of preview.entries()) {
    lines.push(`${index + 1}. ${formatArrayItem(item)}`);
  }
  if (count > preview.length) lines.push(`Showing ${preview.length} of ${count}.`);
  return lines.join("\n");
}

function formatArrayItem(item: unknown) {
  if (isScalar(item)) return readDisplayValue(item);

  const record = asRecord(item);
  const priority = [
    "name",
    "symbol",
    "asset",
    "token",
    "protocol",
    "project",
    "chain",
    "status",
    "healthFactor",
    "currentLoanToValue",
    "apy",
    "amount",
    "address",
    "walletAddress",
    "pool",
    "pair",
    "id",
  ];
  const selected = priority
    .filter((key) => record[key] !== undefined && record[key] !== null && record[key] !== "")
    .slice(0, 4);
  const fallback = Object.keys(record)
    .filter((key) => !selected.includes(key) && isScalar(record[key]))
    .slice(0, Math.max(0, 4 - selected.length));
  const keys = [...selected, ...fallback];

  if (keys.length === 0) return "Object returned.";
  return keys.map((key) => `${humanizeKey(key)}: ${readDisplayValue(record[key])}`).join("; ");
}

function simpleEntries(value: Record<string, unknown>, prefix: string, depth: number): string[] {
  const lines: string[] = [];
  for (const [key, rawValue] of Object.entries(value)) {
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;
    if (key === "data" && depth === 0) continue;

    const label = prefix ? `${prefix} ${humanizeKey(key)}` : humanizeKey(key);
    if (isScalar(rawValue)) {
      lines.push(`${label}: ${readDisplayValue(rawValue)}`);
      continue;
    }

    if (Array.isArray(rawValue)) {
      lines.push(`${label}: ${rawValue.length} item${rawValue.length === 1 ? "" : "s"}`);
      continue;
    }

    if (depth < 1) {
      lines.push(...simpleEntries(asRecord(rawValue), label, depth + 1));
    }
  }

  return lines;
}

function parseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function readMetric(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readFiniteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function isScalar(value: unknown) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function readDisplayValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  return "";
}

function sameProtocol(left: string, right: string) {
  return normalizeProtocol(left) === normalizeProtocol(right);
}

function normalizeProtocol(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function formatProtocolName(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  if (normalized.toLowerCase() === "aave") return "Aave";
  if (normalized.toLowerCase() === "venus") return "Venus";
  if (normalized.toLowerCase() === "lista") return "Lista";
  return normalized;
}

function formatChainName(value: string) {
  const normalized = value.trim();
  if (normalized.toLowerCase() === "bsc") return "BSC";
  return normalized || "Chain";
}

function humanizeKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

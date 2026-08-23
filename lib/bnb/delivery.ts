import type { BnbJobSpec } from "@/lib/bnb/types";

export function formatBnbDeliveryText(output: string | undefined, jobSpec?: BnbJobSpec) {
  if (!output) return "";

  const parsed = parseJson(output);
  if (parsed !== null) {
    const emptyReport = formatEmptyPayload(parsed);
    if (emptyReport) return emptyReport;

    const transportStatusReport = formatTransportStatusPayload(parsed);
    if (transportStatusReport) return transportStatusReport;

    const directoryReport = formatAgentDirectoryPayload(parsed);
    if (directoryReport) return directoryReport;

    const documentationReport = formatDocumentationPayload(parsed, jobSpec);
    if (documentationReport) return documentationReport;

    const parsedRecord = asRecord(parsed);
    const healthReport = formatHealthIndicators(parsedRecord, jobSpec);
    if (healthReport) return healthReport;

    const mismatchReport = formatCapabilityMismatchPayload(parsed, jobSpec);
    if (mismatchReport) return mismatchReport;

    const structuredReport = formatStructuredPayload(parsed);
    if (structuredReport) return structuredReport;
  }

  const documentationReport = formatDocumentationPayload(output, jobSpec);
  if (documentationReport) return documentationReport;

  return output;
}

function formatEmptyPayload(payload: unknown) {
  return isEmptyStructuredPayload(payload) ? "No result returned." : "";
}

function isEmptyStructuredPayload(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.every(isEmptyStructuredPayload);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(isEmptyStructuredPayload);
  return false;
}

function formatTransportStatusPayload(payload: unknown) {
  return isTransportStatusPayload(payload) ? "No result returned." : "";
}

function isTransportStatusPayload(value: unknown): boolean {
  if (typeof value === "string") return isTransportStatusText(value);
  if (Array.isArray(value) || typeof value !== "object" || value === null) return false;

  const record = value as Record<string, unknown>;
  const entries = Object.entries(record).filter(([, item]) => !isEmptyStructuredPayload(item));
  if (entries.length === 0) return true;

  const transportKeys = new Set(["id", "jsonrpc", "kind", "metadata", "messageid", "contextid", "taskid", "status", "state"]);
  const textKeys = new Set(["message", "detail", "description"]);
  const nonTransportKeys = entries.filter(([key]) => !transportKeys.has(key.toLowerCase()) && !textKeys.has(key.toLowerCase()));
  if (nonTransportKeys.length > 0) return false;

  const statusTexts = entries
    .filter(([key]) => ["status", "state", "message", "detail", "description"].includes(key.toLowerCase()))
    .map(([, item]) => transportStatusText(item))
    .map((item) => item.trim())
    .filter(Boolean);

  return statusTexts.length === 0 || statusTexts.every(isTransportStatusText);
}

function transportStatusText(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return [
    readDisplayValue(record.status),
    readDisplayValue(record.state),
    readDisplayValue(record.message),
  ].filter(Boolean).join(" ");
}

function isTransportStatusText(value: string) {
  return /^(ok|success|successful|succeeded|complete|completed|accepted|submitted|queued|running|done|200)$/i.test(value.trim());
}

const capabilityOutputTerms: Record<NonNullable<BnbJobSpec["capability"]>, string[]> = {
  rebalancing: ["rebalance", "range", "liquidity", "position", "pool", "allocation", "hold", "widen", "narrow"],
  concentrated_liquidity: ["v3", "dex", "fee", "fee tier", "tick", "range", "token0", "token1", "liquidity", "pool", "position"],
  grid_trading: ["grid", "lower", "upper", "bound", "level", "strategy", "pair", "stop"],
  yield_optimisation: ["yield", "apy", "apr", "route", "farm", "vault", "staking", "protocol", "asset", "token", "liquidity"],
  health_factor: ["health", "healthfactor", "liquidation", "collateral", "borrow", "loan", "ltv", "threshold", "shortfall"],
  custom: [],
};

function formatCapabilityMismatchPayload(payload: unknown, jobSpec?: BnbJobSpec) {
  if (!jobSpec || jobSpec.capability === "custom") return "";
  if (payloadMatchesCapability(payload, jobSpec.capability)) return "";

  return [
    "This is not the requested result.",
    "The agent returned data that does not match the selected job.",
  ].join("\n");
}

function payloadMatchesCapability(payload: unknown, capability: BnbJobSpec["capability"]) {
  const terms = capabilityOutputTerms[capability] || [];
  if (terms.length === 0) return true;
  const text = structuredPayloadText(payload);
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function structuredPayloadText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (isScalar(value)) return readDisplayValue(value).toLowerCase();
  if (Array.isArray(value)) return value.slice(0, 12).map(structuredPayloadText).join(" ");
  const record = asRecord(value);
  return Object.entries(record)
    .slice(0, 80)
    .map(([key, item]) => `${key} ${structuredPayloadText(item)}`)
    .join(" ")
    .toLowerCase();
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

function formatDocumentationPayload(payload: unknown, jobSpec?: BnbJobSpec) {
  const record = asRecord(payload);
  const data = asRecord(record.data);
  const operation = readDisplayValue(record.operation);
  const description = readDisplayValue(record.description) || readDisplayValue(data.description) || (typeof payload === "string" ? payload : "");
  const text = [operation, description].join("\n").toLowerCase();
  const compactOperation = operation.replace(/[^a-z0-9]+/gi, "").toLowerCase();

  const looksLikeDocs =
    /getdescription|documentation|protocoloverview|usageguide|userguide/.test(compactOperation) ||
    (
      /\bdescription\b/.test(text) &&
      /(how to use|to get started|supported chains|available pools|safety tips|simply tell me|supply & earn|borrow assets)/.test(text)
    );

  if (!looksLikeDocs) return "";

  const lines = [
    "This is not the requested result.",
    "The agent returned protocol documentation instead of running the job.",
  ];
  if (jobSpec?.summary) lines.push(`Requested job: ${jobSpec.summary}`);
  return lines.join("\n");
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
  if (Array.isArray(payload)) return formatNestedCollectionPayload(payload) || formatArrayPayload(payload);

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

  const nestedCollection = formatNestedCollectionPayload(data);
  if (nestedCollection) {
    if (lines.length > 0) lines.push("");
    lines.push(nestedCollection);
    return lines.join("\n");
  }

  const arrayEntry = Object.entries(dataRecord).find(([, value]) => Array.isArray(value));
  if (arrayEntry) {
    const arraySummary = formatArrayPayload(arrayEntry[1] as unknown[], humanizeKey(arrayEntry[0]));
    if (arraySummary) {
      if (lines.length > 0) lines.push("");
      lines.push(arraySummary);
      return lines.join("\n");
    }
  }

  const detailRecord = data === record ? omitStructuredHeaderFields(dataRecord) : dataRecord;
  const entries = simpleEntries(detailRecord, "", 0).slice(0, 14);
  if (entries.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push(...entries);
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

function omitStructuredHeaderFields(record: Record<string, unknown>) {
  const skipped = new Set(["operation", "project", "status", "message", "error"]);
  return Object.fromEntries(Object.entries(record).filter(([key]) => !skipped.has(key)));
}

type DisplayCollection = {
  label: string;
  items: Record<string, unknown>[];
  score: number;
};

const nestedCollectionKeys = new Set([
  "assets",
  "farms",
  "markets",
  "pools",
  "positions",
  "routes",
  "tokens",
  "vaults",
]);
const DISPLAY_COLLECTION_LIMIT = 50;
const DISPLAY_ARRAY_LIMIT = 25;

function formatNestedCollectionPayload(payload: unknown) {
  const collections = collectDisplayCollections(payload, {}, "Items", 0)
    .filter((collection) => collection.items.length > 0)
    .sort((left, right) => right.score - left.score);
  const selected = collections[0];
  if (!selected) return "";

  return formatDisplayCollection(selected);
}

function collectDisplayCollections(
  value: unknown,
  context: Record<string, unknown>,
  label: string,
  depth: number,
): DisplayCollection[] {
  if (depth > 4) return [];

  if (Array.isArray(value)) {
    const records = value.map((item) => mergeContext(asRecord(item), context));
    const displayRecords = records.filter(isDisplayResultRecord);
    const nested = records.flatMap((record) => collectDisplayCollections(record, contextualScalars(record), label, depth + 1));
    if (displayRecords.length === 0) return nested;

    return [
      {
        label,
        items: displayRecords,
        score: collectionScore(label, displayRecords),
      },
      ...nested,
    ];
  }

  const record = asRecord(value);
  if (Object.keys(record).length === 0) return [];

  const nextContext = {
    ...context,
    ...contextualScalars(record),
  };

  return Object.entries(record).flatMap(([key, child]) => {
    const childLabel = humanizeKey(key);
    if (Array.isArray(child)) {
      const records = child
        .map((item) => mergeContext(asRecord(item), nextContext))
        .filter(isDisplayResultRecord);
      const nested = collectDisplayCollections(child, nextContext, childLabel, depth + 1);
      if (records.length === 0) return nested;

      return [
        {
          label: childLabel,
          items: records,
          score: collectionScore(childLabel, records),
        },
        ...nested,
      ];
    }

    if (typeof child === "object" && child !== null) {
      return collectDisplayCollections(child, nextContext, childLabel, depth + 1);
    }

    return [];
  });
}

function formatDisplayCollection(collection: DisplayCollection) {
  const label = collection.label === "Items" ? "Results" : collection.label;
  const count = collection.items.length;
  const preview = collection.items.slice(0, DISPLAY_COLLECTION_LIMIT);
  const lines = [`${label}: ${count} returned.`];

  for (const [index, item] of preview.entries()) {
    lines.push(`${index + 1}. ${formatDisplayRecord(item)}`);
  }

  if (count > preview.length) lines.push(`Showing first ${preview.length} of ${count}.`);
  return lines.join("\n");
}

function formatDisplayRecord(record: Record<string, unknown>) {
  const title = firstDisplayValue(record, ["name", "token", "symbol", "asset", "pair", "pool", "vault", "id"]) || "Result";
  const platform = firstDisplayValue(record, ["platform", "protocol", "project", "tokenProviderId", "dex"]);
  const chain = firstDisplayValue(record, ["chain", "chainName", "network"]);
  const context = [
    platform ? formatProtocolName(platform) : "",
    chain ? formatChainName(chain) : "",
  ].filter(Boolean).join(", ");
  const metrics = [
    rateMetric("APY", record.apy),
    rateMetric("APR", record.apr),
    moneyMetric("TVL", record.tvl),
    moneyMetric("Pool TVL", record.poolTvl),
    moneyMetric("Liquidity", record.liquidity),
    numberMetric("Price", record.price),
    numberMetric("Balance", record.balance),
  ].filter(Boolean);
  const address = firstDisplayValue(record, ["tokenAddress", "vaultAddress", "poolAddress", "contractAddress", "address"]);
  const parts = [`${title}${context ? ` (${context})` : ""}`, ...metrics];

  if (address) parts.push(`address ${shortAddress(address)}`);
  return parts.join(" - ");
}

function collectionScore(label: string, records: Record<string, unknown>[]) {
  const normalizedLabel = label.trim().toLowerCase();
  const labelScore = nestedCollectionKeys.has(normalizedLabel) ? 40 : normalizedLabel === "data" || normalizedLabel === "items" ? 0 : 8;
  const recordScore = records.slice(0, 8).reduce((sum, record) => sum + resultRecordScore(record), 0);
  return labelScore + recordScore + Math.min(records.length, 20);
}

function isDisplayResultRecord(record: Record<string, unknown>) {
  if (Object.keys(record).length === 0) return false;
  if (Object.values(record).some(Array.isArray) && resultRecordScore(record) < 4) return false;
  return resultRecordScore(record) >= 4;
}

function resultRecordScore(record: Record<string, unknown>) {
  const keys = Object.keys(record).map((key) => key.toLowerCase());
  const highSignal = ["apy", "apr", "tvl", "pooltvl", "liquidity", "vault", "pool", "route", "market", "position"];
  const mediumSignal = ["token", "asset", "symbol", "name", "platform", "protocol", "project", "chain", "network", "pair"];
  const addressSignal = ["address", "tokenaddress", "vaultaddress", "pooladdress", "contractaddress"];

  return keys.reduce((score, key) => {
    if (highSignal.includes(key)) return score + 3;
    if (mediumSignal.includes(key)) return score + 2;
    if (addressSignal.includes(key)) return score + 2;
    if (key === "id") return score + 1;
    return score;
  }, 0);
}

function contextualScalars(record: Record<string, unknown>) {
  const contextKeys = ["chain", "chainName", "network", "protocol", "project", "platform", "tokenProviderId", "dex"];
  return Object.fromEntries(
    contextKeys
      .filter((key) => isScalar(record[key]))
      .map((key) => [key, record[key]]),
  );
}

function mergeContext(record: Record<string, unknown>, context: Record<string, unknown>) {
  return {
    ...context,
    ...record,
  };
}

function firstDisplayValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readDisplayValue(record[key]);
    if (value) return value;
  }
  return "";
}

function rateMetric(label: string, value: unknown) {
  const number = readNumber(value);
  if (number === null) return "";
  const percent = Math.abs(number) <= 10 ? number * 100 : number;
  return `${label} ${formatDecimal(percent)}%`;
}

function moneyMetric(label: string, value: unknown) {
  const number = readNumber(value);
  if (number === null) return "";
  return `${label} $${formatCompactNumber(number)}`;
}

function numberMetric(label: string, value: unknown) {
  const number = readNumber(value);
  if (number === null) return "";
  return `${label} ${formatCompactNumber(number)}`;
}

function formatArrayPayload(items: unknown[], label = "Items") {
  const count = items.length;
  if (count === 0) return `${label}: none returned.`;

  const lines = [`${label}: ${count} returned.`];
  const preview = items.slice(0, DISPLAY_ARRAY_LIMIT);
  for (const [index, item] of preview.entries()) {
    lines.push(`${index + 1}. ${formatArrayItem(item)}`);
  }
  if (count > preview.length) lines.push(`Showing first ${preview.length} of ${count}.`);
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

function readNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(number) ? number : null;
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
  if (normalized.toLowerCase() === "beefy") return "Beefy";
  if (normalized.toLowerCase() === "pancakeswap") return "PancakeSwap";
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

function formatCompactNumber(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${formatDecimal(value / 1_000_000_000)}b`;
  if (absolute >= 1_000_000) return `${formatDecimal(value / 1_000_000)}m`;
  if (absolute >= 1_000) return `${formatDecimal(value / 1_000)}k`;
  return formatDecimal(value);
}

function formatDecimal(value: number) {
  const absolute = Math.abs(value);
  const digits = absolute >= 100 ? 1 : absolute >= 10 ? 2 : 3;
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

function shortAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

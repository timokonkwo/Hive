#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_EXPECTED_CHAIN_ID = 56;
const HACKATHON_CATEGORIES = [
  "rebalancing",
  "grid-trading",
  "yield-optimisation",
  "health-factor",
];

const checks = [
  {
    name: "home",
    publicPath: "/",
    localPath: "/bnb",
    type: "html",
  },
  {
    name: "agents",
    publicPath: "/agents",
    localPath: "/bnb/agents",
    type: "html",
  },
  {
    name: "report",
    publicPath: "/report",
    localPath: "/bnb/report",
    type: "html",
  },
  {
    name: "runtime",
    publicPath: "/api/bnb/runtime",
    localPath: "/api/bnb/runtime",
    type: "runtime-json",
  },
  {
    name: "agent-api",
    publicPath: "/api/bnb/agents?limit=5",
    localPath: "/api/bnb/agents?limit=5",
    type: "agents-json",
  },
];

async function main() {
  const baseUrl = parseBaseUrl();
  const timeoutMs = parseInteger(process.env.BNB_QA_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1_000, 60_000);
  const expectedChainId = parseInteger(process.env.BNB_QA_EXPECTED_CHAIN_ID, DEFAULT_EXPECTED_CHAIN_ID, 56, 97);
  const local = isLocalHost(baseUrl.hostname);
  const options = { expectedChainId };
  const failures = [];

  console.log(`BNB submission QA: ${baseUrl.origin} chain=${expectedChainId}`);

  for (const check of checks) {
    const path = local ? check.localPath : check.publicPath;
    const url = new URL(path, baseUrl);
    try {
      const result = await runCheck(url, check.type, timeoutMs, options);
      console.log(`ok ${check.name} ${path} ${result}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed";
      failures.push(`${check.name} ${path}: ${message}`);
      console.error(`fail ${check.name} ${path} ${message}`);
    }
  }

  for (const category of HACKATHON_CATEGORIES) {
    const path = local
      ? `/api/bnb/agents?category=${encodeURIComponent(category)}&limit=1`
      : `/api/bnb/agents?category=${encodeURIComponent(category)}&limit=1`;
    const url = new URL(path, baseUrl);
    try {
      const result = await runCheck(url, "agents-json", timeoutMs, options);
      console.log(`ok category:${category} ${path} ${result}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed";
      failures.push(`category:${category} ${path}: ${message}`);
      console.error(`fail category:${category} ${path} ${message}`);
    }
  }

  if (failures.length > 0) {
    console.error("\nBNB submission QA failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("BNB submission QA passed.");
}

function parseBaseUrl() {
  const argValue = readArg("--base-url");
  const raw = argValue || process.env.BNB_QA_BASE_URL || process.env.SITE_URL || "http://localhost:3000";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported protocol");
    return url;
  } catch {
    throw new Error(`Invalid BNB_QA_BASE_URL: ${raw}`);
  }
}

function readArg(name) {
  const withEquals = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (withEquals) return withEquals.slice(name.length + 1).trim();
  const index = process.argv.indexOf(name);
  if (index >= 0) return (process.argv[index + 1] || "").trim();
  return "";
}

async function runCheck(url, type, timeoutMs, options) {
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (type === "html") return await assertHtml(response);
  if (type === "runtime-json") return assertRuntimePayload(await response.json(), options);
  if (type === "agents-json") return assertAgentsPayload(await response.json(), options);
  throw new Error(`Unsupported check type: ${type}`);
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        Accept: "text/html,application/json",
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function assertHtml(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) throw new Error(`expected HTML, got ${contentType || "unknown content type"}`);
  const text = await response.text();
  if (!/Hive|BNB|Agents/i.test(text)) throw new Error("page did not include expected product text");
  return "html";
}

function assertRuntimePayload(payload, options) {
  if (!payload || typeof payload !== "object") throw new Error("runtime payload is not an object");
  if (!payload.chain || typeof payload.chain !== "object") throw new Error("runtime payload is missing chain readiness");
  if (!payload.actions || typeof payload.actions !== "object") throw new Error("runtime payload is missing action readiness");
  if (!payload.observability || typeof payload.observability !== "object") throw new Error("runtime payload is missing observability");
  if (!payload.discovery || typeof payload.discovery !== "object") throw new Error("runtime payload is missing discovery readiness");
  if (payload.chain.chainId !== options.expectedChainId) throw new Error(`expected BNB chain ID ${options.expectedChainId}, got ${payload.chain.chainId}`);
  if (payload.chain.configurationReady !== true) {
    throw new Error(`BNB chain env is not ready: ${(payload.chain.configurationErrors || []).join("; ") || "unknown error"}`);
  }
  if (options.expectedChainId === 56 && payload.chain.network !== "mainnet") throw new Error(`expected mainnet, got ${payload.chain.network}`);
  if (payload.discovery.strictBscOnly !== true) throw new Error("strict BSC discovery is not enabled");
  if (options.expectedChainId === 56 && payload.launch?.ready !== true) {
    throw new Error(`launch is not ready: ${(payload.launch?.blockers || []).join("; ") || "unknown blocker"}`);
  }
  return `chain=${payload.chain.chainId}`;
}

function assertAgentsPayload(payload, options) {
  if (!payload || typeof payload !== "object") throw new Error("agent payload is not an object");
  if (!Array.isArray(payload.agents)) throw new Error("agent payload is missing agents");
  if (payload.agents.length === 0) throw new Error("agent payload returned no agents");
  const first = payload.agents[0];
  if (!first || typeof first !== "object" || !first.name) throw new Error("agent payload is missing agent names");
  const wrongChain = payload.agents.find((agent) => agent?.chainId !== options.expectedChainId);
  if (wrongChain) throw new Error(`agent ${wrongChain.name || wrongChain.tokenId || "unknown"} is not on chain ${options.expectedChainId}`);
  const wrongSource = payload.agents.find((agent) => agent?.sourceFreshness?.source !== "8004scan");
  if (wrongSource) throw new Error(`agent ${wrongSource.name || wrongSource.tokenId || "unknown"} is not from 8004scan`);
  return `agents=${payload.agents.length}`;
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function parseInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "BNB submission QA failed.");
  process.exit(1);
});

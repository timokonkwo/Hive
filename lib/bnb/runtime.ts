import { isAddress } from "viem";
import { getHiveBnbNetworkConfig, getHiveBnbNetworkEnvStatus } from "@/lib/bnb/network";
import { isBnbAnalyticsEnabled } from "@/lib/bnb/analytics";
import { isStrictBscAgentDiscoveryEnabled } from "@/lib/bnb/discovery-policy";
import { getBnbEndpointSourceReadiness } from "@/lib/bnb/endpoint-sources";
import { isBnbIncidentWebhookConfigured } from "@/lib/bnb/incidents";
import { classifyBnbAgentReadiness, isBnbAgentHireable } from "@/lib/bnb/readiness";
import { getBnbStudioV2Readiness } from "@/lib/bnb/studio-v2";
import { isBnbX402SettlementConfigured } from "@/lib/bnb/x402";
import type { BnbAgentProfile, BnbPaymentMode } from "@/lib/bnb/types";
import type { BnbAdapterPreflightResult } from "@/lib/bnb/adapters/types";

function envFlag(name: string) {
  return process.env[name]?.trim() === "true";
}

function envEnabled(name: string, defaultValue = true) {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

function envPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function hasValidEnvAddress(name: string) {
  const value = process.env[name]?.trim();
  return Boolean(value && isAddress(value));
}

function configuredEscrowRequirement() {
  const value = process.env.BNB_AGENT_RUN_REQUIRES_ESCROW?.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function forceEscrowForUnpricedAgents() {
  return envFlag("BNB_FORCE_ESCROW_FOR_UNPRICED_AGENTS");
}

function zeroPriceRunsEnabled() {
  return envEnabled("BNB_ZERO_PRICE_RUNS_ENABLED", true);
}

function hasListedPayment(agent: Pick<BnbAgentProfile, "services" | "x402Support">) {
  return agent.services.some((service) => hasPositiveListedPaymentPrice(service.price || ""));
}

function hasPositiveListedPaymentPrice(value: string) {
  const price = value.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!price || ["free", "not listed", "not set", "price not set", "price on request"].includes(price)) return false;
  if (/^0+(?:\.0+)?(?:\s*(?:t?bnb|bnb|usd|usdc|usdt|busd))?$/.test(price)) return false;
  return true;
}

function processStorageAllowed() {
  return envFlag("BNB_ALLOW_PROCESS_STORAGE") || (process.env.NODE_ENV !== "production" && !envPresent("MONGODB_URI"));
}

function hasPaidX402Endpoint(agent: Pick<BnbAgentProfile, "services" | "x402Support" | "executionEndpoints">) {
  if (agent.executionEndpoints?.some((endpoint) => endpoint.adapter === "x402" && endpoint.paymentRequired)) return true;
  return agent.services.some((service) => service.type === "x402" && Boolean(service.endpoint) && hasPositiveListedPaymentPrice(service.price || ""));
}

export function canHireBnbAgent(agent: Pick<BnbAgentProfile, "activationStatus" | "executionStatus" | "agentWallet" | "executionEndpoints" | "hasActionableEndpointCapabilities">) {
  return isBnbAgentHireable(agent);
}

export function getBnbRuntimeReadiness() {
  const network = getHiveBnbNetworkConfig();
  const networkEnv = getHiveBnbNetworkEnvStatus();
  const studioV2 = getBnbStudioV2Readiness();
  const mongoConfigured = envPresent("MONGODB_URI");
  const processFallbackAllowed = processStorageAllowed();
  const storageReady = mongoConfigured || processFallbackAllowed;
  const escrowConfigured = hasValidEnvAddress("BNB_AGENT_ESCROW_ADDRESS");
  const x402Configured = isBnbX402SettlementConfigured();
  const zeroPriceRunsReady = zeroPriceRunsEnabled() && !forceEscrowForUnpricedAgents();
  const sessionRegistryConfigured = hasValidEnvAddress("BNB_SESSION_REGISTRY_ADDRESS");
  const workerConfigured = envPresent("BNB_AGENT_WORKER_URL");
  const cronSecretConfigured = envPresent("CRON_SECRET");
  const strictBscOnly = isStrictBscAgentDiscoveryEnabled();
  const launchBlockers = [
    ...(network.network === "mainnet" && network.chainId === 56 ? [] : ["BNB runtime is not on mainnet."]),
    ...(networkEnv.ready ? [] : networkEnv.errors),
    ...(mongoConfigured ? [] : ["MongoDB storage is not configured."]),
    ...(workerConfigured ? [] : ["The agent worker is not configured."]),
    ...(envFlag("BNB_8004SCAN_LIVE") ? [] : ["Live ERC-8004 discovery is disabled."]),
    ...(strictBscOnly ? [] : ["Strict BSC discovery is disabled."]),
    ...(cronSecretConfigured ? [] : ["The cache cron secret is not configured."]),
  ];

  return {
    storage: {
      ready: storageReady,
      mongoConfigured,
      processFallbackAllowed,
    },
    chain: {
      network: network.network,
      chainId: network.chainId,
      nativeSymbol: network.nativeSymbol,
      explorerUrl: network.explorerUrl,
      configurationReady: networkEnv.ready,
      configurationErrors: networkEnv.errors,
      bscRpcConfigured: envPresent("BNB_BSC_RPC_URL"),
      bscChainIdConfigured: envPresent("BNB_BSC_CHAIN_ID"),
      clientBscRpcConfigured: envPresent("NEXT_PUBLIC_BNB_BSC_RPC_URL"),
      clientBscChainIdConfigured: envPresent("NEXT_PUBLIC_BNB_BSC_CHAIN_ID"),
      escrowConfigured,
      sessionRegistryConfigured,
    },
    worker: {
      ready: workerConfigured,
      workerConfigured,
      workerApiKeyConfigured: envPresent("BNB_AGENT_WORKER_API_KEY"),
      callbackSecretConfigured: envPresent("BNB_AGENT_WORKER_CALLBACK_SECRET"),
    },
    discovery: {
      live8004scanEnabled: envFlag("BNB_8004SCAN_LIVE"),
      strictBscOnly,
      configuredAgents: envPresent("BNB_HIVE_AGENTS_JSON"),
      endpointSources: getBnbEndpointSourceReadiness(),
    },
    observability: {
      endpointProbeStorageReady: mongoConfigured,
      endpointCapabilityStorageReady: mongoConfigured,
      analyticsStorageReady: isBnbAnalyticsEnabled(),
      incidentWebhookConfigured: isBnbIncidentWebhookConfigured(),
      cacheCronConfigured: cronSecretConfigured,
    },
    actions: {
      canCreateRequest: storageReady,
      canCreateHire: storageReady && (escrowConfigured || x402Configured || zeroPriceRunsReady),
      canCreatePaidHire: storageReady && (escrowConfigured || x402Configured),
      canRunWithoutPayment: storageReady && zeroPriceRunsReady,
      canFundEscrow: escrowConfigured,
      canPayX402: x402Configured,
      canGrantSession: storageReady && sessionRegistryConfigured,
      canRunAgent: storageReady,
    },
    launch: {
      ready: launchBlockers.length === 0,
      blockers: launchBlockers,
    },
    studioV2,
  };
}

export function shouldRequireBnbEscrow(agent: Pick<BnbAgentProfile, "services" | "x402Support">) {
  return resolveBnbPaymentMode(agent) === "escrow";
}

export function shouldRequireBnbX402(agent: Pick<BnbAgentProfile, "services" | "x402Support" | "executionEndpoints">) {
  return resolveBnbPaymentMode(agent) === "x402";
}

export function resolveBnbPaymentMode(agent: Pick<BnbAgentProfile, "services" | "x402Support" | "executionEndpoints">): BnbPaymentMode {
  const listedPayment = hasListedPayment(agent);
  if (hasPaidX402Endpoint(agent)) return "x402";

  const configured = configuredEscrowRequirement();
  if (configured === false) return "none";
  if (!listedPayment && zeroPriceRunsEnabled() && !forceEscrowForUnpricedAgents()) return "none";
  if (listedPayment) return (configured ?? true) ? "escrow" : "none";
  if (!zeroPriceRunsEnabled()) return (configured ?? true) ? "escrow" : "none";
  return configured === true && forceEscrowForUnpricedAgents() ? "escrow" : "none";
}

export function resolveBnbPaymentModeForPreflight(
  agent: Pick<BnbAgentProfile, "services" | "x402Support" | "executionEndpoints">,
  selected: BnbAdapterPreflightResult | undefined,
): BnbPaymentMode {
  if (!selected?.endpoint) return resolveBnbPaymentMode(agent);

  const endpointPrice = agent.services.find((service) => service.endpoint === selected.endpoint?.url)?.price || "";
  const paymentRequired = selected.endpoint.paymentRequired === true
    || selected.capabilityContracts?.some((capability) => capability.paymentRequired === true) === true
    || hasPositiveListedPaymentPrice(endpointPrice)
    || (agent.executionEndpoints?.length === 1 && hasListedPayment(agent));
  if (paymentRequired) return selected.adapter === "x402" || selected.endpoint.adapter === "x402" ? "x402" : "escrow";

  const configured = configuredEscrowRequirement();
  if (!zeroPriceRunsEnabled()) return (configured ?? true) ? "escrow" : "none";
  return configured === true && forceEscrowForUnpricedAgents() ? "escrow" : "none";
}

export function getBnbHireBlocker(
  agent: Pick<BnbAgentProfile, "activationStatus" | "executionStatus" | "agentWallet" | "executionEndpoints" | "hasActionableEndpointCapabilities">,
  options: { requireEscrow?: boolean; paymentMode?: BnbPaymentMode } = {},
) {
  const readiness = getBnbRuntimeReadiness();
  const paymentMode = options.paymentMode || (options.requireEscrow === false ? "none" : "escrow");
  const requireEscrow = paymentMode === "escrow";

  if (!readiness.actions.canCreateHire) {
    if (!readiness.storage.ready) return "BNB record storage is not configured.";
    if (requireEscrow) return "Payment is not configured.";
    if (paymentMode === "x402") return "Payment is not configured.";
  }

  if (paymentMode === "x402" && !readiness.actions.canPayX402) return "Payment is not configured.";

  const agentReadiness = classifyBnbAgentReadiness(agent);
  if (!agentReadiness.canHire) {
    if (agentReadiness.status === "profile") return "This agent is not available for jobs.";
    if (agentReadiness.status === "unavailable") return "This agent is unavailable.";
    return agentReadiness.reason;
  }

  if (requireEscrow && !isAddress(agent.agentWallet)) {
    return "This agent needs a valid BSC wallet before it can be hired.";
  }

  return "";
}

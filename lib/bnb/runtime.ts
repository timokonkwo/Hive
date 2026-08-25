import { isAddress } from "viem";
import { getHiveBnbNetworkConfig } from "@/lib/bnb/network";
import { getBnbEndpointSourceReadiness } from "@/lib/bnb/endpoint-sources";
import { classifyBnbAgentReadiness, isBnbAgentHireable } from "@/lib/bnb/readiness";
import { getBnbStudioV2Readiness } from "@/lib/bnb/studio-v2";
import type { BnbAgentProfile } from "@/lib/bnb/types";

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

export function canHireBnbAgent(agent: Pick<BnbAgentProfile, "activationStatus" | "executionStatus" | "agentWallet">) {
  return isBnbAgentHireable(agent);
}

export function getBnbRuntimeReadiness() {
  const network = getHiveBnbNetworkConfig();
  const studioV2 = getBnbStudioV2Readiness();
  const mongoConfigured = envPresent("MONGODB_URI");
  const processFallbackAllowed = processStorageAllowed();
  const storageReady = mongoConfigured || processFallbackAllowed;
  const escrowConfigured = hasValidEnvAddress("BNB_AGENT_ESCROW_ADDRESS");
  const sessionRegistryConfigured = hasValidEnvAddress("BNB_SESSION_REGISTRY_ADDRESS");
  const workerConfigured = envPresent("BNB_AGENT_WORKER_URL");

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
      configuredAgents: envPresent("BNB_HIVE_AGENTS_JSON"),
      endpointSources: getBnbEndpointSourceReadiness(),
    },
    observability: {
      endpointProbeStorageReady: mongoConfigured,
    },
    actions: {
      canCreateRequest: storageReady,
      canCreateHire: storageReady && escrowConfigured,
      canFundEscrow: escrowConfigured,
      canGrantSession: storageReady && sessionRegistryConfigured,
      canRunAgent: storageReady,
    },
    studioV2,
  };
}

export function shouldRequireBnbEscrow(agent: Pick<BnbAgentProfile, "services" | "x402Support">) {
  const listedPayment = hasListedPayment(agent);
  const configured = configuredEscrowRequirement();
  if (configured === false) return false;
  if (!listedPayment && zeroPriceRunsEnabled() && !forceEscrowForUnpricedAgents()) return false;
  if (listedPayment) return configured ?? true;
  if (!zeroPriceRunsEnabled()) return configured ?? true;
  return configured === true && forceEscrowForUnpricedAgents();
}

export function getBnbHireBlocker(
  agent: Pick<BnbAgentProfile, "activationStatus" | "executionStatus" | "agentWallet">,
  options: { requireEscrow?: boolean } = {},
) {
  const readiness = getBnbRuntimeReadiness();
  const requireEscrow = options.requireEscrow ?? true;

  if (!readiness.actions.canCreateHire) {
    if (!readiness.storage.ready) return "BNB record storage is not configured.";
    if (requireEscrow) return "BNB escrow is not configured.";
  }

  const agentReadiness = classifyBnbAgentReadiness(agent);
  if (!agentReadiness.canHire) {
    if (agentReadiness.status === "profile") return "This agent does not expose a callable endpoint for this job.";
    if (agentReadiness.status === "unavailable") return "This agent is unavailable.";
    return agentReadiness.reason;
  }

  if (requireEscrow && !isAddress(agent.agentWallet)) {
    return "This agent needs a valid BSC wallet before it can be hired.";
  }

  return "";
}

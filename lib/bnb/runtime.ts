import { isAddress } from "viem";
import { getHiveBnbNetworkConfig } from "@/lib/bnb/network";
import type { BnbAgentProfile } from "@/lib/bnb/types";

function envFlag(name: string) {
  return process.env[name]?.trim() === "true";
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

function hasListedPayment(agent: Pick<BnbAgentProfile, "services" | "x402Support">) {
  if (agent.x402Support) return true;
  return agent.services.some((service) => {
    const price = service.price?.trim().toLowerCase() || "";
    return Boolean(price && !["not listed", "not set", "price not set", "price on request"].includes(price));
  });
}

function processStorageAllowed() {
  return envFlag("BNB_ALLOW_PROCESS_STORAGE") || (process.env.NODE_ENV !== "production" && !envPresent("MONGODB_URI"));
}

export function canHireBnbAgent(agent: Pick<BnbAgentProfile, "activationStatus" | "executionStatus" | "agentWallet">) {
  const ready = agent.executionStatus === "ready_to_run" || (!agent.executionStatus && agent.activationStatus === "callable");
  return ready && isAddress(agent.agentWallet);
}

export function getBnbRuntimeReadiness() {
  const network = getHiveBnbNetworkConfig();
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
      localAgentsEnabled: envFlag("BNB_SHOW_LOCAL_AGENTS"),
    },
    actions: {
      canCreateRequest: storageReady,
      canCreateHire: storageReady && escrowConfigured,
      canFundEscrow: escrowConfigured,
      canGrantSession: storageReady && sessionRegistryConfigured,
      canRunAgent: storageReady,
    },
  };
}

export function shouldRequireBnbEscrow(agent: Pick<BnbAgentProfile, "services" | "x402Support">) {
  const listedPayment = hasListedPayment(agent);
  const configured = configuredEscrowRequirement();
  if (configured === false) return false;
  if (listedPayment) return configured ?? true;
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

  if (agent.executionStatus !== "ready_to_run" && agent.activationStatus !== "callable") {
    if (agent.executionStatus === "connectable") return "This agent does not expose a callable endpoint for this job.";
    return "This agent is listed, but Hive cannot run it yet.";
  }

  if (requireEscrow && !isAddress(agent.agentWallet)) {
    return "This agent needs a valid BSC wallet before it can be hired.";
  }

  return "";
}

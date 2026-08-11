import { isAddress } from "viem";
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

function processStorageAllowed() {
  return envFlag("BNB_ALLOW_PROCESS_STORAGE") || (process.env.NODE_ENV !== "production" && !envPresent("MONGODB_URI"));
}

export function canHireBnbAgent(agent: Pick<BnbAgentProfile, "activationStatus" | "executionStatus" | "agentWallet">) {
  const ready = agent.executionStatus === "ready_to_run" || (!agent.executionStatus && agent.activationStatus === "callable");
  return ready && isAddress(agent.agentWallet);
}

export function getBnbRuntimeReadiness() {
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
      bscRpcConfigured: envPresent("BNB_BSC_RPC_URL"),
      clientBscRpcConfigured: envPresent("NEXT_PUBLIC_BNB_BSC_RPC_URL"),
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

export function getBnbHireBlocker(agent: Pick<BnbAgentProfile, "activationStatus" | "executionStatus" | "agentWallet">) {
  const readiness = getBnbRuntimeReadiness();

  if (!readiness.actions.canCreateHire) {
    if (!readiness.storage.ready) return "BNB record storage is not configured.";
    return "BNB escrow is not configured.";
  }

  if (agent.executionStatus !== "ready_to_run" && agent.activationStatus !== "callable") {
    if (agent.executionStatus === "connectable") return "Check this agent's endpoint before hiring.";
    return "This agent is listed, but Hive cannot run it yet.";
  }

  if (!isAddress(agent.agentWallet)) {
    return "This agent needs a valid BSC wallet before it can be hired.";
  }

  return "";
}

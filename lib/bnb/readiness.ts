import { isAddress } from "viem";
import type { BnbAgentProfile } from "@/lib/bnb/types";

export type BnbMarketplaceReadinessStatus = "hireable" | "identity_only" | "unavailable";

export type BnbMarketplaceReadiness = {
  status: BnbMarketplaceReadinessStatus;
  canHire: boolean;
  label: "Can hire" | "Profile" | "Unavailable";
  reason: string;
};

type BnbReadinessAgent = Pick<BnbAgentProfile, "activationStatus" | "executionStatus" | "agentWallet">;

export function classifyBnbAgentReadiness(agent: BnbReadinessAgent): BnbMarketplaceReadiness {
  const executionStatus = agent.executionStatus;
  const callable = executionStatus === "ready_to_run"
    || executionStatus === "connectable"
    || (!executionStatus && agent.activationStatus === "callable");

  if (callable && isAddress(agent.agentWallet)) {
    return {
      status: "hireable",
      canHire: true,
      label: "Can hire",
      reason: "",
    };
  }

  if (callable) {
    return {
      status: "unavailable",
      canHire: false,
      label: "Can hire",
      reason: "The agent wallet is not a valid BSC address.",
    };
  }

  if (executionStatus === "unavailable") {
    return {
      status: "unavailable",
      canHire: false,
      label: "Unavailable",
      reason: "A usable BSC identity is not available for this agent.",
    };
  }

  return {
    status: "identity_only",
    canHire: false,
    label: "Profile",
    reason: "No callable job endpoint is available.",
  };
}

export function isBnbAgentHireable(agent: BnbReadinessAgent) {
  return classifyBnbAgentReadiness(agent).canHire;
}

export function bnbAgentReadinessLabel(agent: BnbReadinessAgent) {
  if (agent.executionStatus === "ready_to_run" || agent.executionStatus === "connectable" || (!agent.executionStatus && agent.activationStatus === "callable")) return "Can hire";
  if (agent.executionStatus === "unavailable") return "Unavailable";
  return "Profile";
}

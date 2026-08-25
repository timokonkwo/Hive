import { isAddress } from "viem";
import type { BnbAgentProfile } from "@/lib/bnb/types";

export type BnbMarketplaceReadinessStatus = "available" | "profile" | "unavailable";

export type BnbMarketplaceReadiness = {
  status: BnbMarketplaceReadinessStatus;
  canHire: boolean;
  label: "Available" | "Profile" | "Unavailable";
  reason: string;
};

type BnbReadinessAgent = Pick<BnbAgentProfile, "activationStatus" | "executionStatus" | "agentWallet">;

export function classifyBnbAgentReadiness(agent: BnbReadinessAgent): BnbMarketplaceReadiness {
  const executionStatus = agent.executionStatus;
  const available = executionStatus === "ready_to_run"
    || executionStatus === "connectable"
    || (!executionStatus && agent.activationStatus === "callable");

  if (available && isAddress(agent.agentWallet)) {
    return {
      status: "available",
      canHire: true,
      label: "Available",
      reason: "",
    };
  }

  if (available) {
    return {
      status: "unavailable",
      canHire: false,
      label: "Unavailable",
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
    status: "profile",
    canHire: false,
    label: "Profile",
    reason: "No callable job endpoint is available.",
  };
}

export function isBnbAgentHireable(agent: BnbReadinessAgent) {
  return classifyBnbAgentReadiness(agent).canHire;
}

export function bnbAgentReadinessLabel(agent: BnbReadinessAgent) {
  if (agent.executionStatus === "ready_to_run" || agent.executionStatus === "connectable" || (!agent.executionStatus && agent.activationStatus === "callable")) return "Available";
  if (agent.executionStatus === "unavailable") return "Unavailable";
  return "Profile";
}

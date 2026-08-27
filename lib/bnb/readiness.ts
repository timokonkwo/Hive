import type { BnbAgentProfile } from "@/lib/bnb/types";

export type BnbMarketplaceReadinessStatus = "available" | "profile" | "unavailable";

export type BnbMarketplaceReadiness = {
  status: BnbMarketplaceReadinessStatus;
  canHire: boolean;
  label: "Available" | "Profile" | "Unavailable";
  reason: string;
};

type BnbReadinessAgent = Pick<
  BnbAgentProfile,
  "activationStatus" | "executionStatus" | "agentWallet" | "executionEndpoints" | "hasActionableEndpointCapabilities"
>;

export function classifyBnbAgentReadiness(agent: BnbReadinessAgent): BnbMarketplaceReadiness {
  const executionStatus = agent.executionStatus;
  const available = agent.hasActionableEndpointCapabilities !== false && (
    executionStatus === "ready_to_run"
    || (!executionStatus && agent.activationStatus === "callable")
    || (
      executionStatus === "connectable"
      && hasCandidateExecutionEndpoint(agent)
    )
  );

  if (available) {
    return {
      status: "available",
      canHire: true,
      label: "Available",
      reason: "",
    };
  }

  if (agent.hasActionableEndpointCapabilities === false) {
    return {
      status: "profile",
      canHire: false,
      label: "Profile",
      reason: "This agent is not available for jobs.",
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
    reason: "This agent is not available for jobs.",
  };
}

export function isBnbAgentHireable(agent: BnbReadinessAgent) {
  return classifyBnbAgentReadiness(agent).canHire;
}

export function bnbAgentReadinessLabel(agent: BnbReadinessAgent) {
  if (agent.hasActionableEndpointCapabilities === false) return "Profile";
  if (isBnbAgentHireable(agent)) return "Available";
  if (agent.executionStatus === "unavailable") return "Unavailable";
  return "Profile";
}

function hasCandidateExecutionEndpoint(agent: BnbReadinessAgent) {
  return Boolean(agent.executionEndpoints?.some((endpoint) => {
    if (endpoint.adapter === "web") return false;
    if (/\{[^}]+\}|<[^>]+>|\$\{[^}]+\}/.test(endpoint.url)) return false;
    try {
      const url = new URL(endpoint.url);
      return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname);
    } catch {
      return false;
    }
  }));
}

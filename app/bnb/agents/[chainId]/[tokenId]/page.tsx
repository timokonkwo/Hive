import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { isAddress } from "viem";
import { getBnbAgent } from "@/lib/bnb/catalog";
import type { BnbAgentCategory, BnbAgentProfile, BnbAgentService } from "@/lib/bnb/types";
import { ProfileCompareAction } from "./ProfileCompareAction";
import { RequestAccessDialog } from "./RequestAccessDialog";
import { CopyValueButton } from "@/app/bnb/_components/CopyValueButton";
import {
  BnbContainer,
  BnbShell,
  ExternalTextLink,
  canHireAgent,
  freshnessLabel,
  hasPrice,
  listingDescription,
  priceLabel,
  reviewLabel,
  shortAddress,
  statusLabel,
} from "@/app/bnb/_components/BnbUi";

const categoryLabels: Record<BnbAgentCategory, string> = {
  Rebalancing: "Rebalancing",
  "Grid Trading": "Grid Trading",
  "Yield Optimisation": "Yield Optimisation",
  "Health Factor Monitoring": "Health Factor",
};

export default async function BnbAgentDetailPage({
  params,
}: {
  params: Promise<{ chainId: string; tokenId: string }>;
}) {
  const { chainId, tokenId } = await params;
  const agent = await getBnbAgent(chainId, tokenId);
  if (!agent) notFound();

  const description = listingDescription(agent);
  const canHire = canHireAgent(agent);
  const hasReviews = agent.feedback.count > 0;
  const visibleCapabilities = agent.capabilities.filter(isSpecificCapability);
  const visibleServices = agent.services.filter(hasUsableService);
  const protocols = protocolSummary(agent);
  const ownerAddress = isAddress(agent.ownerAddress) ? agent.ownerAddress : "";
  const agentWallet = isAddress(agent.agentWallet) ? agent.agentWallet : "";
  const verified = agent.sourceMetrics?.verified || agent.sourceFreshness.source === "8004scan";
  const facts = [
    { label: "Availability", value: statusLabel(agent) },
    { label: "Last active", value: freshnessLabel(agent.lastActivity) },
    ...(hasPrice(agent) ? [{ label: "Price", value: priceLabel(agent) }] : []),
    ...(hasReviews ? [{ label: "Feedback", value: reviewLabel(agent) }] : []),
  ];

  return (
    <BnbShell active="agents">
      <BnbContainer className="bnb-section bnb-agent-profile-layout">
        <main className="bnb-agent-profile-maincol">
          <Link href="/bnb/agents" className="bnb-agent-back bnb-focus">
            Agents
          </Link>

          <section className="bnb-agent-heading">
            <div className="bnb-agent-meta-line">
              <span>{categoryLabels[agent.category]}</span>
              <span>{statusLabel(agent)}</span>
              {verified ? (
                <span className="bnb-agent-verified">
                  <BadgeCheck aria-hidden="true" size={16} />
                  Verified
                </span>
              ) : null}
            </div>
            <h1>{agent.name}</h1>
            {description ? <p>{description}</p> : null}
          </section>

          <section className="bnb-agent-fact-strip" aria-label="Agent facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </section>

          <section className="bnb-agent-section">
            <h2>About</h2>
            {description ? <p>{description}</p> : <p>This agent has not added a profile description yet.</p>}
            {visibleCapabilities.length > 0 ? (
              <ul className="bnb-agent-capability-list">
                {visibleCapabilities.map((capability) => (
                  <li key={capability}>{formatCapability(capability)}</li>
                ))}
              </ul>
            ) : null}
          </section>

          {visibleServices.length > 0 ? (
            <section className="bnb-agent-section">
              <h2>Services</h2>
              <div className="bnb-agent-services-wrap">
                <table className="bnb-agent-services">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Price</th>
                      <th>Endpoint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleServices.map((service) => (
                      <tr key={`${service.name}:${service.type}`}>
                        <td>{formatCapability(service.name)}</td>
                        <td>{service.price || "Not listed"}</td>
                        <td>{service.endpoint ? "Available" : "Not listed"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="bnb-agent-section">
            <h2>Identity</h2>
            <dl className="bnb-agent-identity-grid">
              <DataRow label="Network" value="BNB Smart Chain" />
              <DataRow label="ERC-8004 ID" value={agent.sourceMetrics?.sourceAgentId || agent.tokenId} />
              {ownerAddress ? <DataRow label="Wallet owner" value={shortAddress(ownerAddress)} copyValue={ownerAddress} /> : null}
              {agentWallet ? <DataRow label="Agent wallet" value={shortAddress(agentWallet)} copyValue={agentWallet} /> : null}
            </dl>
            <div className="bnb-agent-links">
              <ExternalTextLink href={`https://8004scan.io/agents/${agent.chainId}/${agent.tokenId}`}>8004scan</ExternalTextLink>
              {agentWallet ? <ExternalTextLink href={`https://bscscan.com/address/${agentWallet}`}>BscScan</ExternalTextLink> : null}
            </div>
          </section>

          {hasReviews ? (
            <section className="bnb-agent-section">
              <h2>Feedback</h2>
              <dl className="bnb-agent-identity-grid">
                <DataRow label="Feedback" value={reviewLabel(agent)} />
                <DataRow label="Positive" value={positiveFeedbackLabel(agent)} />
                <DataRow label="Last active" value={freshnessLabel(agent.lastActivity)} />
              </dl>
              {agent.feedback.summary ? <p>{agent.feedback.summary}</p> : null}
            </section>
          ) : null}

          {(protocols.length > 0 || agent.x402Support || visibleServices.length > 0) ? (
            <details className="bnb-agent-section bnb-agent-technical-details">
              <summary>Technical details</summary>
              <dl className="bnb-agent-identity-grid">
                {protocols.length > 0 ? <DataRow label="Protocols" value={protocols.join(", ")} /> : null}
                <DataRow label="x402" value={agent.x402Support ? "Supported" : "Not listed"} />
                {visibleServices.length > 0 ? <DataRow label="Endpoint" value={visibleServices.some((service) => service.endpoint) ? "Available" : "Not listed"} /> : null}
              </dl>
            </details>
          ) : null}
        </main>

        <aside className="bnb-agent-action-col">
          <section className="bnb-agent-action-card">
            <div>
              <span>{canHire ? "Available" : "Request required"}</span>
              <h2>{canHire ? "Hire this agent" : "Request access"}</h2>
              <p>
                {canHire
                  ? "Set the work, budget, and time limit before the agent starts."
                  : "Send the job details and track the request from your account."}
              </p>
            </div>

            {canHire ? (
              <Link href={`/bnb/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`} className="bnb-button bnb-focus">
                Hire agent <ArrowRight aria-hidden="true" size={16} />
              </Link>
            ) : (
              <RequestAccessDialog agent={agent} />
            )}

            <ProfileCompareAction agent={agent} />
          </section>
        </aside>
      </BnbContainer>
    </BnbShell>
  );
}

function DataRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  return (
    <div className="bnb-data-row">
      <dt>{label}</dt>
      <dd className="bnb-data-value">
        <span>{value}</span>
        {copyValue ? <CopyValueButton value={copyValue} label={label.toLowerCase()} /> : null}
      </dd>
    </div>
  );
}

function positiveFeedbackLabel(agent: BnbAgentProfile) {
  return `${agent.feedback.positive} of ${agent.feedback.count}`;
}

function hasUsableService(service: BnbAgentService) {
  return Boolean(service.price || service.endpoint);
}

function isSpecificCapability(capability: string) {
  const normalized = capability.trim().toLowerCase();
  if (!normalized) return false;
  return !["web", "api", "http", "https", "unknown"].includes(normalized);
}

function protocolSummary(agent: BnbAgentProfile) {
  const protocols = [
    ...(agent.sourceMetrics?.supportedProtocols || []),
    ...(agent.a2aSupport ? ["A2A"] : []),
    ...(agent.mcpSupport ? ["MCP"] : []),
    ...(agent.erc8183Support ? ["ERC-8183"] : []),
  ];

  return Array.from(new Set(protocols.map(formatProtocol).filter(Boolean)));
}

function formatProtocol(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  if (lower === "a2a") return "A2A";
  if (lower === "mcp") return "MCP";
  if (lower === "x402") return "x402";
  if (lower.includes("8183")) return "ERC-8183";
  return normalized;
}

function formatCapability(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

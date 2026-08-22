import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck } from "lucide-react";
import { isAddress } from "viem";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { get8004scanAgentUrl, getBscExplorerAddressUrl } from "@/lib/bnb/chain";
import type { BnbAgentProfile } from "@/lib/bnb/types";
import { ProfileCompareAction } from "./ProfileCompareAction";
import { CopyValueButton } from "@/app/bnb/_components/CopyValueButton";
import {
  BnbContainer,
  BnbShell,
  ExternalTextLink,
  canHireAgent,
  freshnessLabel,
  hasPrice,
  priceLabel,
  shortAddress,
} from "@/app/bnb/_components/BnbUi";
import {
  bnbAgentDisplayName,
  bnbAgentIntegrations,
  bnbAgentSourceName,
  bnbCategoryLabel,
  bnbIsVerified,
  bnbListingDescription,
  bnbProtocolSummary,
  bnbReviewLabel,
  bnbServiceLabel,
  bnbSpecificCapabilities,
  bnbStatusLabel,
  bnbUsableServices,
} from "@/lib/bnb/display";

export default async function BnbAgentDetailPage({
  params,
}: {
  params: Promise<{ chainId: string; tokenId: string }>;
}) {
  const { chainId, tokenId } = await params;
  const agent = await getBnbAgent(chainId, tokenId);
  if (!agent) notFound();

  const description = bnbListingDescription(agent);
  const canHire = canHireAgent(agent);
  const hasReviews = agent.feedback.count > 0;
  const displayName = bnbAgentDisplayName(agent);
  const sourceName = bnbAgentSourceName(agent);
  const visibleCapabilities = bnbSpecificCapabilities(agent).slice(0, 8);
  const visibleServices = bnbUsableServices(agent);
  const integrations = bnbAgentIntegrations(agent);
  const protocols = bnbProtocolSummary(agent);
  const hasServiceEndpoint = Boolean(agent.executionEndpoints?.some((endpoint) => endpoint.adapter === "mcp" || endpoint.adapter === "a2a" || endpoint.adapter === "x402" || endpoint.adapter === "http"));
  const ownerAddress = isAddress(agent.ownerAddress) ? agent.ownerAddress : "";
  const agentWallet = isAddress(agent.agentWallet) ? agent.agentWallet : "";
  const identityUrl = externalAgentUrl(agent);
  const identityLabel = externalAgentLabel(agent);
  const verified = bnbIsVerified(agent);
  const facts = [
    { label: "Run status", value: bnbStatusLabel(agent) },
    ...(freshnessLabel(agent.lastActivity) ? [{ label: "Last active", value: freshnessLabel(agent.lastActivity) }] : []),
    ...(hasPrice(agent) ? [{ label: "Price", value: priceLabel(agent) }] : []),
    ...(hasReviews ? [{ label: "Reviews", value: bnbReviewLabel(agent) }] : []),
  ];

  return (
    <BnbShell active="agents">
      <BnbContainer className="bnb-section bnb-agent-detail">
        <Link href="/bnb/agents" className="bnb-agent-back bnb-focus">
          <ArrowLeft aria-hidden="true" size={15} />
          Agents
        </Link>

        <section className="bnb-agent-cover">
          <div className="bnb-agent-cover-main">
            <div className="bnb-agent-meta-line">
              <span>{bnbCategoryLabel(agent.category)}</span>
              <span>{bnbStatusLabel(agent)}</span>
              {verified ? (
                <span className="bnb-agent-verified">
                  <BadgeCheck aria-hidden="true" size={16} />
                  Verified
                </span>
              ) : null}
            </div>
            <h1>{displayName}</h1>
            {sourceName ? <p className="bnb-agent-source-name">{sourceName}</p> : null}
            {description ? <p>{description}</p> : null}
          </div>

          <div className="bnb-agent-cover-actions">
            {canHire ? (
              <Link href={`/bnb/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`} className="bnb-button bnb-focus">
                Hire agent <ArrowRight aria-hidden="true" size={16} />
              </Link>
            ) : identityUrl ? (
              <Link href={identityUrl} className="bnb-button bnb-focus" target="_blank" rel="noopener noreferrer">
                View source <ArrowRight aria-hidden="true" size={16} />
              </Link>
            ) : null}
            <ProfileCompareAction agent={agent} />
          </div>
        </section>

        {facts.length > 0 ? (
          <section className="bnb-agent-fact-strip" aria-label="Agent facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </section>
        ) : null}

        <div className="bnb-agent-detail-grid">
          <main className="bnb-agent-profile-maincol">
            {visibleCapabilities.length > 0 ? (
              <section className="bnb-agent-section">
                <h2>Capabilities</h2>
                {visibleCapabilities.length > 0 ? (
                  <ul className="bnb-agent-capability-list">
                    {visibleCapabilities.map((capability) => (
                      <li key={capability}>{capability}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {visibleServices.length > 0 ? (
              <section className="bnb-agent-section">
                <h2>Services</h2>
                <dl className="bnb-agent-identity-grid">
                  {visibleServices.map((service, index) => (
                    <DataRow key={`${service.name}:${service.type}:${index}`} label={bnbServiceLabel(service)} value={service.price || ""} />
                  ))}
                </dl>
              </section>
            ) : null}

            {hasReviews ? (
              <section className="bnb-agent-section">
                <h2>Reviews</h2>
                <dl className="bnb-agent-identity-grid">
                  <DataRow label="Reviews" value={bnbReviewLabel(agent)} />
                  <DataRow label="Positive" value={positiveFeedbackLabel(agent)} />
                  <DataRow label="Last active" value={freshnessLabel(agent.lastActivity)} />
                </dl>
                {agent.feedback.summary ? <p>{agent.feedback.summary}</p> : null}
              </section>
            ) : null}
          </main>

          <aside className="bnb-agent-sidebar">
            <section className="bnb-agent-section bnb-agent-sidebar-card">
              <h2>Identity</h2>
              <dl className="bnb-agent-identity-grid">
                <DataRow label="Network" value="BNB Smart Chain" />
                <DataRow label={agent.sourceFreshness.source === "8004scan" ? "ERC-8004 ID" : "Source ID"} value={agent.sourceMetrics?.sourceAgentId || agent.tokenId} />
                {ownerAddress ? <DataRow label="Wallet owner" value={shortAddress(ownerAddress)} copyValue={ownerAddress} /> : null}
                {agentWallet ? <DataRow label="Agent wallet" value={shortAddress(agentWallet)} copyValue={agentWallet} /> : null}
              </dl>
              <div className="bnb-agent-links">
                {identityUrl ? <ExternalTextLink href={identityUrl}>{identityLabel}</ExternalTextLink> : null}
                {agentWallet ? <ExternalTextLink href={getBscExplorerAddressUrl(agentWallet)}>BscScan</ExternalTextLink> : null}
              </div>
            </section>

            {integrations.length > 0 ? (
              <section className="bnb-agent-section bnb-agent-sidebar-card">
                <h2>Integrations</h2>
                <ul className="bnb-agent-capability-list bnb-agent-sidebar-list">
                  {integrations.map((integration) => (
                    <li key={integration}>{integration}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {(protocols.length > 0 || agent.x402Support || hasServiceEndpoint) ? (
              <details className="bnb-agent-section bnb-agent-sidebar-card bnb-agent-technical-details">
                <summary>Protocol details</summary>
                <dl className="bnb-agent-identity-grid">
                  {protocols.length > 0 ? <DataRow label="Protocols" value={protocols.join(", ")} /> : null}
                  <DataRow label="Payment protocol" value={agent.x402Support ? "x402 supported" : "Not listed"} />
                  {hasServiceEndpoint ? <DataRow label="Service endpoint" value="Available" /> : null}
                </dl>
              </details>
            ) : null}
          </aside>
        </div>
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

function externalAgentUrl(agent: BnbAgentProfile) {
  if (agent.sourceFreshness.source === "8004scan") return get8004scanAgentUrl(agent.chainId, agent.tokenId);
  return safeExternalUrl(agent.metadataUri || agent.executionEndpoints?.[0]?.url || agent.services.find((service) => service.endpoint)?.endpoint || "");
}

function externalAgentLabel(agent: BnbAgentProfile) {
  if (agent.sourceFreshness.source === "agent402") return "Agent402";
  if (agent.sourceFreshness.source === "402index") return "402Index";
  if (agent.sourceFreshness.source === "x402direct") return "x402.direct";
  if (agent.sourceFreshness.source === "the402") return "the402";
  return "8004scan";
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

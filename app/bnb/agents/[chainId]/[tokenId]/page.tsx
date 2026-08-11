import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck } from "lucide-react";
import { isAddress } from "viem";
import { getBnbAgent } from "@/lib/bnb/catalog";
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
  const ownerAddress = isAddress(agent.ownerAddress) ? agent.ownerAddress : "";
  const agentWallet = isAddress(agent.agentWallet) ? agent.agentWallet : "";
  const verified = bnbIsVerified(agent);
  const facts = [
    { label: "Availability", value: bnbStatusLabel(agent) },
    ...(freshnessLabel(agent.lastActivity) ? [{ label: "Last active", value: freshnessLabel(agent.lastActivity) }] : []),
    ...(hasPrice(agent) ? [{ label: "Price", value: priceLabel(agent) }] : []),
    ...(hasReviews ? [{ label: "Reviews", value: bnbReviewLabel(agent) }] : []),
  ];
  const canCheck = agent.executionStatus === "connectable";

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
            {canHire || canCheck ? (
              <Link href={`/bnb/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`} className="bnb-button bnb-focus">
                {canHire ? "Hire agent" : "Check availability"} <ArrowRight aria-hidden="true" size={16} />
              </Link>
            ) : (
              <Link href={`https://8004scan.io/agents/${agent.chainId}/${agent.tokenId}`} className="bnb-button bnb-focus" target="_blank" rel="noopener noreferrer">
                View identity <ArrowRight aria-hidden="true" size={16} />
              </Link>
            )}
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
            {description || visibleCapabilities.length > 0 ? (
              <section className="bnb-agent-section">
                <h2>Overview</h2>
                {description ? <p>{description}</p> : null}
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
                <div className="bnb-agent-services-wrap">
                  <table className="bnb-agent-services">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Price</th>
                        <th>Availability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleServices.map((service) => (
                        <tr key={`${service.name}:${service.type}`}>
                          <td>{bnbServiceLabel(service)}</td>
                          <td>{service.price || "Not listed"}</td>
                          <td>{service.endpoint ? "Ready" : bnbStatusLabel(agent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

            {integrations.length > 0 ? (
              <section className="bnb-agent-section">
                <h2>Integrations</h2>
                <ul className="bnb-agent-capability-list">
                  {integrations.map((integration) => (
                    <li key={integration}>{integration}</li>
                  ))}
                </ul>
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

            {(protocols.length > 0 || agent.x402Support || visibleServices.length > 0) ? (
              <details className="bnb-agent-section bnb-agent-technical-details">
                <summary>Protocol details</summary>
                <dl className="bnb-agent-identity-grid">
                  {protocols.length > 0 ? <DataRow label="Protocols" value={protocols.join(", ")} /> : null}
                  <DataRow label="Payment protocol" value={agent.x402Support ? "x402 supported" : "Not listed"} />
                  {visibleServices.length > 0 ? <DataRow label="Service endpoint" value={visibleServices.some((service) => service.endpoint) ? "Available" : "Not listed"} /> : null}
                </dl>
              </details>
            ) : null}
          </main>

          <aside className="bnb-agent-action-col">
            <section className="bnb-agent-action-card">
              <div>
                <span>{canHire ? "Ready to run" : canCheck ? "Connectable" : "Listed profile"}</span>
                <h2>{canHire ? "Hire this agent" : canCheck ? "Check this agent" : "Onchain identity"}</h2>
                <p>
                  {canHire
                    ? "Set the job, budget, and time limit before work starts."
                    : canCheck
                      ? "Hive will check the endpoint before creating a hire."
                      : "This agent is registered, but Hive has no supported endpoint to run it."}
                </p>
              </div>

              {canHire || canCheck ? (
                <Link href={`/bnb/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`} className="bnb-button bnb-focus">
                  {canHire ? "Hire agent" : "Check availability"} <ArrowRight aria-hidden="true" size={16} />
                </Link>
              ) : (
                <Link href={`https://8004scan.io/agents/${agent.chainId}/${agent.tokenId}`} className="bnb-button bnb-focus" target="_blank" rel="noopener noreferrer">
                  View identity <ArrowRight aria-hidden="true" size={16} />
                </Link>
              )}

              <ProfileCompareAction agent={agent} />
            </section>
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

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleCheck,
  CircleDashed,
  ExternalLink,
} from "lucide-react";
import { isAddress } from "viem";
import { CopyValueButton } from "@/app/bnb/_components/CopyValueButton";
import { BnbAgentAvatar } from "@/app/bnb/_components/BnbAgentAvatar";
import { BnbContainer, BnbShell, freshnessLabel, hasPrice, priceLabel, shortAddress } from "@/app/bnb/_components/BnbUi";
import { recordBnbAnalyticsEvent } from "@/lib/bnb/analytics";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { get8004scanAgentUrl, getBscExplorerAddressUrl } from "@/lib/bnb/chain";
import {
  bnbAgentDisplayName,
  bnbAgentIntegrations,
  bnbAgentSourceName,
  bnbCanHireAgent,
  bnbCategoryLabel,
  bnbIsVerified,
  bnbListingDescription,
  bnbReviewLabel,
  bnbServiceLabel,
  bnbSpecificCapabilities,
  bnbStatusLabel,
  bnbUsableServices,
} from "@/lib/bnb/display";
import { bnbAgentHirePath } from "@/lib/bnb/routes";
import type { BnbAgentProfile } from "@/lib/bnb/types";
import { ProfileActions } from "./ProfileCompareAction";
import { RequestAccessDialog } from "./RequestAccessDialog";
import styles from "./profile.module.css";

export default async function BnbAgentDetailPage({
  params,
}: {
  params: Promise<{ chainId: string; tokenId: string }>;
}) {
  const { chainId, tokenId } = await params;
  const agent = await getBnbAgent(chainId, tokenId);
  if (!agent) notFound();

  recordBnbAnalyticsEvent({
    name: "profile.view",
    route: "bnb.agents.detail",
    agent,
    metadata: {
      capabilityCount: agent.endpointCapabilities?.length || 0,
      endpointCount: agent.executionEndpoints?.length || 0,
      serviceCount: agent.services.length,
    },
  });

  const description = bnbListingDescription(agent);
  const canHire = bnbCanHireAgent(agent);
  const hasReviews = agent.feedback.count > 0;
  const displayName = bnbAgentDisplayName(agent);
  const sourceName = bnbAgentSourceName(agent);
  const visibleCapabilities = bnbSpecificCapabilities(agent).slice(0, 8);
  const visibleServices = bnbUsableServices(agent);
  const integrations = bnbAgentIntegrations(agent);
  const ownerAddress = isAddress(agent.ownerAddress) ? agent.ownerAddress : "";
  const agentWallet = isAddress(agent.agentWallet) ? agent.agentWallet : "";
  const identityUrl = externalAgentUrl(agent);
  const identityLabel = externalAgentLabel(agent);
  const verified = bnbIsVerified(agent);
  const lastActive = freshnessLabel(agent.lastActivity);
  const identityIdLabel = agent.sourceFreshness.source === "8004scan" ? "ERC-8004 ID" : "Source ID";
  const identityId = agent.sourceMetrics?.sourceAgentId || agent.tokenId;

  return (
    <BnbShell active="agents" variant="landing">
      <div className={styles.page}>
        <BnbContainer className={styles.container}>
          <Link href="/agents" className={styles.backLink}>
            <ArrowLeft aria-hidden="true" size={16} />
            All agents
          </Link>

          <div className={styles.workspace}>
            <main className={styles.dossier}>
              <header className={styles.profileHeader}>
                <div className={styles.metaLine}>
                  <span>{bnbCategoryLabel(agent.category)}</span>
                  {verified ? (
                    <span className={styles.verified}>
                      <BadgeCheck aria-hidden="true" size={16} />
                      Verified
                    </span>
                  ) : null}
                </div>
                <h1>{displayName}</h1>
                {description ? <p className={styles.description}>{description}</p> : null}
                <ProfileActions agent={agent} />
              </header>

              <section className={styles.availability} aria-labelledby="availability-heading">
                <div className={styles.availabilityCopy}>
                  {canHire ? (
                    <CircleCheck className={styles.availableIcon} aria-hidden="true" size={20} />
                  ) : (
                    <CircleDashed className={styles.profileIcon} aria-hidden="true" size={20} />
                  )}
                  <div>
                    <span id="availability-heading">{bnbStatusLabel(agent)}</span>
                    <p>{canHire ? "Can accept this type of work now." : "This identity is listed, but Hive cannot start a job with it."}</p>
                  </div>
                </div>
                <div className={styles.primaryAction}>
                  {canHire ? (
                    <Link href={bnbAgentHirePath(agent)}>
                      Hire agent <ArrowRight aria-hidden="true" size={16} />
                    </Link>
                  ) : (
                    <RequestAccessDialog agent={agent} className={styles.requestButton} />
                  )}
                </div>
              </section>

              <dl className={styles.factRow} aria-label="Agent facts">
                {lastActive ? <Fact label="Last active" value={lastActive} /> : null}
                {hasPrice(agent) ? <Fact label="Price" value={priceLabel(agent)} /> : null}
                {hasReviews ? <Fact label="Reviews" value={bnbReviewLabel(agent)} /> : null}
                <Fact label="Category" value={bnbCategoryLabel(agent.category)} />
              </dl>

              {visibleCapabilities.length > 0 ? (
                <ProfileSection title="What it does">
                  <ol className={styles.capabilityList}>
                    {visibleCapabilities.map((capability, index) => (
                      <li key={capability}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <p>{capability}</p>
                      </li>
                    ))}
                  </ol>
                </ProfileSection>
              ) : null}

              {visibleServices.length > 0 ? (
                <ProfileSection title="Services">
                  <dl className={styles.serviceList}>
                    {visibleServices.map((service, index) => (
                      <div key={`${service.name}:${service.type}:${index}`}>
                        <dt>{bnbServiceLabel(service)}</dt>
                        <dd>{service.price || "Available on request"}</dd>
                      </div>
                    ))}
                  </dl>
                </ProfileSection>
              ) : null}

              {hasReviews ? (
                <ProfileSection title="Track record">
                  <dl className={styles.trackRecord}>
                    <Fact label="Reviews" value={bnbReviewLabel(agent)} />
                    <Fact label="Positive" value={positiveFeedbackLabel(agent)} />
                    {lastActive ? <Fact label="Last active" value={lastActive} /> : null}
                  </dl>
                  {agent.feedback.summary ? <p className={styles.sectionCopy}>{agent.feedback.summary}</p> : null}
                </ProfileSection>
              ) : null}

              {integrations.length > 0 ? (
                <ProfileSection title="Connections">
                  <ul className={styles.integrationList}>
                    {integrations.map((integration) => <li key={integration}>{integration}</li>)}
                  </ul>
                </ProfileSection>
              ) : null}
            </main>

            <aside className={styles.identityRail} aria-label="Agent identity">
              <BnbAgentAvatar agent={agent} className={styles.monogram} size={48} />
              <div className={styles.railHeading}>
                <span>Agent identity</span>
                <strong>{displayName}</strong>
                {sourceName ? <p>{sourceName}</p> : null}
              </div>

              <dl className={styles.identityList}>
                <IdentityRow label="Network" value="BNB Smart Chain" />
                <IdentityRow label={identityIdLabel} value={identityId} />
                {ownerAddress ? <IdentityRow label="Wallet owner" value={shortAddress(ownerAddress)} copyValue={ownerAddress} /> : null}
                {agentWallet ? <IdentityRow label="Agent wallet" value={shortAddress(agentWallet)} copyValue={agentWallet} /> : null}
              </dl>

              {identityUrl || agentWallet ? (
                <div className={styles.externalLinks}>
                  {identityUrl ? <ExternalProfileLink href={identityUrl}>{identityLabel}</ExternalProfileLink> : null}
                  {agentWallet ? <ExternalProfileLink href={getBscExplorerAddressUrl(agentWallet)}>BscScan</ExternalProfileLink> : null}
                </div>
              ) : null}
            </aside>
          </div>
        </BnbContainer>
      </div>
    </BnbShell>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function IdentityRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        {copyValue ? <CopyValueButton value={copyValue} label={label.toLowerCase()} /> : null}
      </dd>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ExternalProfileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ExternalLink aria-hidden="true" size={14} />
    </a>
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

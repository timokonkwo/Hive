import Link from "next/link";
import { ArrowRight, ExternalLink, Search, WalletCards } from "lucide-react";
import { isAddress } from "viem";
import { CopyValueButton } from "@/app/bnb/_components/CopyValueButton";
import { BnbContainer, BnbShell, freshnessLabel, shortAddress } from "@/app/bnb/_components/BnbUi";
import { get8004scanAgentUrl, getBscAddressSummary } from "@/lib/bnb/chain";
import { listBnbAgents } from "@/lib/bnb/catalog";
import { bnbAgentDisplayName, bnbListingDescription } from "@/lib/bnb/display";
import { canHireBnbAgent } from "@/lib/bnb/runtime";
import type { BnbAgentProfile } from "@/lib/bnb/types";
import styles from "./status.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BnbStatusPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (paramValue(params.q) || paramValue(params.address) || "").trim();
  const addressQuery = isAddress(query);
  const [summary, agents] = await Promise.all([
    addressQuery ? getBscAddressSummary(query) : Promise.resolve(null),
    query ? listBnbAgents({ q: query, limit: 20, sort: "recommended" }) : Promise.resolve([]),
  ]);
  const exactAgent = findExactAgent(agents, query);
  const candidates = exactAgent ? [] : agents.slice(0, 6);

  return (
    <BnbShell active="verify" variant="landing">
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <BnbContainer>
            <span>Verify</span>
            <h1>Verify an agent or wallet</h1>
            <p>Check identity, availability, and BNB Chain activity.</p>
          </BnbContainer>
        </header>

        <BnbContainer className={styles.body}>
          <form action="/bnb/status" className={styles.searchForm}>
            <label htmlFor="verify-query">Agent name, token ID, or BNB address</label>
            <div className={styles.searchControl}>
              <Search aria-hidden="true" size={18} />
              <input
                id="verify-query"
                name="q"
                defaultValue={query}
                type="search"
                autoComplete="off"
                spellCheck={false}
                placeholder="Search agents or paste 0x..."
              />
              <button type="submit" className="bnb-button bnb-focus">Verify</button>
            </div>
          </form>

          {exactAgent ? <AgentEvidence agent={exactAgent} /> : null}

          {summary ? <AddressEvidence summary={summary} matchedAgent={exactAgent} /> : null}

          {candidates.length > 0 ? <CandidateResults agents={candidates} query={query} /> : null}

          {query && !exactAgent && candidates.length === 0 && !summary ? <NoResult query={query} /> : null}
        </BnbContainer>
      </div>
    </BnbShell>
  );
}

function AgentEvidence({ agent }: { agent: BnbAgentProfile }) {
  const hireable = canHireBnbAgent(agent);
  const sourceUrl = externalAgentUrl(agent);
  const profileHref = `/bnb/agents/${agent.chainId}/${encodeURIComponent(agent.tokenId)}`;

  return (
    <article className={styles.result} aria-labelledby="agent-evidence-title">
      <header className={styles.resultHeader}>
        <div>
          <span className={styles.eyebrow}>Agent identity</span>
          <h2 id="agent-evidence-title">{bnbAgentDisplayName(agent)}</h2>
          {bnbListingDescription(agent) ? <p>{bnbListingDescription(agent)}</p> : null}
        </div>
        <span className={styles.availability} data-available={hireable}>
          {hireable ? "Available" : "Profile only"}
        </span>
      </header>

      <div className={styles.evidenceGrid}>
        <EvidenceGroup title="Identity">
          <DataRow label={agent.sourceFreshness.source === "8004scan" ? "ERC-8004 ID" : "Source ID"} value={agent.tokenId} />
          <DataRow label="Category" value={agent.category} />
          <DataRow label="Last active" value={freshnessLabel(agent.lastActivity)} />
        </EvidenceGroup>
        <EvidenceGroup title="Ownership">
          {isAddress(agent.ownerAddress) ? <DataRow label="Wallet owner" value={shortAddress(agent.ownerAddress)} copyValue={agent.ownerAddress} /> : <DataRow label="Wallet owner" value="Not published" />}
          {isAddress(agent.agentWallet) ? <DataRow label="Agent wallet" value={shortAddress(agent.agentWallet)} copyValue={agent.agentWallet} /> : <DataRow label="Agent wallet" value="Not published" />}
        </EvidenceGroup>
        <EvidenceGroup title="Availability">
          <DataRow label="Can accept work" value={hireable ? "Yes" : "No"} />
        </EvidenceGroup>
      </div>

      <footer className={styles.resultActions}>
        <Link href={profileHref} className="bnb-button-dark bnb-focus">View profile</Link>
        {hireable ? <Link href={`/bnb/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`} className="bnb-button bnb-focus">Hire agent</Link> : null}
        {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className={styles.sourceLink}>View source <ExternalLink aria-hidden="true" size={14} /></a> : null}
      </footer>
    </article>
  );
}

function AddressEvidence({
  summary,
  matchedAgent,
}: {
  summary: Awaited<ReturnType<typeof getBscAddressSummary>>;
  matchedAgent?: BnbAgentProfile;
}) {
  return (
    <section className={styles.addressResult} aria-labelledby="address-evidence-title">
      <header>
        <div className={styles.addressTitle}>
          <span className={styles.addressIcon} aria-hidden="true"><WalletCards size={18} /></span>
          <div>
            <span className={styles.eyebrow}>BNB Chain address</span>
            <h2 id="address-evidence-title">{summary.accountType === "contract" ? "Contract" : "Wallet"}</h2>
          </div>
        </div>
        <CopyValueButton value={summary.address} label="address" />
      </header>
      <p className={styles.fullAddress}>{summary.address}</p>
      {summary.error ? <p className={styles.dataError} role="status">BNB Chain data could not be loaded. Try again.</p> : null}
      <dl className={styles.addressFacts}>
        <DataRow label="Network" value="BNB Smart Chain" />
        <DataRow label="Balance" value={summary.balanceBNB ? `${summary.balanceBNB} BNB` : "Unavailable"} />
        <DataRow label="Transactions" value={typeof summary.transactionCount === "number" ? String(summary.transactionCount) : "Unavailable"} />
        <DataRow label="Marketplace agent" value={matchedAgent ? bnbAgentDisplayName(matchedAgent) : "No exact match"} />
      </dl>
      <a href={summary.explorerUrl} target="_blank" rel="noreferrer" className={styles.sourceLink}>Open on BscScan <ExternalLink aria-hidden="true" size={14} /></a>
    </section>
  );
}

function CandidateResults({ agents, query }: { agents: BnbAgentProfile[]; query: string }) {
  return (
    <section className={styles.candidates} aria-labelledby="candidate-results-title">
      <div className={styles.sectionTitle}>
        <div>
          <span className={styles.eyebrow}>Search results</span>
          <h2 id="candidate-results-title">Matching agents</h2>
        </div>
        <span>{agents.length} shown</span>
      </div>
      <div className={styles.candidateList}>
        {agents.map((agent) => {
          const hireable = canHireBnbAgent(agent);
          return (
            <article key={`${agent.chainId}:${agent.tokenId}`}>
              <div>
                <h3>{bnbAgentDisplayName(agent)}</h3>
                <p>{agent.category} · ID {agent.tokenId}</p>
              </div>
              <span className={styles.availability} data-available={hireable}>{hireable ? "Available" : "Profile only"}</span>
              <Link href={`/bnb/status?q=${encodeURIComponent(agent.tokenId)}`} className="bnb-focus" aria-label={`Verify ${bnbAgentDisplayName(agent)}`}>
                Verify <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </article>
          );
        })}
      </div>
      <Link href={`/bnb/agents?q=${encodeURIComponent(query)}`} className={styles.allResults}>View all marketplace results <ArrowRight aria-hidden="true" size={15} /></Link>
    </section>
  );
}

function NoResult({ query }: { query: string }) {
  return (
    <section className={styles.noResult}>
      <h2>No exact match</h2>
      <p>No marketplace agent matched “{query}”. Check the spelling or browse the directory.</p>
      <Link href="/bnb/agents" className="bnb-button-dark bnb-focus">Browse agents</Link>
    </section>
  );
}

function EvidenceGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3>{title}</h3><dl>{children}</dl></section>;
}

function DataRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  return (
    <div className={styles.dataRow}>
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        {copyValue ? <CopyValueButton value={copyValue} label={label.toLowerCase()} /> : null}
      </dd>
    </div>
  );
}

function findExactAgent(agents: BnbAgentProfile[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return agents.find((agent) => [
    agent.tokenId,
    agent.ownerAddress,
    agent.agentWallet,
    bnbAgentDisplayName(agent),
  ].some((value) => value?.trim().toLowerCase() === normalizedQuery));
}

function externalAgentUrl(agent: BnbAgentProfile) {
  if (agent.sourceFreshness.source === "8004scan") return get8004scanAgentUrl(agent.chainId, agent.tokenId);
  return safeExternalUrl(agent.metadataUri || agent.executionEndpoints?.[0]?.url || agent.services.find((service) => service.endpoint)?.endpoint || "");
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

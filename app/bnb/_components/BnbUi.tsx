import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { BnbAccountButton } from "@/app/bnb/_components/BnbAccountButton";
import type { BnbAgentCategory, BnbAgentProfile, BnbPartnerTrackSummary } from "@/lib/bnb/types";

const categoryLabels: Record<BnbAgentCategory, string> = {
  Rebalancing: "Rebalancing",
  "Grid Trading": "Grid Trading",
  "Yield Optimisation": "Yield Optimisation",
  "Health Factor Monitoring": "Health Factor",
};

type BnbNavItem = "home" | "agents" | "verify" | "account";

export function BnbShell({ children, active = "home" }: { children: ReactNode; active?: BnbNavItem }) {
  return (
    <main className="bnb-shell">
      <div className="bnb-frame">
        <header className="bnb-header">
          <BnbContainer className="bnb-header-inner">
            <Brand />
            <nav className="bnb-nav" aria-label="Hive navigation">
              <BnbNavLink href="/bnb/agents" active={active === "agents"}>Agents</BnbNavLink>
              <BnbNavLink href="/bnb/status" active={active === "verify"}>Verify</BnbNavLink>
            </nav>
            <div className="bnb-header-actions">
              <BnbAccountButton active={active === "account"} />
              <Link href="/bnb/match" className="bnb-button bnb-button-secondary bnb-focus">
                <span className="bnb-desktop-label">Hire agent</span>
                <span className="bnb-mobile-label">Hire</span>
              </Link>
            </div>
          </BnbContainer>
        </header>
        <div className="bnb-main">
          {children}
        </div>
        <Footer />
      </div>
    </main>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="bnb-brand bnb-focus">
      <span className="bnb-brand-mark">
        <Image src="/images/hive-icon.svg" width={22} height={22} alt="" priority />
      </span>
      <span className="bnb-brand-copy">
        <span className="bnb-brand-name">Hive</span>
        {!compact ? <span className="bnb-brand-context">BNB Chain</span> : null}
      </span>
    </Link>
  );
}

function BnbNavLink({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <Link href={href} className="bnb-nav-link bnb-focus" data-active={active ? "true" : undefined}>
      {children}
    </Link>
  );
}

export function BnbContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bnb-container ${className}`}>{children}</div>;
}

export function BnbHero({
  title,
  body,
  kicker = "Hive",
  children,
}: {
  title: string;
  body: string;
  kicker?: string | null;
  children?: ReactNode;
}) {
  return (
    <section className="bnb-hero">
      <BnbContainer className={`bnb-hero-inner ${children ? "bnb-hero-grid" : ""}`}>
        <div>
          {kicker ? (
            <div className="bnb-kicker">
              <span>{kicker}</span>
            </div>
          ) : null}
          <h1 className={`bnb-title ${!kicker ? "bnb-title-no-kicker" : ""}`}>{title}</h1>
          <p className="bnb-body">{body}</p>
        </div>
        {children ? <div>{children}</div> : null}
      </BnbContainer>
    </section>
  );
}

export function BnbPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bnb-panel ${className}`}>{children}</div>;
}

export function BnbSectionHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="bnb-section-header">
      <div>
        {eyebrow ? <div className="bnb-eyebrow">{eyebrow}</div> : null}
        <h2 className="bnb-heading">{title}</h2>
        {body ? <p className="bnb-copy">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CategoryChip({ category }: { category: BnbAgentCategory }) {
  return <span className="bnb-chip">{categoryLabels[category]}</span>;
}

export function StatusBadge({ agent }: { agent: BnbAgentProfile }) {
  const label = statusLabel(agent);
  return <span className={`bnb-chip ${agent.activationStatus === "callable" ? "bnb-chip-active" : ""}`}>{label}</span>;
}

export function AgentCard({ agent }: { agent: BnbAgentProfile }) {
  const price = priceLabel(agent);
  const canHire = canHireAgent(agent);
  const description = listingDescription(agent);

  return (
    <article className="bnb-agent-row">
      <div className="bnb-agent-main">
        <h3 className="bnb-agent-name">
          <Link href={`/bnb/agents/${agent.chainId}/${encodeURIComponent(agent.tokenId)}`} className="bnb-focus">
            {agent.name}
          </Link>
          {agent.sourceFreshness.source === "8004scan" ? (
            <BadgeCheck aria-label="ERC-8004 identity verified" className="bnb-verified-mark" size={16} />
          ) : null}
        </h3>
        <p className="bnb-agent-meta">{categoryLabels[agent.category]} · {statusLabel(agent)}</p>
        {description ? <p className="bnb-agent-description">{description}</p> : null}
        <div className="bnb-agent-facts">
          <span>{freshnessLabel(agent.lastActivity)}</span>
          {agent.feedback.count > 0 ? <span>{reviewLabel(agent)}</span> : null}
          {hasPrice(agent) ? <span>{price}</span> : null}
        </div>
      </div>
      <div className="bnb-agent-side">
        <Link href={`/bnb/agents/${agent.chainId}/${encodeURIComponent(agent.tokenId)}`} className="bnb-button-dark bnb-focus">
          View profile
        </Link>
        {canHire ? (
          <Link href={`/bnb/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`} className="bnb-button-dark bnb-focus">
            Hire
          </Link>
        ) : (
          <Link href={`/bnb/agents/${agent.chainId}/${encodeURIComponent(agent.tokenId)}#request-access`} className="bnb-button-dark bnb-focus">
            Request access
          </Link>
        )}
      </div>
    </article>
  );
}

export function PartnerTrackCard({ track }: { track: BnbPartnerTrackSummary }) {
  return (
    <Link href={track.href} className="bnb-panel block p-4 text-inherit no-underline bnb-focus">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-500">{track.name}</div>
          <h3 className="mt-2 text-lg font-semibold leading-snug text-white">{track.productFit}</h3>
        </div>
        <ArrowRight aria-hidden="true" size={16} className="mt-1 shrink-0 text-zinc-500" />
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{track.userProblem}</p>
    </Link>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="bnb-empty-state">
      <BarChart3 aria-hidden="true" size={28} />
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

export function ExternalTextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-emerald-300 underline-offset-4 hover:underline">
      {children}
      <ExternalLink aria-hidden="true" size={14} />
    </a>
  );
}

export function shortAddress(address: string) {
  if (!address || address === "Unknown") return "Unknown";
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

export function freshnessLabel(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Needs verification";
  const days = Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function priceLabel(agent: BnbAgentProfile) {
  return agent.services.find((service) => service.price)?.price || "";
}

export function hasPrice(agent: BnbAgentProfile) {
  return Boolean(agent.services.find((service) => service.price));
}

export function reviewLabel(agent: BnbAgentProfile) {
  if (agent.feedback.count <= 0) return "";
  if (agent.feedback.positive === agent.feedback.count) return `${agent.feedback.count} positive`;
  return `${agent.feedback.positive} of ${agent.feedback.count} positive`;
}

export function canHireAgent(agent: BnbAgentProfile) {
  return agent.activationStatus === "callable" && /^0x[a-fA-F0-9]{40}$/.test(agent.agentWallet);
}

export function statusLabel(agent: BnbAgentProfile) {
  if (agent.activationStatus === "callable") return "Available";
  if (agent.activationStatus === "request") return "Request access";
  return "Unavailable";
}

export function listingDescription(agent: BnbAgentProfile) {
  const description = agent.description.trim();
  const generatedFallbacks = [
    "ERC-8004 BSC agent indexed through 8004scan.",
    "Configured BSC agent.",
  ];

  if (generatedFallbacks.includes(description)) return "";
  if (/^[\w.-]+\.agent on TermiX Platform$/i.test(description)) return "";
  return description;
}

export function getAgentIntegrations(agent: BnbAgentProfile) {
  const haystack = [
    agent.category,
    agent.capabilities.join(" "),
    agent.services.map((service) => `${service.name} ${service.type}`).join(" "),
  ].join(" ").toLowerCase();
  const integrations: string[] = [];

  if (haystack.includes("pancake")) integrations.push("PancakeSwap");
  if (haystack.includes("altana") || (agent.a2aSupport && (haystack.includes("wallet") || haystack.includes("health")))) {
    integrations.push("Altana");
  }

  return Array.from(new Set(integrations));
}

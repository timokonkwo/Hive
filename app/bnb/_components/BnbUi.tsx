import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  ExternalLink,
  Github,
  Twitter,
} from "lucide-react";
import { BnbAccountButton } from "@/app/bnb/_components/BnbAccountButton";
import type { BnbAgentCategory, BnbAgentProfile, BnbPartnerTrackSummary } from "@/lib/bnb/types";
import {
  bnbAgentDisplayName,
  bnbAgentIntegrations,
  bnbCanHireAgent,
  bnbCategoryLabel,
  bnbCategoryLabels,
  bnbFreshnessLabel,
  bnbHasPrice,
  bnbIsVerified,
  bnbListingDescription,
  bnbPriceLabel,
  bnbReviewLabel,
  bnbStatusLabel,
} from "@/lib/bnb/display";
import { bnbAgentHirePath, bnbAgentProfilePath } from "@/lib/bnb/routes";

type BnbNavItem = "home" | "agents" | "activity" | "verify" | "account";

export function BnbShell({
  children,
  active = "home",
  variant = "default",
  back,
}: {
  children: ReactNode;
  active?: BnbNavItem;
  variant?: "default" | "landing";
  back?: {
    href: string;
    label: string;
  };
}) {
  return (
    <div className={`bnb-shell ${variant === "landing" ? "bnb-shell-home" : ""}`}>
      <div className="bnb-frame">
        <header className="bnb-header">
          <BnbContainer className="bnb-header-inner">
            <Brand />
            <nav className="bnb-nav" aria-label="Hive navigation">
              <BnbNavLink href="/agents" active={active === "agents"}>Agents</BnbNavLink>
              <BnbNavLink href="/activity" active={active === "activity"}>Activity</BnbNavLink>
              <BnbNavLink href="/status" active={active === "verify"}>Verify</BnbNavLink>
            </nav>
            <div className="bnb-header-actions">
              <BnbAccountButton active={active === "account"} />
            </div>
          </BnbContainer>
        </header>
        {back ? (
          <nav className="bnb-back-nav" aria-label="Back navigation">
            <BnbContainer className="bnb-back-nav-inner">
              <Link href={back.href} className="bnb-back-link bnb-focus">
                <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
                {back.label}
              </Link>
            </BnbContainer>
          </nav>
        ) : null}
        <main className="bnb-main" id="main-content">
          {children}
        </main>
        <BnbFooter />
      </div>
    </div>
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

export function BnbPageHeader({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <section className="bnb-page-header">
      <BnbContainer className="bnb-page-header-inner">
        <div>
          <h1>{title}</h1>
          {body ? <p>{body}</p> : null}
        </div>
        {action ? <div className="bnb-page-header-action">{action}</div> : null}
      </BnbContainer>
    </section>
  );
}

export function BnbPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bnb-panel ${className}`}>{children}</div>;
}

function BnbFooter() {
  return (
    <footer className="bnb-footer">
      <BnbContainer className="bnb-footer-inner">
        <div className="bnb-footer-brand">
          <Link href="/" className="bnb-brand bnb-focus">
            <span className="bnb-brand-mark">
              <Image src="/images/hive-icon.svg" width={22} height={22} alt="" />
            </span>
            <span className="bnb-brand-copy">
              <span className="bnb-brand-name">Hive</span>
              <span className="bnb-brand-context">BNB Chain</span>
            </span>
          </Link>
          <p>Find, hire, and track BNB Chain agents from one workspace.</p>
        </div>

        <nav className="bnb-footer-links" aria-label="BNB footer navigation">
          <div>
            <h2>Marketplace</h2>
            <Link href="/agents" className="bnb-focus">Agents</Link>
            <Link href="/activity" className="bnb-focus">Activity</Link>
            <Link href="/status" className="bnb-focus">Verify</Link>
          </div>
          <div>
            <h2>Hive</h2>
            <Link href="/" className="bnb-focus">Main site</Link>
            <Link href="/docs" className="bnb-focus">Docs</Link>
            <Link href="/feedback" className="bnb-focus">Feedback</Link>
          </div>
        </nav>

        <div className="bnb-footer-social">
          <a href="https://x.com/uphivexyz" target="_blank" rel="noopener noreferrer" className="bnb-icon-button bnb-focus" aria-label="Hive on X">
            <Twitter aria-hidden="true" size={16} />
          </a>
          <a href="https://github.com/timokonkwo/Hive" target="_blank" rel="noopener noreferrer" className="bnb-icon-button bnb-focus" aria-label="Hive on GitHub">
            <Github aria-hidden="true" size={16} />
          </a>
        </div>
      </BnbContainer>
      <BnbContainer className="bnb-footer-bottom">
        <span>&copy; {new Date().getFullYear()} Hive Protocol.</span>
      </BnbContainer>
    </footer>
  );
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
  return <span className="bnb-chip">{bnbCategoryLabels[category]}</span>;
}

export function StatusBadge({ agent }: { agent: BnbAgentProfile }) {
  const label = statusLabel(agent);
  return <span className={`bnb-chip ${canHireAgent(agent) ? "bnb-chip-active" : ""}`}>{label}</span>;
}

export function AgentCard({ agent }: { agent: BnbAgentProfile }) {
  const price = priceLabel(agent);
  const description = listingDescription(agent);
  const displayName = bnbAgentDisplayName(agent);
  const canHire = canHireAgent(agent);

  return (
    <article className="bnb-agent-row">
      <div className="bnb-agent-main">
        <h3 className="bnb-agent-name">
          <Link href={bnbAgentProfilePath(agent)} className="bnb-focus">
            {displayName}
          </Link>
          {bnbIsVerified(agent) ? (
            <BadgeCheck aria-label="ERC-8004 identity verified" className="bnb-verified-mark" size={16} />
          ) : null}
        </h3>
        <p className="bnb-agent-meta">{bnbCategoryLabel(agent.category)} · {statusLabel(agent)}</p>
        {description ? <p className="bnb-agent-description">{description}</p> : null}
        <div className="bnb-agent-facts">
          {freshnessLabel(agent.lastActivity) ? <span>{freshnessLabel(agent.lastActivity)}</span> : null}
          {agent.feedback.count > 0 ? <span>{reviewLabel(agent)}</span> : null}
          {hasPrice(agent) ? <span>{price}</span> : null}
        </div>
      </div>
      <div className="bnb-agent-side">
        <Link href={bnbAgentProfilePath(agent)} className="bnb-button-dark bnb-focus">
          View profile
        </Link>
        {canHire ? (
          <Link href={bnbAgentHirePath(agent)} className="bnb-button bnb-focus">
            Hire
          </Link>
        ) : null}
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
  return bnbFreshnessLabel(value);
}

export function priceLabel(agent: BnbAgentProfile) {
  return bnbPriceLabel(agent);
}

export function hasPrice(agent: BnbAgentProfile) {
  return bnbHasPrice(agent);
}

export function reviewLabel(agent: BnbAgentProfile) {
  return bnbReviewLabel(agent);
}

export function canHireAgent(agent: BnbAgentProfile) {
  return bnbCanHireAgent(agent);
}

export function statusLabel(agent: BnbAgentProfile) {
  return bnbStatusLabel(agent);
}

export function listingDescription(agent: BnbAgentProfile) {
  return bnbListingDescription(agent);
}

export function getAgentIntegrations(agent: BnbAgentProfile) {
  return bnbAgentIntegrations(agent);
}

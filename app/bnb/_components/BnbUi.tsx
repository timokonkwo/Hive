import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock3,
  ExternalLink,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import type { BnbAgentCategory, BnbAgentProfile, BnbPartnerTrackSummary, BnbScoreBreakdown } from "@/lib/bnb/types";

const categoryLabels: Record<BnbAgentCategory, string> = {
  Rebalancing: "Rebalancing",
  "Grid Trading": "Grid trading",
  "Yield Optimisation": "Yield",
  "Health Factor Monitoring": "Risk watch",
};

export function BnbShell({ children }: { children: ReactNode }) {
  return (
    <main className="bnb-shell">
      <div className="bnb-frame">
        <header className="bnb-header">
          <BnbContainer className="bnb-header-inner">
            <Brand />
            <nav className="bnb-nav" aria-label="Hive navigation">
              <BnbNavLink href="/bnb/agents">Agents</BnbNavLink>
              <BnbNavLink href="/bnb/match">Hire</BnbNavLink>
              <BnbNavLink href="/bnb/report">Receipts</BnbNavLink>
              <BnbNavLink href="/bnb/status">BSC</BnbNavLink>
            </nav>
            <Link href="/bnb/match" className="bnb-button bnb-focus">
              Hire agent
            </Link>
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
    <Link href="/bnb" className="bnb-brand bnb-focus">
      <span className="bnb-brand-mark">
        <Image src="/images/hive-icon.svg" width={22} height={22} alt="" priority />
      </span>
      <span>
        <span className="block text-sm font-medium">Hive</span>
        {!compact ? <span className="block text-xs text-zinc-500">Agent marketplace</span> : null}
      </span>
    </Link>
  );
}

function BnbNavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="bnb-nav-link bnb-focus">
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
  kicker?: string;
  children?: ReactNode;
}) {
  return (
    <section className="bnb-hero">
      <BnbContainer className={`bnb-hero-inner ${children ? "bnb-hero-grid" : ""}`}>
        <div>
          <div className="bnb-kicker">
            <span>{kicker}</span>
          </div>
          <h1 className="bnb-title">{title}</h1>
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
  const label = agent.activationStatus === "callable" ? "Ready" : agent.activationStatus === "request" ? "Ask first" : "Listed";
  return <span className={`bnb-chip ${agent.activationStatus === "callable" ? "bnb-chip-active" : ""}`}>{label}</span>;
}

export function AgentCard({ agent }: { agent: BnbAgentProfile }) {
  const score = agent.scoreBreakdown?.total || 0;
  const price = agent.services.find((service) => service.price)?.price || "Price set by agent";

  return (
    <article className="bnb-agent-row">
      <div>
        <div className="flex flex-wrap gap-2">
          <CategoryChip category={agent.category} />
          <StatusBadge agent={agent} />
        </div>
        <h3 className="mt-3 text-xl font-semibold text-white">{agent.name}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{agent.description}</p>
        <div className="mt-4 grid gap-2 text-sm text-zinc-500 sm:grid-cols-3">
          <InlineData icon={WalletCards} label="Price" value={price} />
          <InlineData icon={Activity} label="Feedback" value={`${agent.feedback.positive}/${agent.feedback.count}`} />
          <InlineData icon={Clock3} label="Freshness" value={freshnessLabel(agent.lastActivity)} />
        </div>
      </div>
      <div className="bnb-score">
        <div className="bnb-score-value">{score}</div>
        <div className="text-xs text-zinc-500">Score</div>
        <Link href={`/bnb/activate?chainId=${agent.chainId}&tokenId=${agent.tokenId}`} className="bnb-button bnb-focus mt-3">
          Hire
        </Link>
        <Link href={`/bnb/agents/${agent.chainId}/${agent.tokenId}`} className="bnb-text-action bnb-focus">
          Details
        </Link>
      </div>
    </article>
  );
}

function InlineData({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon aria-hidden="true" size={14} />
      <span>{label}</span>
      <span className="bnb-mono text-zinc-200">{value}</span>
    </div>
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

export function ScoreGrid({ score }: { score?: BnbScoreBreakdown }) {
  if (!score) return null;
  const rows = [
    ["Fit", score.fit, 35],
    ["Trust", score.trust, 25],
    ["Hire flow", score.activation, 20],
    ["Activity", score.activity, 10],
    ["Risk", score.risk, 10],
  ] as const;

  return (
    <div className="grid gap-3">
      {rows.map(([label, value, max]) => (
        <div key={label}>
          <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
            <span>{label}</span>
            <span className="bnb-mono text-zinc-200">{value}/{max}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, Math.round((value / max) * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="bnb-panel p-8 text-center">
      <BarChart3 aria-hidden="true" size={28} className="mx-auto text-zinc-500" />
      <h2 className="mt-4 text-xl font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-400">{body}</p>
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
  if (!Number.isFinite(time)) return "Needs check";
  const days = Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

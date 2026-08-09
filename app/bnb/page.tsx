import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  FileText,
  Grid3X3,
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { formatBnbAgentCount, getBnbAgentNetworkStats, getBnbCategories, listBnbAgents } from "@/lib/bnb/catalog";
import {
  AgentCard,
  BnbContainer,
  BnbPanel,
  BnbShell,
} from "@/app/bnb/_components/BnbUi";
import type { BnbAgentCategory, BnbAgentProfile } from "@/lib/bnb/types";

export const dynamic = "force-dynamic";

const categoryDetails: Record<BnbAgentCategory, { title: string; body: string; icon: LucideIcon }> = {
  Rebalancing: {
    title: "Rebalancing",
    body: "Adjust LP ranges and rebalance positions.",
    icon: RefreshCcw,
  },
  "Grid Trading": {
    title: "Grid Trading",
    body: "Run rule-based grid trading strategies.",
    icon: Grid3X3,
  },
  "Yield Optimisation": {
    title: "Yield Optimisation",
    body: "Find and compare yield opportunities across BNB Chain.",
    icon: TrendingUp,
  },
  "Health Factor Monitoring": {
    title: "Health Factor",
    body: "Monitor lending positions and liquidation risk.",
    icon: BellRing,
  },
};

export default async function BnbHomePage() {
  const [agents, networkStats] = await Promise.all([
    listBnbAgents({ limit: 100, sort: "reviews" }),
    getBnbAgentNetworkStats(),
  ]);
  const categories = getBnbCategories();
  const reviewedAgents = agents.filter((agent) => agent.feedback.count > 0);
  const recommendedAgents = (reviewedAgents.length >= 3 ? reviewedAgents : agents)
    .filter(isClearRecommendation)
    .slice(0, 6);
  const bscAgentCount = formatBnbAgentCount(networkStats.totalAgents);

  return (
    <BnbShell active="home">
      <BnbContainer className="bnb-workspace">
        <section className="bnb-home-hero">
          <div className="bnb-home-copy">
            <div className="bnb-kicker bnb-kicker-neutral">BNB Agent Marketplace</div>
            <h1 className="bnb-title">Find the right agent for the job</h1>
            <p className="bnb-body">
              Browse agents built for BNB Chain. Compare what they do, what they charge, how recently they were active, and how they are registered onchain.
            </p>
            <div className="bnb-market-facts" aria-label="BNB agent marketplace coverage">
              <span>{bscAgentCount} registered on BSC</span>
            </div>
          </div>

          <form action="/bnb/match" className="bnb-task-composer">
            <label className="bnb-task-field">
              <span>What do you need help with?</span>
              <div className="bnb-task-input-row">
                <Search aria-hidden="true" size={18} />
                <input
                  name="intent"
                  type="search"
                  placeholder="Describe the task or strategy"
                  autoComplete="off"
                  className="bnb-task-input"
                />
              </div>
            </label>
            <button type="submit" className="bnb-button bnb-focus">
              Search agents
            </button>
          </form>
        </section>

        <section className="bnb-section-tight">
          <div className="bnb-section-header">
            <div>
              <h2 className="bnb-heading">Browse by task</h2>
              <p className="bnb-copy">Choose a category to see relevant agents.</p>
            </div>
          </div>
          <div className="bnb-category-grid">
            {categories.map((category) => (
              <CategoryCard
                key={category}
                category={category}
              />
            ))}
          </div>
        </section>

        <section className="bnb-section-tight">
          <div className="bnb-list-head">
            <div>
              <h2>Recommended agents</h2>
              <p>Agents with useful public details.</p>
            </div>
            <Link href="/bnb/agents" className="bnb-text-action bnb-focus">
              View all agents <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>

          <BnbPanel className="overflow-hidden">
            {recommendedAgents.length > 0 ? (
              recommendedAgents.map((agent) => (
                <AgentCard key={`${agent.chainId}:${agent.tokenId}`} agent={agent} />
              ))
            ) : (
              <div className="bnb-empty-state">
                <ShieldCheck aria-hidden="true" size={28} />
                <h2>Open the agent directory</h2>
                <p>Search the full BNB agent index by task, capability, availability, and activity.</p>
                <Link href="/bnb/agents" className="bnb-button-dark bnb-focus">Browse agents</Link>
              </div>
            )}
          </BnbPanel>
        </section>

        <section className="bnb-section-tight bnb-grid bnb-grid-3">
          <InfoCard
            icon={Search}
            title="Find an agent"
            body="Search by task, category, capability, or agent name."
          />
          <InfoCard
            icon={WalletCards}
            title="Set the job terms"
            body="Define the work, budget, time limit, and permissions before the agent starts."
          />
          <InfoCard
            icon={FileText}
            title="Review the result"
            body="Hive keeps the hire record, payment details, agent output, and final status in one place."
          />
        </section>

        <section className="bnb-section-tight">
          <BnbPanel className="bnb-ecosystem-panel">
            <div>
              <h2 className="bnb-heading">Connected to the BNB ecosystem</h2>
              <p className="bnb-copy">
                Hive brings agent identity, trading tools, wallet permissions, and work history into the hiring flow.
              </p>
            </div>
            <div className="bnb-capability-grid">
              <Capability title="PancakeSwap" body="Find agents that work with pools, farms, liquidity positions, swaps, and routing." />
              <Capability title="Altana" body="Give agents scoped wallet permissions with spending limits and expiry controls." />
              <Capability title="8004scan" body="Check ERC-8004 registration, identity, and activity data." />
              <Capability title="Agent performance" body="Review time, cost, and completed work when that information is available from past hires." />
            </div>
          </BnbPanel>
        </section>
      </BnbContainer>
    </BnbShell>
  );
}

function isClearRecommendation(agent: BnbAgentProfile) {
  const description = agent.description.trim().toLowerCase();
  if (!agent.name || agent.name === `Agent #${agent.tokenId}`) return false;
  if (!description) return false;
  if (description.includes("limited data available")) return false;
  if (description.includes("placeholder") || description.includes("mock account")) return false;
  if (description === "erc-8004 bsc agent indexed through 8004scan.") return false;
  if (/^[\w.-]+\.agent on termix platform$/i.test(agent.description.trim())) return false;
  return true;
}

function CategoryCard({ category }: { category: BnbAgentCategory }) {
  const detail = categoryDetails[category];
  const Icon = detail.icon;

  return (
    <Link href={`/bnb/agents?category=${encodeURIComponent(category)}`} className="bnb-category-card bnb-focus">
      <span className="bnb-category-icon">
        <Icon aria-hidden="true" size={18} />
      </span>
      <span>
        <strong>{detail.title}</strong>
        <span>{detail.body}</span>
      </span>
      <em>Browse agents <ArrowRight aria-hidden="true" size={13} /></em>
    </Link>
  );
}

function InfoCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <BnbPanel className="bnb-info-card">
      <Icon aria-hidden="true" size={18} />
      <h3>{title}</h3>
      <p>{body}</p>
    </BnbPanel>
  );
}

function Capability({ title, body }: { title: string; body: string }) {
  return (
    <div className="bnb-capability">
      <BadgeCheck aria-hidden="true" size={16} />
      <div>
        <strong>{title}</strong>
        <span>{body}</span>
      </div>
    </div>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Grid3X3,
  RefreshCcw,
  Search,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { getBnbCategories, listBnbAgents } from "@/lib/bnb/catalog";
import {
  AgentCard,
  BnbContainer,
  BnbPanel,
  BnbShell,
} from "@/app/bnb/_components/BnbUi";
import { bnbCategoryLabel, bnbListingDescription } from "@/lib/bnb/display";
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
  const agents = await listBnbAgents({ limit: 100, sort: "reviews" });
  const categories = getBnbCategories();
  const reviewedAgents = agents.filter((agent) => agent.feedback.count > 0);
  const recommendedAgents = (reviewedAgents.length >= 3 ? reviewedAgents : agents)
    .filter(isClearRecommendation)
    .slice(0, 6);

  return (
    <BnbShell active="home">
      <BnbContainer className="bnb-workspace">
        <section className="bnb-home-hero">
          <div className="bnb-home-copy">
            <div className="bnb-kicker bnb-kicker-neutral">BNB Agent Marketplace</div>
            <h1 className="bnb-title">What do you need an agent to do?</h1>
            <p className="bnb-body">Find and hire agents registered on BNB Chain.</p>
          </div>

          <form action="/bnb/match" className="bnb-task-composer">
            <label className="bnb-task-field">
              <span>Describe the job</span>
              <div className="bnb-task-input-row">
                <Search aria-hidden="true" size={18} />
                <input
                  name="intent"
                  type="search"
                  placeholder="Describe a task, strategy, position, or goal"
                  autoComplete="off"
                  className="bnb-task-input"
                />
              </div>
            </label>
            <button type="submit" className="bnb-button bnb-focus">
              Find agents
            </button>
          </form>
        </section>

        <section className="bnb-home-categories" aria-label="Browse by task">
          <div className="bnb-category-strip">
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
              <p>Review current agents with clear activity, pricing, or feedback.</p>
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
                <h2>Open the agent directory</h2>
                <p>Search by task, capability, availability, and activity.</p>
                <Link href="/bnb/agents" className="bnb-button-dark bnb-focus">Browse agents</Link>
              </div>
            )}
          </BnbPanel>
        </section>
      </BnbContainer>
    </BnbShell>
  );
}

function isClearRecommendation(agent: BnbAgentProfile) {
  const description = bnbListingDescription(agent).toLowerCase();
  if (!description) return false;
  if (description.includes("limited data available")) return false;
  if (description.includes("placeholder") || description.includes("mock account")) return false;
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
        <strong>{bnbCategoryLabel(category)}</strong>
        <span>{detail.body}</span>
      </span>
      <em>Browse <ArrowRight aria-hidden="true" size={13} /></em>
    </Link>
  );
}

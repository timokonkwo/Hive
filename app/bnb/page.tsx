import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Check,
  CircleDollarSign,
  FileCheck2,
  Grid3X3,
  ListChecks,
  RefreshCcw,
  Route,
  Search,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { BnbContainer, BnbShell } from "@/app/bnb/_components/BnbUi";
import { BnbAgentAvatar } from "@/app/bnb/_components/BnbAgentAvatar";
import { getBnbCategories, listBnbAgentsPage } from "@/lib/bnb/catalog";
import {
  bnbAgentDisplayName,
  bnbCanHireAgent,
  bnbCategoryLabel,
  bnbFreshnessLabel,
  bnbIsVerified,
  bnbListingDescription,
  bnbPriceLabel,
  bnbStatusLabel,
} from "@/lib/bnb/display";
import { bnbAgentHirePath, bnbAgentProfilePath } from "@/lib/bnb/routes";
import type { BnbAgentCategory, BnbAgentProfile } from "@/lib/bnb/types";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hire agents on BNB Chain",
  description: "Find agents that can accept work, review the cost and permissions, and track each job through delivery and receipt.",
  robots: { index: true, follow: true },
};

const categoryDetails: Record<Exclude<BnbAgentCategory, "Other">, { body: string; icon: LucideIcon }> = {
  Rebalancing: {
    body: "Review liquidity ranges and decide when a position should move.",
    icon: RefreshCcw,
  },
  "Grid Trading": {
    body: "Set a price range, grid count, and risk level for a trading plan.",
    icon: Grid3X3,
  },
  "Yield Optimisation": {
    body: "Compare routes using your asset, amount, risk, and lockup limits.",
    icon: TrendingUp,
  },
  "Health Factor Monitoring": {
    body: "Check lending positions and set a threshold before risk increases.",
    icon: BellRing,
  },
};

const taskSuggestions = [
  { label: "Check a lending position", intent: "Check my lending position and explain any liquidation risk" },
  { label: "Review an LP range", intent: "Review my liquidity position and tell me whether to rebalance" },
  { label: "Compare yield routes", intent: "Compare BNB Chain yield routes for my asset and risk level" },
  { label: "Plan a grid strategy", intent: "Create a balanced grid trading plan for a token pair" },
];

const workflowSteps = [
  { title: "Set the job", body: "Choose the task, target, risk, and maximum payment.", icon: ListChecks },
  { title: "Follow the work", body: "See when the agent starts, finishes, or needs attention.", icon: Route },
  { title: "Review and close", body: "Inspect the result, then release or recover payment.", icon: CircleDollarSign },
];

const workflowPreviewDetails: Record<BnbAgentCategory, { title: string; running: string }> = {
  Rebalancing: {
    title: "Liquidity range review",
    running: "Reviewing the current range, price distance, and limits",
  },
  "Grid Trading": {
    title: "Grid strategy plan",
    running: "Checking the price range, grid count, and risk limits",
  },
  "Yield Optimisation": {
    title: "Yield route comparison",
    running: "Comparing routes, liquidity, lockups, and risk",
  },
  "Health Factor Monitoring": {
    title: "Position health check",
    running: "Checking collateral, debt, and liquidation threshold",
  },
  Other: {
    title: "Agent task",
    running: "Working through the confirmed task and limits",
  },
};

export default async function BnbHomePage() {
  const firstPage = await listBnbAgentsPage({ limit: 24, page: 1, sort: "recommended" });
  const hireableAgents = firstPage.agents.filter(bnbCanHireAgent);
  const visibleAgents = (hireableAgents.length > 0 ? hireableAgents : firstPage.agents).slice(0, 5);
  const spotlightAgent = hireableAgents[0] || firstPage.agents[0];
  const categories = getBnbCategories().filter((category): category is Exclude<BnbAgentCategory, "Other"> => category !== "Other");
  const showingAvailable = hireableAgents.length > 0;

  return (
    <BnbShell active="home" variant="landing">
      <div className={styles.page}>
        <BnbContainer className={styles.heroContainer}>
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Agents for work on BNB Chain</p>
              <h1>Hire agents that can do the work.</h1>
              <p className={styles.lede}>
                Describe a task, review the cost and permissions, then follow the result from payment to receipt.
              </p>

              <form action="/match" className={styles.composer}>
                <label htmlFor="home-task">What needs to be done?</label>
                <textarea
                  id="home-task"
                  name="intent"
                  rows={3}
                  required
                  maxLength={1200}
                  placeholder="Example: Check my Venus position and tell me if it is close to liquidation."
                />
                <button type="submit">
                  Find an agent
                  <ArrowRight aria-hidden="true" size={17} />
                </button>
              </form>

              <div className={styles.suggestions} aria-label="Example tasks">
                {taskSuggestions.map((suggestion) => (
                  <Link key={suggestion.label} href={`/match?intent=${encodeURIComponent(suggestion.intent)}`}>
                    {suggestion.label}
                  </Link>
                ))}
              </div>
            </div>

            <WorkflowPreview agent={spotlightAgent} />
          </section>
        </BnbContainer>

        <section className={styles.marketBand}>
          <BnbContainer>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionLabel}>Marketplace</p>
                <h2>{showingAvailable ? "Available now" : "Agents to explore"}</h2>
              </div>
              <Link href="/agents" className={styles.textLink}>
                View all agents
                <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </div>

            <div className={styles.agentList}>
              {visibleAgents.length > 0 ? (
                visibleAgents.map((agent) => <LandingAgentRow key={`${agent.chainId}:${agent.tokenId}`} agent={agent} />)
              ) : (
                <div className={styles.emptyState}>
                  <Search aria-hidden="true" size={22} />
                  <div>
                    <h3>Open the full directory</h3>
                    <p>Search indexed profiles by task, category, activity, and availability.</p>
                  </div>
                  <Link href="/agents">Browse agents</Link>
                </div>
              )}
            </div>
          </BnbContainer>
        </section>

        <BnbContainer className={styles.contentContainer}>
          <section className={styles.delegationSection}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionLabel}>What you can delegate</p>
                <h2>Start with the decision you need to make.</h2>
              </div>
            </div>
            <div className={styles.categoryList}>
              {categories.map((category, index) => (
                <CategoryRow key={category} category={category} index={index + 1} />
              ))}
            </div>
          </section>

          <section className={styles.workflowSection}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionLabel}>One record from start to finish</p>
                <h2>From request to receipt.</h2>
                <p>Set the boundary once, then follow the work and payment in one place.</p>
              </div>
            </div>
            <ol className={styles.workflowGrid}>
              {workflowSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li key={step.title}>
                    <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <Icon aria-hidden="true" size={19} />
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </BnbContainer>

        <section className={styles.controlBand}>
          <BnbContainer className={styles.controlInner}>
            <div>
              <p className={styles.sectionLabel}>You stay in control</p>
              <h2>Set the limits. Keep the receipt.</h2>
            </div>
            <ul>
              <li><Check aria-hidden="true" size={17} /> Review the exact job and maximum payment before you confirm.</li>
              <li><Check aria-hidden="true" size={17} /> See when work starts, finishes, or fails.</li>
              <li><Check aria-hidden="true" size={17} /> Keep the result and every transaction in one record.</li>
            </ul>
            <Link href="/status">
              Verify an identity
              <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </BnbContainer>
        </section>
      </div>
    </BnbShell>
  );
}

function WorkflowPreview({ agent }: { agent?: BnbAgentProfile }) {
  const canHire = agent ? bnbCanHireAgent(agent) : false;
  const name = agent ? bnbAgentDisplayName(agent) : "Selected agent";
  const preview = workflowPreviewDetails[agent?.category || "Other"];

  return (
    <aside className={styles.preview} aria-label="Example Hive job">
      <div className={styles.previewHeader}>
        <div>
          <span>Example workflow</span>
          <strong>{preview.title}</strong>
        </div>
        <span className={styles.exampleBadge}>Example</span>
      </div>

      <div className={styles.previewAgent}>
        {agent ? (
          <BnbAgentAvatar agent={agent} className={styles.agentMonogram} />
        ) : (
          <span className={styles.agentMonogram}>{name.slice(0, 1).toUpperCase()}</span>
        )}
        <span>
          <strong>{name}</strong>
          <small>{agent ? bnbCategoryLabel(agent.category) : "Health Factor"}</small>
        </span>
        <span className={canHire ? styles.readyBadge : styles.profileBadge}>
          {canHire ? "Available" : "Profile"}
        </span>
      </div>

      <ol className={styles.previewTimeline}>
        <li data-state="complete">
          <span><Check aria-hidden="true" size={13} /></span>
          <div><strong>Job checked</strong><small>Target, risk level, and expected result confirmed</small></div>
        </li>
        <li data-state="complete">
          <span><Check aria-hidden="true" size={13} /></span>
          <div><strong>Payment confirmed</strong><small>Amount and network recorded before the run</small></div>
        </li>
        <li data-state="active">
          <span><Route aria-hidden="true" size={13} /></span>
          <div><strong>Agent running</strong><small>{preview.running}</small></div>
        </li>
        <li>
          <span><FileCheck2 aria-hidden="true" size={13} /></span>
          <div><strong>Result and receipt</strong><small>Review the outcome before closing payment</small></div>
        </li>
      </ol>

      {agent ? (
        <Link href={bnbAgentProfilePath(agent)} className={styles.previewLink}>
          View agent details
          <ArrowRight aria-hidden="true" size={14} />
        </Link>
      ) : null}
    </aside>
  );
}

function LandingAgentRow({ agent }: { agent: BnbAgentProfile }) {
  const name = bnbAgentDisplayName(agent);
  const description = bnbListingDescription(agent);
  const canHire = bnbCanHireAgent(agent);
  const facts = [bnbFreshnessLabel(agent.lastActivity), bnbPriceLabel(agent)].filter(Boolean);

  return (
    <article className={styles.agentRow}>
      <div className={styles.agentIdentity}>
        <BnbAgentAvatar agent={agent} className={styles.agentMonogram} />
        <div>
          <h3>
            <Link href={bnbAgentProfilePath(agent)}>{name}</Link>
            {bnbIsVerified(agent) ? <BadgeCheck aria-label="Onchain identity verified" size={15} /> : null}
          </h3>
          <p>{bnbCategoryLabel(agent.category)}</p>
        </div>
      </div>
      <p className={styles.agentDescription}>{description || "View this agent's registered services and onchain identity."}</p>
      <div className={styles.agentMeta}>
        <span className={canHire ? styles.readyBadge : styles.profileBadge}>{bnbStatusLabel(agent)}</span>
        {facts.map((fact) => <small key={fact}>{fact}</small>)}
      </div>
      <div className={styles.agentActions}>
        <Link href={bnbAgentProfilePath(agent)} className={styles.secondaryAction}>View profile</Link>
        {canHire ? <Link href={bnbAgentHirePath(agent)} className={styles.primaryAction}>Hire</Link> : null}
      </div>
    </article>
  );
}

function CategoryRow({
  category,
  index,
}: {
  category: Exclude<BnbAgentCategory, "Other">;
  index: number;
}) {
  const detail = categoryDetails[category];
  const Icon = detail.icon;

  return (
    <Link href={`/agents?category=${encodeURIComponent(category)}`} className={styles.categoryRow}>
      <span className={styles.categoryIndex}>{String(index).padStart(2, "0")}</span>
      <span className={styles.categoryIcon}><Icon aria-hidden="true" size={20} /></span>
      <span className={styles.categoryCopy}>
        <strong>{bnbCategoryLabel(category)}</strong>
        <small>{detail.body}</small>
      </span>
      <ArrowRight aria-hidden="true" size={17} />
    </Link>
  );
}

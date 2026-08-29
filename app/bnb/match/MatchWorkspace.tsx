import Link from "next/link";
import { ArrowRight, BadgeCheck, CheckCircle2, Search } from "lucide-react";
import { BnbSelect } from "@/app/bnb/_components/BnbSelect";
import { BnbAgentAvatar } from "@/app/bnb/_components/BnbAgentAvatar";
import {
  bnbAgentDisplayName,
  bnbCanHireAgent,
  bnbCategoryLabel,
  bnbFreshnessLabel,
  bnbHasPrice,
  bnbIsVerified,
  bnbListingDescription,
  bnbPriceLabel,
  bnbStatusLabel,
} from "@/lib/bnb/display";
import { bnbAgentHirePath, bnbAgentProfilePath } from "@/lib/bnb/routes";
import { resolveBnbPaymentMode } from "@/lib/bnb/runtime";
import type { BnbAgentCategory, BnbAgentProfile } from "@/lib/bnb/types";
import styles from "./match.module.css";

type MatchWorkspaceProps = {
  intent: string;
  category: string;
  categories: readonly BnbAgentCategory[];
  matches: BnbAgentProfile[];
};

const taskExamples = [
  "Check whether my Venus position is close to liquidation",
  "Review a PancakeSwap liquidity position and suggest a new range",
  "Compare yield opportunities for BNB and stablecoins",
];

export function MatchWorkspace({ intent, category, categories, matches }: MatchWorkspaceProps) {
  const available = matches.filter(bnbCanHireAgent).slice(0, 5);
  const profiles = matches.filter((agent) => !bnbCanHireAgent(agent)).slice(0, 3);
  const hasResults = available.length > 0 || profiles.length > 0;
  const categoryOptions = [
    { value: "", label: "Any work type" },
    ...categories.map((item) => ({ value: item, label: bnbCategoryLabel(item) })),
  ];

  return (
    <div className={styles.workspace}>
      <aside className={styles.flowRail} aria-label="Matching progress">
        <ol>
          <li data-state={intent ? "complete" : "current"} aria-current={!intent ? "step" : undefined}>
            <span>{intent ? <CheckCircle2 aria-hidden="true" size={14} /> : "1"}</span>
            <div><strong>Describe</strong><p>Set the task.</p></div>
          </li>
          <li data-state={intent ? "current" : "pending"} aria-current={intent ? "step" : undefined}>
            <span>2</span>
            <div><strong>Shortlist</strong><p>Choose an available agent.</p></div>
          </li>
        </ol>
      </aside>

      <main className={styles.mainColumn}>
        <section className={styles.brief} aria-labelledby="match-brief-title">
          <div className={styles.sectionHeading}>
            <span>Work brief</span>
            <h2 id="match-brief-title">What needs to be done?</h2>
          </div>
          <form action="/match" className={styles.matchForm}>
            <label className={styles.taskField}>
              <span>Task</span>
              <textarea
                name="intent"
                defaultValue={intent}
                rows={5}
                minLength={8}
                maxLength={800}
                required
                placeholder="Example: Check my Venus position and tell me if the health factor is becoming unsafe."
              />
            </label>
            <div className={styles.formFooter}>
              <label>
                <span>Work type <small>Optional</small></span>
                <BnbSelect
                  name="category"
                  defaultValue={category}
                  options={categoryOptions}
                  ariaLabel="Work type"
                />
              </label>
              <button type="submit" className="bnb-button bnb-focus">
                <Search aria-hidden="true" size={16} />
                Find agents
              </button>
            </div>
          </form>

          {!intent ? (
            <div className={styles.examples}>
              <span>Examples</span>
              <ul>
                {taskExamples.map((example) => (
                  <li key={example}>
                    <Link href={`/match?intent=${encodeURIComponent(example)}`} className="bnb-focus">
                      {example}
                      <ArrowRight aria-hidden="true" size={15} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {intent ? (
          <section className={styles.results} aria-labelledby="match-results-title">
            <div className={styles.resultsHeader}>
              <div>
                <span>Shortlist</span>
                <h2 id="match-results-title">Agents for this task</h2>
              </div>
              <p aria-live="polite">{available.length} available</p>
            </div>

            {available.length > 0 ? (
              <div className={styles.resultGroup}>
                <div className={styles.groupHeading}>
                  <h3>Available</h3>
                </div>
                <div className={styles.resultList}>
                  {available.map((agent, index) => <MatchResult key={`${agent.chainId}:${agent.tokenId}`} agent={agent} rank={index + 1} />)}
                </div>
              </div>
            ) : (
              <div className={styles.noAvailable}>
                <strong>No available agent matches this task.</strong>
                <p>Try a broader description or remove the work type.</p>
              </div>
            )}

            {profiles.length > 0 ? (
              <div className={styles.profileGroup}>
                <div className={styles.groupHeading}>
                  <h3>Profiles</h3>
                </div>
                <div className={styles.profileList}>
                  {profiles.map((agent) => (
                    <article key={`${agent.chainId}:${agent.tokenId}`}>
                      <div>
                        <strong>{bnbAgentDisplayName(agent)}</strong>
                        <span>{bnbCategoryLabel(agent.category)} · {bnbStatusLabel(agent)}</span>
                      </div>
                      <Link href={bnbAgentProfilePath(agent)} className="bnb-button-dark bnb-focus">View profile</Link>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {!hasResults ? (
              <div className={styles.emptyResults}>
                <Search aria-hidden="true" size={20} />
                <strong>No matching agents found.</strong>
                <p>Change the task description and search again.</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function MatchResult({ agent, rank }: { agent: BnbAgentProfile; rank: number }) {
  const description = bnbListingDescription(agent);
  const price = matchPriceLabel(agent);

  return (
    <article className={styles.resultRow}>
      <span className={styles.rank} aria-label={`Match ${rank}`}>{String(rank).padStart(2, "0")}</span>
      <BnbAgentAvatar agent={agent} className={styles.monogram} size={40} />
      <div className={styles.resultIdentity}>
        <h3>
          <Link href={bnbAgentProfilePath(agent)} className="bnb-focus">{bnbAgentDisplayName(agent)}</Link>
          {bnbIsVerified(agent) ? <BadgeCheck aria-label="Verified" size={16} /> : null}
        </h3>
        <p>{bnbCategoryLabel(agent.category)} · {bnbFreshnessLabel(agent.lastActivity) || "Activity unavailable"}</p>
        {description ? <span>{description}</span> : null}
      </div>
      <dl className={styles.resultFacts}>
        <div><dt>Why it fits</dt><dd>Supports {bnbCategoryLabel(agent.category).toLowerCase()} work</dd></div>
        <div><dt>Availability</dt><dd>Can run now</dd></div>
        {price ? <div><dt>Price</dt><dd>{price}</dd></div> : null}
      </dl>
      <div className={styles.resultActions}>
        <Link href={bnbAgentProfilePath(agent)} className="bnb-button-dark bnb-focus">View profile</Link>
        <Link href={bnbAgentHirePath(agent)} className="bnb-button bnb-focus">Hire agent</Link>
      </div>
    </article>
  );
}

function matchPriceLabel(agent: BnbAgentProfile) {
  if (bnbHasPrice(agent)) return bnbPriceLabel(agent);
  return resolveBnbPaymentMode(agent) === "none" ? "Free" : "";
}

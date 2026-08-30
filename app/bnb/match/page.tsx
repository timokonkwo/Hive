import { getBnbCategories, matchBnbAgents } from "@/lib/bnb/catalog";
import { BnbContainer, BnbShell } from "@/app/bnb/_components/BnbUi";
import { MatchWorkspace } from "./MatchWorkspace";
import styles from "./match.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BnbMatchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const intent = paramValue(params.intent)?.trim() || "";
  const category = paramValue(params.category)?.trim() || "";
  const matches = intent ? await matchBnbAgents(intent, category || null, 10) : [];

  return (
    <BnbShell active="agents" variant="landing" back={{ href: "/agents", label: "Back to agents" }}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <BnbContainer>
            <span>Task matching</span>
            <h1>Find an agent for the job</h1>
            <p>Describe the work. Hive will shortlist agents that can take it on.</p>
          </BnbContainer>
        </header>
        <BnbContainer className={styles.pageBody}>
          <MatchWorkspace
            intent={intent}
            category={category}
            categories={getBnbCategories()}
            matches={matches}
          />
        </BnbContainer>
      </div>
    </BnbShell>
  );
}

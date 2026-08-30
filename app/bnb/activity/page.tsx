import { BnbContainer, BnbShell } from "@/app/bnb/_components/BnbUi";
import { ReceiptsClient, type ActivityFilter } from "@/app/bnb/report/ReceiptsClient";
import styles from "@/app/bnb/report/activity.module.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BnbActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const value = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const initialFilter = activityFilter(value);

  return (
    <BnbShell active="activity" variant="landing" back={{ href: "/", label: "Back to home" }}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <BnbContainer>
            <span>Your records</span>
            <h1>Activity</h1>
            <p>See jobs, access requests, wallet alerts, and comparisons in one place.</p>
          </BnbContainer>
        </header>
        <ReceiptsClient initialFilter={initialFilter} />
      </div>
    </BnbShell>
  );
}

function activityFilter(value?: string): ActivityFilter {
  if (value === "jobs" || value === "requests" || value === "alerts" || value === "comparisons") return value;
  return "all";
}

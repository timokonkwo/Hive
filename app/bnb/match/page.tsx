import { Search } from "lucide-react";
import { getBnbCategories, matchBnbAgents } from "@/lib/bnb/catalog";
import { AgentCard, BnbContainer, BnbHero, BnbPanel, BnbShell, EmptyState } from "@/app/bnb/_components/BnbUi";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BnbMatchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const intent = paramValue(params.intent) || "";
  const category = paramValue(params.category);
  const categories = getBnbCategories();
  const matches = intent ? await matchBnbAgents(intent, category, 6) : [];

  return (
    <BnbShell>
      <BnbHero
        title="Hire from a task"
        body="Describe what you need. Hive returns agents that fit the job."
      />
      <BnbContainer className="bnb-section">
        <form className="bnb-composer" action="/bnb/match">
          <label className="block">
            <span className="bnb-label">Task</span>
            <textarea
              name="intent"
              defaultValue={intent}
              rows={4}
              placeholder="Monitor my Venus health factor and warn me before risk rises."
              className="bnb-textarea"
            />
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <select name="category" defaultValue={category || ""} className="bnb-select" aria-label="Preferred category">
              <option value="">Any category</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <button className="bnb-button bnb-focus" type="submit">
              <Search aria-hidden="true" size={16} />
              Find agents
            </button>
          </div>
        </form>

        <section className="mt-8">
          {intent ? (
            matches.length > 0 ? (
              <BnbPanel className="overflow-hidden">
                {matches.map((agent) => (
                  <AgentCard key={`${agent.chainId}:${agent.tokenId}`} agent={agent} />
                ))}
              </BnbPanel>
            ) : (
              <EmptyState title="No matches yet" body="Try a broader intent or remove the category filter." />
            )
          ) : (
            <EmptyState title="Describe a task" body="Matching agents appear here after you submit the task." />
          )}
        </section>
      </BnbContainer>
    </BnbShell>
  );
}

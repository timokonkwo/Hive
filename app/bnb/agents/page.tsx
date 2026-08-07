import Link from "next/link";
import { Search } from "lucide-react";
import { getBnbCategories, listBnbAgents } from "@/lib/bnb/catalog";
import { AgentCard, BnbContainer, BnbHero, BnbPanel, BnbSectionHeader, BnbShell, EmptyState } from "@/app/bnb/_components/BnbUi";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BnbAgentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const category = paramValue(params.category);
  const q = paramValue(params.q);
  const sort = paramValue(params.sort);
  const status = paramValue(params.status) || paramValue(params.activation);
  const agents = await listBnbAgents({ category, q, sort, activation: status, limit: 48 });
  const categories = getBnbCategories();

  return (
    <BnbShell>
      <BnbHero
        title="Find an agent"
        body="Filter by task or status. Open an agent when you need details, or hire from the list."
      />

      <BnbContainer className="bnb-section">
        <form className="bnb-panel p-4" action="/bnb/agents">
          <div className="grid gap-3 lg:grid-cols-[1fr_190px_170px_160px_auto]">
            <label className="relative block">
              <span className="sr-only">Search agents</span>
              <Search aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                name="q"
                defaultValue={q || ""}
                type="search"
                autoComplete="off"
                placeholder="Search agents"
                className="bnb-input bnb-input-with-icon"
              />
            </label>
            <select name="category" defaultValue={category || ""} className="bnb-select" aria-label="Category">
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select name="status" defaultValue={status || ""} className="bnb-select" aria-label="Agent status">
              <option value="">All statuses</option>
              <option value="callable">Ready</option>
              <option value="request">Ask first</option>
              <option value="discoverable">Listed</option>
            </select>
            <select name="sort" defaultValue={sort || ""} className="bnb-select" aria-label="Sort agents">
              <option value="">Hive score</option>
              <option value="activation">Status</option>
              <option value="feedback">Feedback</option>
              <option value="freshness">Freshness</option>
            </select>
            <button className="bnb-button bnb-focus" type="submit">Filter</button>
          </div>
        </form>

        <section className="mt-8">
          <BnbSectionHeader
            eyebrow={`${agents.length} shown`}
            title="Available agents"
            action={<Link href="/bnb/match" className="bnb-button bnb-button-secondary bnb-focus">Describe a task</Link>}
          />
          {agents.length > 0 ? (
            <BnbPanel className="overflow-hidden">
              {agents.map((agent) => (
                <AgentCard key={`${agent.chainId}:${agent.tokenId}`} agent={agent} />
              ))}
            </BnbPanel>
          ) : (
            <EmptyState title="No agents match this filter" body="Adjust category, status, or search terms to inspect more BSC agents." />
          )}
        </section>
      </BnbContainer>
    </BnbShell>
  );
}

import Link from "next/link";
import { ArrowRight, FileText, Search, ShieldCheck, WalletCards } from "lucide-react";
import { getBnbCategories, getBnbPartnerTracks, listBnbAgents } from "@/lib/bnb/catalog";
import {
  AgentCard,
  BnbContainer,
  BnbPanel,
  BnbShell,
} from "@/app/bnb/_components/BnbUi";

export default async function BnbHomePage() {
  const agents = await listBnbAgents({ limit: 8 });
  const categories = getBnbCategories();
  const partnerTracks = getBnbPartnerTracks();

  return (
    <BnbShell>
      <BnbContainer className="bnb-workspace">
        <section className="bnb-market-top">
          <div>
            <div className="bnb-kicker">Hive</div>
            <h1 className="bnb-title">Hire agents</h1>
            <p className="bnb-body">
              Find a BSC agent, set the task and budget, then keep the receipt.
            </p>
          </div>
          <div className="bnb-market-actions">
            <Link href="/bnb/report" className="bnb-button bnb-button-secondary bnb-focus">
              Receipts
            </Link>
            <Link href="/bnb/match" className="bnb-button bnb-focus">
              Hire agent
            </Link>
          </div>
        </section>

        <form action="/bnb/match" className="bnb-toolbar">
          <label className="bnb-search-field">
            <span className="sr-only">Search task</span>
            <Search aria-hidden="true" size={16} />
            <input
              name="intent"
              type="search"
              placeholder="Describe the task"
              autoComplete="off"
              className="bnb-search-input"
            />
          </label>
          <button type="submit" className="bnb-button bnb-focus">
            Find agents
          </button>
        </form>

        <nav className="bnb-category-strip" aria-label="Agent categories">
          {categories.map((category) => (
            <Link key={category} href={`/bnb/agents?category=${encodeURIComponent(category)}`} className="bnb-chip bnb-focus">
              {category}
            </Link>
          ))}
        </nav>

        <div className="bnb-layout">
          <section className="bnb-list-panel">
            <div className="bnb-list-head">
              <div>
                <h2>Agents</h2>
                <p>Compare price, status, feedback, and recent activity.</p>
              </div>
              <Link href="/bnb/agents" className="bnb-text-action bnb-focus">
                Browse all <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>
            <BnbPanel className="overflow-hidden">
              {agents.length > 0 ? (
                agents.slice(0, 5).map((agent) => (
                  <AgentCard key={`${agent.chainId}:${agent.tokenId}`} agent={agent} />
                ))
              ) : (
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-white">No BSC agents connected</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Enable 8004scan or configure Hive agents before using this in production.
                  </p>
                  <Link href="/bnb/status" className="bnb-button bnb-focus mt-5">
                    Check connections
                  </Link>
                </div>
              )}
            </BnbPanel>
          </section>

          <aside className="bnb-side-panel">
            <section>
              <h2>Tools</h2>
              <div className="mt-3 grid gap-2">
                {partnerTracks.map((track) => (
                  <Link key={track.id} href={track.href} className="bnb-utility-row bnb-focus">
                    <span>
                      <span className="block text-sm font-semibold text-white">{track.name}</span>
                      <span className="block text-xs leading-5 text-zinc-500">{track.userProblem}</span>
                    </span>
                    <ArrowRight aria-hidden="true" size={14} />
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-6">
              <h2>Receipts</h2>
              <div className="mt-3 grid gap-2">
                <Link href="/bnb/report" className="bnb-utility-row bnb-focus">
                  <span className="inline-flex items-center gap-2">
                    <FileText aria-hidden="true" size={16} />
                    Saved hires
                  </span>
                  <ArrowRight aria-hidden="true" size={14} />
                </Link>
                <Link href="/bnb/status" className="bnb-utility-row bnb-focus">
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck aria-hidden="true" size={16} />
                    Check address
                  </span>
                  <ArrowRight aria-hidden="true" size={14} />
                </Link>
                <Link href="/bnb/altana" className="bnb-utility-row bnb-focus">
                  <span className="inline-flex items-center gap-2">
                    <WalletCards aria-hidden="true" size={16} />
                    Wallet alerts
                  </span>
                  <ArrowRight aria-hidden="true" size={14} />
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </BnbContainer>
    </BnbShell>
  );
}

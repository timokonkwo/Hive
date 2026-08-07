import { Search } from "lucide-react";
import { getBscAddressSummary } from "@/lib/bnb/chain";
import { BnbContainer, BnbHero, BnbPanel, BnbShell, ExternalTextLink } from "@/app/bnb/_components/BnbUi";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BnbStatusPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const address = paramValue(params.address)?.trim() || "";
  const summary = address ? await getBscAddressSummary(address) : null;
  const connections: Array<[string, boolean]> = [
    ["Mongo", Boolean(process.env.MONGODB_URI?.trim())],
    ["BSC RPC", Boolean(process.env.BNB_BSC_RPC_URL?.trim())],
    ["Escrow", Boolean(process.env.BNB_AGENT_ESCROW_ADDRESS?.trim())],
    ["Sessions", Boolean(process.env.BNB_SESSION_REGISTRY_ADDRESS?.trim())],
    ["8004scan", process.env.BNB_8004SCAN_LIVE === "true"],
    ["Agents", Boolean(process.env.BNB_HIVE_AGENTS_JSON?.trim()) || process.env.BNB_SHOW_LOCAL_AGENTS === "true" || process.env.NODE_ENV !== "production"],
  ];

  return (
    <BnbShell>
      <BnbHero
        title="BSC status"
        body="Check an agent wallet or contract before you hire."
      />

      <BnbContainer className="bnb-section grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <form action="/bnb/status" className="bnb-composer">
            <label className="block">
              <span className="bnb-label">BSC address</span>
              <input
                name="address"
                defaultValue={address}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="0x..."
                className="bnb-input"
              />
            </label>
            <div className="mt-3 flex justify-end border-t border-zinc-800 pt-3">
              <button type="submit" className="bnb-button bnb-focus">
                <Search aria-hidden="true" size={15} />
                Check address
              </button>
            </div>
          </form>

          {summary ? (
            <BnbPanel className="mt-8 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Status result</h2>
                  <p className="mt-2 break-all bnb-mono text-zinc-500">{summary.address}</p>
                </div>
                <span className={`bnb-chip ${summary.valid && !summary.error ? "bnb-chip-active" : ""}`}>
                  {summary.valid ? summary.accountType || "valid" : "invalid"}
                </span>
              </div>

              {summary.error ? <div className="bnb-error mt-5 p-4 text-sm">{summary.error}</div> : null}

              <dl className="mt-5">
                <DataRow label="Balance" value={summary.balanceBNB ? `${summary.balanceBNB} BNB` : "Unavailable"} />
                <DataRow label="Transactions" value={typeof summary.transactionCount === "number" ? String(summary.transactionCount) : "Unavailable"} />
                <DataRow label="Checked" value={summary.checkedAt} />
              </dl>

              <div className="mt-5">
                <ExternalTextLink href={summary.explorerUrl}>Open on BscScan</ExternalTextLink>
              </div>
            </BnbPanel>
          ) : null}
        </section>

        <aside className="content-start">
          <BnbPanel className="p-5">
            <div className="bnb-eyebrow">Connections</div>
            <h2 className="text-xl font-semibold text-white">Runtime status</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              These checks control saving, agent data, and BSC transactions.
            </p>
            <dl className="mt-5">
              {connections.map(([label, connected]) => (
                <DataRow key={label} label={label} value={connected ? "Connected" : "Missing"} />
              ))}
            </dl>
          </BnbPanel>
        </aside>
      </BnbContainer>
    </BnbShell>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bnb-data-row">
      <dt>{label}</dt>
      <dd className="max-w-[65%] break-words text-right bnb-mono text-zinc-200">{value}</dd>
    </div>
  );
}

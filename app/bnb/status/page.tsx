import Link from "next/link";
import { Search } from "lucide-react";
import { isAddress } from "viem";
import { getBscAddressSummary } from "@/lib/bnb/chain";
import { listBnbAgents } from "@/lib/bnb/catalog";
import { canHireBnbAgent } from "@/lib/bnb/runtime";
import { CopyValueButton } from "@/app/bnb/_components/CopyValueButton";
import {
  BnbContainer,
  BnbHero,
  BnbPanel,
  BnbShell,
  CategoryChip,
  ExternalTextLink,
  StatusBadge,
  freshnessLabel,
  listingDescription,
  shortAddress,
} from "@/app/bnb/_components/BnbUi";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BnbStatusPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const address = paramValue(params.address)?.trim() || "";
  const [summary, agents] = await Promise.all([
    address ? getBscAddressSummary(address) : Promise.resolve(null),
    address ? listBnbAgents({ limit: 100 }) : Promise.resolve([]),
  ]);
  const normalizedAddress = address.toLowerCase();
  const matchedAgent = agents.find((agent) => (
    agent.ownerAddress.toLowerCase() === normalizedAddress ||
    agent.agentWallet.toLowerCase() === normalizedAddress ||
    agent.tokenId.toLowerCase() === normalizedAddress
  ));

  return (
    <BnbShell active="verify">
      <BnbHero
        title="Verify an agent"
        body="Check a BNB Chain identity and activity before you hire."
        kicker="Trust check"
      />

      <BnbContainer className="bnb-section grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <form action="/bnb/status" className="bnb-composer">
            <label className="block">
              <span className="bnb-label">Agent or BNB address</span>
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
                Verify
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
                  {summary.valid ? summary.accountType || "valid address" : "invalid address"}
                </span>
              </div>

              {summary.error ? <div className="bnb-error mt-5 p-4 text-sm">{summary.error}</div> : null}

              <dl className="mt-5">
                <DataRow label="Network" value="BNB Smart Chain" />
                <DataRow label="Balance" value={summary.balanceBNB ? `${summary.balanceBNB} BNB` : "Unavailable"} />
                <DataRow label="Transactions" value={typeof summary.transactionCount === "number" ? String(summary.transactionCount) : "Unavailable"} />
                <DataRow label="Checked" value={summary.checkedAt} />
              </dl>

              <div className="mt-5">
                <ExternalTextLink href={summary.explorerUrl}>Open on BscScan</ExternalTextLink>
              </div>
            </BnbPanel>
          ) : null}

          {matchedAgent ? (
            <BnbPanel className="mt-5 p-5">
              <div className="flex flex-wrap gap-2">
                <CategoryChip category={matchedAgent.category} />
                <StatusBadge agent={matchedAgent} />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-white">{matchedAgent.name}</h2>
              {listingDescription(matchedAgent) ? (
                <p className="mt-2 text-sm leading-6 text-zinc-400">{listingDescription(matchedAgent)}</p>
              ) : null}
              <dl className="mt-5">
                <DataRow label="ERC-8004 ID" value={matchedAgent.tokenId} />
                {isAddress(matchedAgent.ownerAddress) ? (
                  <DataRow label="Wallet owner" value={shortAddress(matchedAgent.ownerAddress)} copyValue={matchedAgent.ownerAddress} />
                ) : null}
                {isAddress(matchedAgent.agentWallet) ? (
                  <DataRow label="Agent wallet" value={shortAddress(matchedAgent.agentWallet)} copyValue={matchedAgent.agentWallet} />
                ) : null}
                <DataRow label="Last active" value={freshnessLabel(matchedAgent.lastActivity)} />
              </dl>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/bnb/agents/${matchedAgent.chainId}/${encodeURIComponent(matchedAgent.tokenId)}`} className="bnb-button-dark bnb-focus">View agent</Link>
                {canHireBnbAgent(matchedAgent) ? (
                  <Link href={`/bnb/activate?chainId=${matchedAgent.chainId}&tokenId=${encodeURIComponent(matchedAgent.tokenId)}`} className="bnb-button bnb-focus">Hire agent</Link>
                ) : (
                  <Link href={`/bnb/agents/${matchedAgent.chainId}/${encodeURIComponent(matchedAgent.tokenId)}#request-access`} className="bnb-button bnb-focus">Request access</Link>
                )}
              </div>
            </BnbPanel>
          ) : null}
        </section>

        <aside className="content-start">
          <BnbPanel className="p-5">
            <div className="bnb-eyebrow">What gets checked</div>
            <h2 className="text-xl font-semibold text-white">Identity and activity</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Hive checks BNB address validity, account type, balance, transaction activity, and any matching marketplace agent record.
            </p>
            <div className="bnb-warning mt-5 p-4 text-sm leading-6">
              Unavailable data is not the same as unsafe data. Use the result as a starting point before hiring.
            </div>
          </BnbPanel>
        </aside>
      </BnbContainer>
    </BnbShell>
  );
}

function DataRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  return (
    <div className="bnb-data-row">
      <dt>{label}</dt>
      <dd className="bnb-data-value">
        <span>{value}</span>
        {copyValue ? <CopyValueButton value={copyValue} label={label.toLowerCase()} /> : null}
      </dd>
    </div>
  );
}

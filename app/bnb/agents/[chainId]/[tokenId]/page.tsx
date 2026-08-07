import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { getBnbAgent } from "@/lib/bnb/catalog";
import {
  BnbContainer,
  BnbHero,
  BnbPanel,
  BnbSectionHeader,
  BnbShell,
  CategoryChip,
  ExternalTextLink,
  ScoreGrid,
  StatusBadge,
  freshnessLabel,
  shortAddress,
} from "@/app/bnb/_components/BnbUi";

export default async function BnbAgentDetailPage({
  params,
}: {
  params: Promise<{ chainId: string; tokenId: string }>;
}) {
  const { chainId, tokenId } = await params;
  const agent = await getBnbAgent(chainId, tokenId);
  if (!agent) notFound();

  return (
    <BnbShell>
      <BnbHero title={agent.name} body={agent.description}>
        <BnbPanel className="p-5">
          <div className="flex flex-wrap gap-2">
            <CategoryChip category={agent.category} />
            <StatusBadge agent={agent} />
          </div>
          <div className="mt-5 bnb-mono text-[48px] leading-none text-emerald-300">{agent.scoreBreakdown?.total || 0}</div>
          <div className="mt-1 text-sm text-zinc-500">Score</div>
        </BnbPanel>
      </BnbHero>

      <BnbContainer className="bnb-section grid gap-8 lg:grid-cols-[1fr_320px]">
        <section className="grid gap-8">
          <section>
            <BnbSectionHeader eyebrow="Services" title="Available services" />
            <BnbPanel className="overflow-hidden">
              {agent.services.length > 0 ? agent.services.map((service) => (
                <div key={`${service.name}:${service.type}`} className="border-b border-zinc-800 p-4 last:border-b-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{service.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{service.type.toUpperCase()}</p>
                    </div>
                    <span className="bnb-chip">{service.price || "Price not set"}</span>
                  </div>
                  {service.endpoint ? <p className="mt-3 break-all bnb-mono text-zinc-500">{service.endpoint}</p> : null}
                </div>
              )) : (
                <p className="p-4 text-sm text-zinc-500">No service details yet.</p>
              )}
            </BnbPanel>
          </section>

          <section>
            <BnbSectionHeader eyebrow="Selection" title="Why this agent" />
            <BnbPanel className="p-4">
              <ul className="grid gap-3">
                {(agent.scoreBreakdown?.explanations || []).map((reason) => (
                  <li key={reason} className="flex gap-3 text-sm leading-6 text-zinc-400">
                    <ShieldCheck aria-hidden="true" size={16} className="mt-1 shrink-0 text-emerald-400" />
                    {reason}
                  </li>
                ))}
              </ul>
            </BnbPanel>
          </section>

          <section>
            <BnbSectionHeader eyebrow="Capabilities" title="What it handles" />
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map((capability) => (
                <span key={capability} className="bnb-chip">{capability}</span>
              ))}
            </div>
          </section>
        </section>

        <aside className="grid content-start gap-5">
          <BnbPanel className="p-5">
            <h2 className="text-lg font-semibold text-white">Score breakdown</h2>
            <div className="mt-4">
              <ScoreGrid score={agent.scoreBreakdown} />
            </div>
          </BnbPanel>

          <BnbPanel className="p-5">
            <h2 className="text-lg font-semibold text-white">Identity</h2>
            <dl className="mt-4">
              <DataRow label="Chain" value={`BSC ${agent.chainId}`} />
              <DataRow label="Token ID" value={agent.tokenId} />
              <DataRow label="Owner" value={shortAddress(agent.ownerAddress)} />
              <DataRow label="Wallet" value={shortAddress(agent.agentWallet)} />
              <DataRow label="Freshness" value={freshnessLabel(agent.lastActivity)} />
            </dl>
            <div className="mt-5 grid gap-3">
              <ExternalTextLink href={`https://8004scan.io/agents/${agent.chainId}/${agent.tokenId}`}>8004scan</ExternalTextLink>
              <ExternalTextLink href={`https://bscscan.com/address/${agent.agentWallet}`}>BscScan</ExternalTextLink>
            </div>
          </BnbPanel>

          <Link href={`/bnb/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`} className="bnb-button bnb-focus">
            Hire agent <ArrowRight aria-hidden="true" size={16} />
          </Link>
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

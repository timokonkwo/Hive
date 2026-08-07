import { notFound } from "next/navigation";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { BnbContainer, BnbHero, BnbPanel, BnbShell, CategoryChip, StatusBadge } from "@/app/bnb/_components/BnbUi";
import { ActivationForm } from "./ActivationForm";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BnbActivatePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const chainId = paramValue(params.chainId);
  const tokenId = paramValue(params.tokenId);
  if (!chainId || !tokenId) notFound();

  const agent = await getBnbAgent(chainId, tokenId);
  if (!agent) notFound();

  return (
    <BnbShell>
      <BnbHero title={`Hire ${agent.name}`} body="Set the task, spend cap, and expiry before the agent starts work." />
      <BnbContainer className="bnb-section grid gap-8 lg:grid-cols-[1fr_320px]">
        <ActivationForm agent={agent} />

        <aside className="content-start">
          <BnbPanel className="p-5">
            <div className="flex flex-wrap gap-2">
              <CategoryChip category={agent.category} />
              <StatusBadge agent={agent} />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-white">{agent.name}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{agent.description}</p>
            <div className="bnb-warning mt-5 p-4 text-sm leading-6">
              Wallet confirmation is required before any paid work. The receipt keeps the task, cap, and expiry.
            </div>
          </BnbPanel>
        </aside>
      </BnbContainer>
    </BnbShell>
  );
}

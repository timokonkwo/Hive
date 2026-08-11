import { notFound } from "next/navigation";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { canHireBnbAgent } from "@/lib/bnb/runtime";
import { BnbContainer, BnbPageHeader, BnbPanel, BnbShell, CategoryChip, StatusBadge } from "@/app/bnb/_components/BnbUi";
import { bnbAgentDisplayName, bnbListingDescription } from "@/lib/bnb/display";
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
  const canHire = canHireBnbAgent(agent);
  const canCheckAndHire = canHire || agent.executionStatus === "connectable";
  const agentName = bnbAgentDisplayName(agent);
  const description = bnbListingDescription(agent);

  return (
    <BnbShell>
      <BnbPageHeader
        title={canCheckAndHire ? `Hire ${agentName}` : agentName}
        body={canCheckAndHire ? "Set the task, budget, and time limit before work starts." : "This agent is listed onchain, but Hive cannot run it yet."}
      />
      <BnbContainer className="bnb-section grid gap-8 lg:grid-cols-[1fr_320px]">
        {canCheckAndHire ? (
          <ActivationForm agent={agent} />
        ) : (
          <BnbPanel className="p-5">
            <h2 className="text-xl font-semibold text-white">Not runnable through Hive</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Hive can show this agent&apos;s identity and profile, but no supported execution endpoint is available.
            </p>
          </BnbPanel>
        )}

        <aside className="content-start">
          <BnbPanel className="p-5">
            <div className="flex flex-wrap gap-2">
              <CategoryChip category={agent.category} />
              <StatusBadge agent={agent} />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-white">{agentName}</h2>
            {description ? <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p> : null}
            {canCheckAndHire ? (
              <div className="bnb-warning mt-5 p-4 text-sm leading-6">
                Wallet confirmation is required before paid work starts.
              </div>
            ) : null}
          </BnbPanel>
        </aside>
      </BnbContainer>
    </BnbShell>
  );
}

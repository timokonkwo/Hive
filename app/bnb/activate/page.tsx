import { notFound, redirect } from "next/navigation";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { canHireBnbAgent } from "@/lib/bnb/runtime";
import { BnbContainer, BnbPageHeader, BnbPanel, BnbShell } from "@/app/bnb/_components/BnbUi";
import { bnbAgentDisplayName, bnbCategoryLabel, bnbListingDescription, bnbStatusLabel } from "@/lib/bnb/display";
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
  if (!canHire) {
    redirect(`/bnb/agents/${agent.chainId}/${encodeURIComponent(agent.tokenId)}`);
  }
  const agentName = bnbAgentDisplayName(agent);
  const description = bnbListingDescription(agent);

  return (
    <BnbShell>
      <BnbPageHeader
        title={`Hire ${agentName}`}
      />
      <BnbContainer className="bnb-section grid gap-8 lg:grid-cols-[1fr_320px]">
        <ActivationForm key={`${agent.chainId}:${agent.tokenId}`} agent={agent} />

        <aside className="content-start">
          <BnbPanel className="p-5">
            <h2 className="text-xl font-semibold text-white">{agentName}</h2>
            {description ? <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p> : null}
            <dl className="mt-5">
              <div className="bnb-data-row">
                <dt>Category</dt>
                <dd className="bnb-data-value"><span>{bnbCategoryLabel(agent.category)}</span></dd>
              </div>
              <div className="bnb-data-row">
                <dt>Availability</dt>
                <dd className="bnb-data-value"><span>{bnbStatusLabel(agent)}</span></dd>
              </div>
            </dl>
          </BnbPanel>
        </aside>
      </BnbContainer>
    </BnbShell>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BnbContainer, BnbShell } from "@/app/bnb/_components/BnbUi";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { bnbAgentDisplayName } from "@/lib/bnb/display";
import { canHireBnbAgent } from "@/lib/bnb/runtime";
import { bnbAgentProfilePath } from "@/lib/bnb/routes";
import { ActivationForm } from "./ActivationForm";
import styles from "./hire.module.css";

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
  if (!canHireBnbAgent(agent)) {
    redirect(`/bnb/agents/${agent.chainId}/${encodeURIComponent(agent.tokenId)}`);
  }

  const agentName = bnbAgentDisplayName(agent);

  return (
    <BnbShell active="agents" variant="landing">
      <div className={styles.page}>
        <BnbContainer className={styles.container}>
          <Link href={bnbAgentProfilePath(agent)} className={styles.backLink}>
            <ArrowLeft aria-hidden="true" size={16} />
            Agent profile
          </Link>
          <header className={styles.pageHeader}>
            <span>Hire agent</span>
            <h1>{agentName}</h1>
          </header>
          <ActivationForm key={`${agent.chainId}:${agent.tokenId}`} agent={agent} />
        </BnbContainer>
      </div>
    </BnbShell>
  );
}

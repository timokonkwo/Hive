import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { getBnbAgent } from "@/lib/bnb/catalog";
import type { BnbAgentProfile } from "@/lib/bnb/types";
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
  canHireAgent,
  freshnessLabel,
  getAgentIntegrations,
  priceLabel,
  reviewLabel,
  listingDescription,
  sourceLabel,
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
  const description = listingDescription(agent);

  return (
    <BnbShell active="agents">
      <BnbHero title={agent.name} body={description || "Registered BNB Chain agent."} kicker="Agent profile">
        <BnbPanel className="p-5">
          <div className="flex flex-wrap gap-2">
            <CategoryChip category={agent.category} />
            <StatusBadge agent={agent} />
            <span className="bnb-chip bnb-chip-gold">BNB Smart Chain</span>
          </div>
          <div className="mt-5 grid gap-3">
            <DataRow label="Price" value={priceLabel(agent)} />
            <DataRow label="Reviews" value={reviewLabel(agent)} />
            <DataRow label="Last active" value={freshnessLabel(agent.lastActivity)} />
          </div>
        </BnbPanel>
      </BnbHero>

      <BnbContainer className="bnb-section grid gap-8 lg:grid-cols-[1fr_320px]">
        <section className="grid gap-8">
          <section>
            <BnbSectionHeader eyebrow="Overview" title="What this agent does" />
            <BnbPanel className="p-5">
              {description ? (
                <p className="text-sm leading-6 text-zinc-300">{description}</p>
              ) : (
                <p className="text-sm leading-6 text-zinc-400">Service description unavailable.</p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {getAgentIntegrations(agent).map((integration) => (
                  <span key={integration} className={integration === "BNB Smart Chain" ? "bnb-chip bnb-chip-gold" : "bnb-chip"}>
                    {integration}
                  </span>
                ))}
              </div>
            </BnbPanel>
          </section>

          <section>
            <BnbSectionHeader eyebrow="Pricing" title="Available services" />
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
            <BnbSectionHeader eyebrow="Performance" title="Marketplace signals" />
            <BnbPanel className="p-5">
              <dl className="grid gap-1 sm:grid-cols-3">
                <DataRow label="Reviews" value={reviewLabel(agent)} />
                <DataRow label="Positive feedback" value={positiveFeedbackLabel(agent)} />
                <DataRow label="Last active" value={freshnessLabel(agent.lastActivity)} />
              </dl>
              {agent.feedback.summary ? <p className="mt-4 text-sm leading-6 text-zinc-400">{agent.feedback.summary}</p> : null}
            </BnbPanel>
          </section>

          <section>
            <BnbSectionHeader eyebrow="Selection" title="Why Hive ranks this agent" />
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
            <BnbSectionHeader eyebrow="Capabilities" title="Tasks this agent handles" />
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map((capability) => (
                <span key={capability} className="bnb-chip">{capability}</span>
              ))}
            </div>
          </section>
        </section>

        <aside className="grid content-start gap-5">
          <BnbPanel className="p-5">
            <h2 className="text-lg font-semibold text-white">Selection signals</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Based on category fit, reviews, hire readiness, recent activity, and risk checks.
            </p>
            <div className="mt-4">
              <ScoreGrid score={agent.scoreBreakdown} />
            </div>
          </BnbPanel>

          <BnbPanel className="p-5">
            <h2 className="text-lg font-semibold text-white">Onchain identity</h2>
            <dl className="mt-4">
              <DataRow label="Network" value="BNB Smart Chain" />
              <DataRow label="ERC-8004 ID" value={agent.tokenId} />
              <DataRow label="Owner" value={shortAddress(agent.ownerAddress)} />
              <DataRow label="Agent wallet" value={shortAddress(agent.agentWallet)} />
              <DataRow label="Source" value={sourceLabel(agent)} />
            </dl>
            <div className="mt-5 grid gap-3">
              <ExternalTextLink href={`https://8004scan.io/agents/${agent.chainId}/${agent.tokenId}`}>View on 8004scan</ExternalTextLink>
              <ExternalTextLink href={`https://bscscan.com/address/${agent.agentWallet}`}>View wallet on BscScan</ExternalTextLink>
            </div>
          </BnbPanel>

          {canHireAgent(agent) ? (
            <Link href={`/bnb/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`} className="bnb-button bnb-focus">
              Hire agent <ArrowRight aria-hidden="true" size={16} />
            </Link>
          ) : (
            <Link href={`/bnb/match?intent=${encodeURIComponent(`Contact ${agent.name}`)}`} className="bnb-button bnb-focus">
              Request access <ArrowRight aria-hidden="true" size={16} />
            </Link>
          )}
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

function positiveFeedbackLabel(agent: BnbAgentProfile) {
  if (agent.feedback.count <= 0) return "No reviews yet";
  return `${agent.feedback.positive} of ${agent.feedback.count}`;
}

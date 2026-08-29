import Link from "next/link";
import { ArrowRight, LineChart } from "lucide-react";
import { getBnbPancakeSwapUtilities } from "@/lib/bnb/catalog";
import { BnbContainer, BnbHero, BnbPanel, BnbShell } from "@/app/bnb/_components/BnbUi";
import { PancakePairAnalyzer } from "@/app/bnb/pancakeswap/PancakePairAnalyzer";

export default function BnbPancakeSwapPage() {
  const jobs = getBnbPancakeSwapUtilities();

  return (
    <BnbShell>
      <BnbHero
        kicker="PancakeSwap"
        title="PancakeSwap agents"
        body="Check a pair or hire an agent for yield routes, LP ranges, and farm monitoring."
      />

      <BnbContainer className="bnb-section">
        <div className="mb-8">
          <PancakePairAnalyzer />
        </div>

        <div className="bnb-list-head">
          <div>
            <h2>Available jobs</h2>
            <p>Pick the work you need. You can edit the task and budget before hiring.</p>
          </div>
          <Link href="/match?intent=Rank%20PancakeSwap%20yield%20routes%20and%20explain%20risk" className="bnb-button bnb-focus">
            Match an agent
          </Link>
        </div>

        <BnbPanel className="overflow-hidden">
          {jobs.map((job) => (
            <article key={job.id} className="bnb-agent-row">
              <div>
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <LineChart aria-hidden="true" size={15} />
                  <span>{job.agentName}</span>
                </div>
                <h2 className="mt-3 text-xl font-semibold text-white">{job.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{job.agentOutput}</p>
              </div>
              <div className="bnb-agent-side">
                <div className="bnb-score-compact">
                  <span>Starting price</span>
                  <strong>{job.scoring.find((item) => item.label === "Target cost")?.value || "Set"}</strong>
                </div>
                <Link href={job.activationHref} className="bnb-button-dark bnb-focus">
                  Find agents <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </div>
            </article>
          ))}
        </BnbPanel>
      </BnbContainer>
    </BnbShell>
  );
}

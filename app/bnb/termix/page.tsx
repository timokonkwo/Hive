import { ClipboardList } from "lucide-react";
import { getBnbTermixCaptures } from "@/lib/bnb/catalog";
import { BnbContainer, BnbHero, BnbPanel, BnbShell } from "@/app/bnb/_components/BnbUi";
import { TermixCaptureForm } from "./TermixCaptureForm";

export default function BnbTermixPage() {
  const comparisons = getBnbTermixCaptures();

  return (
    <BnbShell active="activity" back={{ href: "/activity?filter=comparisons", label: "Back to activity" }}>
      <BnbHero
        kicker="TermiX"
        title="Work comparisons"
        body="Save side-by-side records for manual checks and agent results."
      />

      <BnbContainer className="bnb-section grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <div className="bnb-list-head">
            <div>
              <h2>Comparison types</h2>
              <p>Choose the record type, then save the result.</p>
            </div>
          </div>

          <BnbPanel className="overflow-hidden">
            {comparisons.map((comparison) => (
              <article key={comparison.id} className="bnb-agent-row">
                <div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <ClipboardList aria-hidden="true" size={15} />
                    <span>{comparison.target}</span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-white">{comparison.title}</h2>
                </div>
                <div className="bnb-agent-side">
                  <div className="bnb-score-compact">
                    <span>Record</span>
                    <strong>Result</strong>
                  </div>
                </div>
              </article>
            ))}
          </BnbPanel>
        </section>

        <aside className="self-start">
          <TermixCaptureForm captures={comparisons} />
        </aside>
      </BnbContainer>
    </BnbShell>
  );
}

import { ClipboardList } from "lucide-react";
import { getBnbTermixCaptures } from "@/lib/bnb/catalog";
import { BnbContainer, BnbHero, BnbPanel, BnbShell } from "@/app/bnb/_components/BnbUi";
import { TermixCaptureForm } from "./TermixCaptureForm";

export default function BnbTermixPage() {
  const comparisons = getBnbTermixCaptures();

  return (
    <BnbShell>
      <BnbHero
        kicker="Hive"
        title="Comparisons"
        body="Save a manual result, an agent result, time spent, and the final decision."
      />

      <BnbContainer className="bnb-section grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <div className="bnb-list-head">
            <div>
              <h2>Comparison types</h2>
              <p>Use these when you want a clean record of what changed after using an agent.</p>
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
                <div className="bnb-score">
                  <div className="text-sm font-semibold text-emerald-300">Save result</div>
                  <div className="text-xs text-zinc-500">Private receipt</div>
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

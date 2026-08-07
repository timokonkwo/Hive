import { Bell, WalletCards } from "lucide-react";
import { getBnbAltanaSessionTemplates } from "@/lib/bnb/catalog";
import { BnbContainer, BnbHero, BnbPanel, BnbShell } from "@/app/bnb/_components/BnbUi";
import { AltanaSessionForm } from "./AltanaSessionForm";
import { AltanaRevokeForm } from "./AltanaRevokeForm";

export default function BnbAltanaPage() {
  const alerts = getBnbAltanaSessionTemplates();

  return (
    <BnbShell>
      <BnbHero
        kicker="Hive"
        title="Wallet alerts"
        body="Let an agent watch a wallet or position and notify you when something needs attention."
      />

      <BnbContainer className="bnb-section grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <div className="bnb-list-head">
            <div>
              <h2>Choose what to watch</h2>
              <p>Start with a common wallet job, then set the wallet and trigger.</p>
            </div>
          </div>

          <BnbPanel className="overflow-hidden">
            {alerts.map((alert) => (
              <article key={alert.id} className="bnb-agent-row">
                <div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Bell aria-hidden="true" size={15} />
                    <span>{alert.expiry}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-white">{alert.title}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{alert.summary}</p>
                </div>
                <div className="bnb-score">
                  <div className="text-sm font-semibold text-emerald-300">{alert.spendCap}</div>
                  <div className="text-xs text-zinc-500">Budget</div>
                </div>
              </article>
            ))}
          </BnbPanel>
        </section>

        <aside className="self-start">
          <AltanaSessionForm templates={alerts} />
          <div className="mt-4">
            <AltanaRevokeForm />
          </div>
          <div className="bnb-panel-muted mt-4 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <WalletCards aria-hidden="true" size={16} />
              Manage alerts
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Saved alerts appear in Receipts. Stop an alert from the receipt when you no longer need it.
            </p>
          </div>
        </aside>
      </BnbContainer>
    </BnbShell>
  );
}

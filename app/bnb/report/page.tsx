import { BnbHero, BnbShell } from "@/app/bnb/_components/BnbUi";
import { ReceiptsClient } from "./ReceiptsClient";

export default function BnbReportPage() {
  return (
    <BnbShell active="receipts">
      <BnbHero
        kicker="Private history"
        title="Receipts"
        body="Your saved hires, wallet alerts, comparisons, and escrow payments."
      />
      <ReceiptsClient />
    </BnbShell>
  );
}

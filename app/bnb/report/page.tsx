import { BnbHero, BnbShell } from "@/app/bnb/_components/BnbUi";
import { ReceiptsClient } from "./ReceiptsClient";

export default function BnbReportPage() {
  return (
    <BnbShell>
      <BnbHero
        kicker="Hive"
        title="Receipts"
        body="Your saved hires, wallet alerts, comparisons, and escrow payments."
      />
      <ReceiptsClient />
    </BnbShell>
  );
}

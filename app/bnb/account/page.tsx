import { BnbHero, BnbShell } from "@/app/bnb/_components/BnbUi";
import { BnbAccountClient } from "./BnbAccountClient";
import { ReceiptsClient } from "@/app/bnb/report/ReceiptsClient";

export default function BnbAccountPage() {
  return (
    <BnbShell active="account">
      <BnbHero
        kicker="Account"
        title="Account"
        body="Manage your BNB wallet, hires, alerts, and payments."
      />
      <BnbAccountClient />
      <ReceiptsClient embedded />
    </BnbShell>
  );
}

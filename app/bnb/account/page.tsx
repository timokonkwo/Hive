import { BnbPageHeader, BnbShell } from "@/app/bnb/_components/BnbUi";
import { BnbAccountClient } from "./BnbAccountClient";
import { ReceiptsClient } from "@/app/bnb/report/ReceiptsClient";

export default function BnbAccountPage() {
  return (
    <BnbShell active="account">
      <BnbPageHeader
        title="My hires"
        body="Manage your wallet, requests, active work, and completed hires."
      />
      <BnbAccountClient />
      <ReceiptsClient embedded />
    </BnbShell>
  );
}

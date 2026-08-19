import { BnbPageHeader, BnbShell } from "@/app/bnb/_components/BnbUi";
import { BnbJobClient } from "./BnbJobClient";

type Params = Promise<{ recordId: string }>;

export default async function BnbJobPage({ params }: { params: Params }) {
  const { recordId } = await params;

  return (
    <BnbShell active="account">
      <BnbPageHeader
        title="Job"
        body="Track funding, agent delivery, and payment from one place."
      />
      <BnbJobClient recordId={recordId} />
    </BnbShell>
  );
}

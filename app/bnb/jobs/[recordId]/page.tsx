import { BnbShell } from "@/app/bnb/_components/BnbUi";
import { BnbJobClient } from "./BnbJobClient";

type Params = Promise<{ recordId: string }>;

export default async function BnbJobPage({ params }: { params: Params }) {
  const { recordId } = await params;

  return (
    <BnbShell active="account" variant="landing">
      <BnbJobClient recordId={recordId} />
    </BnbShell>
  );
}

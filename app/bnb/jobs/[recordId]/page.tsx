import { BnbShell } from "@/app/bnb/_components/BnbUi";
import { BnbJobClient } from "./BnbJobClient";

type Params = Promise<{ recordId: string }>;

export default async function BnbJobPage({ params }: { params: Params }) {
  const { recordId } = await params;

  return (
    <BnbShell active="activity" variant="landing" back={{ href: "/activity?filter=jobs", label: "Back to activity" }}>
      <BnbJobClient recordId={recordId} />
    </BnbShell>
  );
}

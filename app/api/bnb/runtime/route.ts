import { NextRequest, NextResponse } from "next/server";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { getBnbEndpointProbeSummary } from "@/lib/bnb/endpoint-observability";
import { getBnbRuntimeReadiness } from "@/lib/bnb/runtime";

export async function GET(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "runtime", "read");
  if (limited) return limited;

  const readiness = getBnbRuntimeReadiness();
  const endpointProbes = await getBnbEndpointProbeSummary();
  return NextResponse.json({
    ...readiness,
    observability: {
      ...readiness.observability,
      endpointProbes,
    },
  });
}

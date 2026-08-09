import { NextRequest, NextResponse } from "next/server";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { getBnbRuntimeReadiness } from "@/lib/bnb/runtime";

export async function GET(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "runtime", "read");
  if (limited) return limited;

  return NextResponse.json(getBnbRuntimeReadiness());
}

import { NextRequest, NextResponse } from "next/server";
import { getBscAddressSummary } from "@/lib/bnb/chain";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const limited = await enforceBnbRateLimit(request, "bsc:address", "read");
  if (limited) return limited;

  const { address } = await params;
  const summary = await getBscAddressSummary(address);
  const status = summary.valid ? 200 : 400;

  return NextResponse.json({ summary }, { status });
}

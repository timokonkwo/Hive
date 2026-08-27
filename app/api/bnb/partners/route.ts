import { NextRequest, NextResponse } from "next/server";
import {
  getBnbAltanaSessionTemplates,
  getBnbPancakeSwapUtilities,
  getBnbPartnerTracks,
  getBnbTermixCaptures,
} from "@/lib/bnb/catalog";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

export async function GET(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "partners", "read");
  if (limited) return limited;

  return NextResponse.json({
    status: "active",
    tracks: getBnbPartnerTracks(),
    pancakeSwap: getBnbPancakeSwapUtilities(),
    termix: getBnbTermixCaptures(),
    altana: getBnbAltanaSessionTemplates(),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getBnbPancakeSwapUtilities } from "@/lib/bnb/catalog";
import { analyzePancakeSwapV2Pair } from "@/lib/bnb/pancakeswap";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "pancakeswap:get", "read");
  if (limited) return limited;

  return NextResponse.json({
    status: "ok",
    utilities: getBnbPancakeSwapUtilities(),
  });
}

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "pancakeswap:post", "write");
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const tokenA = readString(body.tokenA);
  const tokenB = readString(body.tokenB);

  try {
    const analysis = await analyzePancakeSwapV2Pair({ tokenA, tokenB });
    return NextResponse.json({
      status: "ok",
      analysis,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not analyze PancakeSwap pair.",
    }, { status: 502 });
  }
}

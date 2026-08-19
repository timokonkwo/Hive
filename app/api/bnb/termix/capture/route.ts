import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient } from "@/lib/bnb/auth";
import { getBscAddressSummary } from "@/lib/bnb/chain";
import { getBnbTermixCaptures } from "@/lib/bnb/catalog";
import { analyzePancakeSwapV2Pair } from "@/lib/bnb/pancakeswap";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, createBnbTermixComparisonRecord, normalizeTermixVerdict } from "@/lib/bnb/records";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function addressesFrom(value: string) {
  return value.match(/0x[a-fA-F0-9]{40}/g) || [];
}

async function generateAgentOutput(target: string) {
  const addresses = addressesFrom(target);
  if (addresses.length >= 2) {
    const analysis = await analyzePancakeSwapV2Pair({ tokenA: addresses[0], tokenB: addresses[1] });
    return {
      output: [
        `${analysis.token0.symbol}/${analysis.token1.symbol} pair checked on PancakeSwap V2.`,
        `Pair: ${analysis.pairAddress}.`,
        `Reserves: ${analysis.token0.reserve} ${analysis.token0.symbol} and ${analysis.token1.reserve} ${analysis.token1.symbol}.`,
        `Spot price: 1 ${analysis.token0.symbol} = ${analysis.priceToken0InToken1} ${analysis.token1.symbol}.`,
        `Explorer: ${analysis.explorerUrl}.`,
      ].join("\n"),
      dataSources: analysis.dataSources,
      agentTime: "Under 10 sec",
    };
  }

  if (addresses[0]) {
    const summary = await getBscAddressSummary(addresses[0]);
    if (summary.error) throw new Error(summary.error);
    return {
      output: [
        `Address checked: ${summary.address}.`,
        `Type: ${summary.accountType || "unknown"}.`,
        summary.balanceBNB ? `BNB balance: ${summary.balanceBNB}.` : null,
        typeof summary.transactionCount === "number" ? `Transaction count: ${summary.transactionCount}.` : null,
        `Explorer: ${summary.explorerUrl}.`,
      ].filter(Boolean).join("\n"),
      dataSources: ["BSC RPC", "BscScan address link"],
      agentTime: "Under 10 sec",
    };
  }

  return null;
}

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "termix:capture", "write");
  if (limited) return limited;

  const auth = await requireBnbClient(request, "save a comparison");
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const caseId = readString(body.caseId);
  const target = readString(body.target);
  const manualTime = readString(body.manualTime);
  const agentTime = readString(body.agentTime);
  const agentTokenId = readString(body.agentTokenId);
  const verdict = readString(body.verdict);
  const artifactUrl = readString(body.artifactUrl);
  const transactionHash = readString(body.transactionHash);
  const manualOutput = readString(body.manualOutput);
  const agentOutput = readString(body.agentOutput);
  const qualityScore = readString(body.qualityScore);
  const notes = readString(body.notes);

  if (!caseId || !target) {
    return NextResponse.json({ error: "caseId and target are required" }, { status: 400 });
  }

  const capture = getBnbTermixCaptures().find((item) => item.id === caseId);
  if (!capture) {
    return NextResponse.json({ error: "Unknown comparison type" }, { status: 404 });
  }

  let generated:
    | {
        output: string;
        dataSources: string[];
        agentTime: string;
      }
    | null = null;

  try {
    if (!agentOutput) {
      generated = await generateAgentOutput(target);
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not run BSC comparison." }, { status: 502 });
  }

  let record;
  try {
    record = await createBnbTermixComparisonRecord({
      capture,
      target,
      manualTime,
      agentTime: agentTime || generated?.agentTime,
      agentTokenId,
      verdict: normalizeTermixVerdict(verdict),
      clientAddress: auth.client.userId,
      artifactUrl,
      transactionHash,
      manualOutput,
      agentOutput: agentOutput || generated?.output,
      dataSources: generated?.dataSources,
      qualityScore,
      notes,
    });
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save comparison." }, { status: 500 });
  }

  return NextResponse.json({
    status: "saved",
    message: "Comparison saved.",
    receiptId: record.receiptId,
    recordId: record.recordId,
    storage: record.storage,
    comparison: record,
    record,
  });
}

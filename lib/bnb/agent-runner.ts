import { getBscAddressSummary } from "@/lib/bnb/chain";
import { analyzePancakeSwapV2Pair } from "@/lib/bnb/pancakeswap";
import type { BnbActivationRecord, BnbAgentWork } from "@/lib/bnb/types";

function firstAddress(value: string) {
  return value.match(/0x[a-fA-F0-9]{40}/)?.[0] || null;
}

function firstTwoAddresses(value: string) {
  const matches = value.match(/0x[a-fA-F0-9]{40}/g) || [];
  return {
    tokenA: matches[0] || null,
    tokenB: matches[1] || null,
  };
}

function completedWork(output: string, dataSources: string[]): BnbAgentWork {
  const now = new Date().toISOString();
  return {
    status: "completed",
    startedAt: now,
    completedAt: now,
    output,
    dataSources,
  };
}

async function runPancakePairWork(record: BnbActivationRecord) {
  const tokens = firstTwoAddresses(record.limits.task);
  const analysis = await analyzePancakeSwapV2Pair(tokens);
  const output = [
    `${analysis.token0.symbol}/${analysis.token1.symbol} pair checked on PancakeSwap V2.`,
    `Pair: ${analysis.pairAddress}.`,
    `Reserves: ${analysis.token0.reserve} ${analysis.token0.symbol} and ${analysis.token1.reserve} ${analysis.token1.symbol}.`,
    `Spot price: 1 ${analysis.token0.symbol} = ${analysis.priceToken0InToken1} ${analysis.token1.symbol}.`,
    `Reverse price: 1 ${analysis.token1.symbol} = ${analysis.priceToken1InToken0} ${analysis.token0.symbol}.`,
    `Explorer: ${analysis.explorerUrl}.`,
  ].join("\n");

  return completedWork(output, analysis.dataSources);
}

async function runWalletOrContractCheck(record: BnbActivationRecord) {
  const address = firstAddress(record.limits.task);
  if (!address) {
    throw new Error("Add a BSC wallet, token, pool, or contract address to the work details.");
  }

  const summary = await getBscAddressSummary(address);
  if (summary.error) throw new Error(summary.error);

  const output = [
    `Address checked: ${summary.address}.`,
    `Type: ${summary.accountType || "unknown"}.`,
    summary.balanceBNB ? `BNB balance: ${summary.balanceBNB}.` : null,
    typeof summary.transactionCount === "number" ? `Transaction count: ${summary.transactionCount}.` : null,
    `Explorer: ${summary.explorerUrl}.`,
  ].filter(Boolean).join("\n");

  return completedWork(output, ["BSC RPC", "BscScan address link"]);
}

export async function runBnbAgentWork(record: BnbActivationRecord): Promise<BnbAgentWork> {
  const normalizedTask = `${record.agent.tokenId} ${record.agent.name} ${record.limits.task}`.toLowerCase();

  if (
    normalizedTask.includes("pancake") ||
    normalizedTask.includes("yield") ||
    normalizedTask.includes("rebalance") ||
    normalizedTask.includes("grid") ||
    normalizedTask.includes("lp")
  ) {
    return runPancakePairWork(record);
  }

  if (
    normalizedTask.includes("health") ||
    normalizedTask.includes("audit") ||
    normalizedTask.includes("risk") ||
    normalizedTask.includes("wallet") ||
    normalizedTask.includes("token") ||
    normalizedTask.includes("pool")
  ) {
    return runWalletOrContractCheck(record);
  }

  return runPancakePairWork(record);
}

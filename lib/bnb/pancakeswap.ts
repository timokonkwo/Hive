import { formatUnits, getAddress, isAddress, type Address } from "viem";
import { getBscClient, getBscExplorerAddressUrl } from "@/lib/bnb/chain";

const PANCAKESWAP_V2_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73" as const;
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as const;
const USDT = "0x55d398326f99059fF775485246999027B3197955" as const;

const FACTORY_ABI = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
] as const;

const PAIR_ABI = [
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export type PancakeSwapPairAnalysis = {
  checkedAt: string;
  factory: string;
  pairAddress: string;
  token0: {
    address: string;
    symbol: string;
    decimals: number;
    reserve: string;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
    reserve: string;
  };
  priceToken0InToken1: string;
  priceToken1InToken0: string;
  explorerUrl: string;
  dataSources: string[];
};

function parseToken(value: string | undefined | null, fallback: Address) {
  if (!value) return fallback;
  const trimmed = value.trim();
  return isAddress(trimmed) ? getAddress(trimmed) as Address : fallback;
}

function numberFromUnits(value: bigint, decimals: number) {
  const formatted = formatUnits(value, decimals);
  const parsed = Number(formatted);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readTokenMetadata(address: Address) {
  const client = getBscClient();
  const [symbolResult, decimalsResult] = await Promise.allSettled([
    client.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }),
    client.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
  ]);

  return {
    symbol: symbolResult.status === "fulfilled" ? symbolResult.value : address.slice(0, 6),
    decimals: decimalsResult.status === "fulfilled" ? Number(decimalsResult.value) : 18,
  };
}

export async function analyzePancakeSwapV2Pair({
  tokenA,
  tokenB,
}: {
  tokenA?: string | null;
  tokenB?: string | null;
} = {}): Promise<PancakeSwapPairAnalysis> {
  const checkedAt = new Date().toISOString();
  const client = getBscClient();
  const normalizedTokenA = parseToken(tokenA, WBNB);
  const normalizedTokenB = parseToken(tokenB, USDT);

  const pairAddress = await client.readContract({
    address: PANCAKESWAP_V2_FACTORY,
    abi: FACTORY_ABI,
    functionName: "getPair",
    args: [normalizedTokenA, normalizedTokenB],
  });

  if (!isAddress(pairAddress) || pairAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("PancakeSwap V2 pair was not found for those tokens.");
  }

  const pair = getAddress(pairAddress) as Address;
  const [token0, token1, reserves] = await Promise.all([
    client.readContract({ address: pair, abi: PAIR_ABI, functionName: "token0" }),
    client.readContract({ address: pair, abi: PAIR_ABI, functionName: "token1" }),
    client.readContract({ address: pair, abi: PAIR_ABI, functionName: "getReserves" }),
  ]);

  const [token0Meta, token1Meta] = await Promise.all([
    readTokenMetadata(token0),
    readTokenMetadata(token1),
  ]);

  const reserve0 = numberFromUnits(reserves[0], token0Meta.decimals);
  const reserve1 = numberFromUnits(reserves[1], token1Meta.decimals);
  const priceToken0InToken1 = reserve0 > 0 ? reserve1 / reserve0 : 0;
  const priceToken1InToken0 = reserve1 > 0 ? reserve0 / reserve1 : 0;

  return {
    checkedAt,
    factory: PANCAKESWAP_V2_FACTORY,
    pairAddress: pair,
    token0: {
      address: token0,
      symbol: token0Meta.symbol,
      decimals: token0Meta.decimals,
      reserve: reserve0.toLocaleString("en-US", { maximumFractionDigits: 6 }),
    },
    token1: {
      address: token1,
      symbol: token1Meta.symbol,
      decimals: token1Meta.decimals,
      reserve: reserve1.toLocaleString("en-US", { maximumFractionDigits: 6 }),
    },
    priceToken0InToken1: priceToken0InToken1.toLocaleString("en-US", { maximumFractionDigits: 8 }),
    priceToken1InToken0: priceToken1InToken0.toLocaleString("en-US", { maximumFractionDigits: 8 }),
    explorerUrl: getBscExplorerAddressUrl(pair),
    dataSources: [
      "BSC RPC",
      "PancakeSwap V2 factory",
      "PancakeSwap V2 pair reserves",
    ],
  };
}

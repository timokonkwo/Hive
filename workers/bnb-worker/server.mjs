import { createServer } from "node:http";
import {
  createPublicClient,
  formatEther,
  formatUnits,
  getAddress,
  http,
  isAddress,
} from "viem";
import { bsc } from "viem/chains";

const PORT = Number(process.env.PORT || 8080);
const RPC_URL = process.env.BNB_BSC_RPC_URL || "https://bsc-dataseed.bnbchain.org";
const API_KEY = process.env.BNB_AGENT_WORKER_API_KEY || "";

const PANCAKESWAP_V2_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const USDT = "0x55d398326f99059fF775485246999027B3197955";

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
];

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
];

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
];

const client = createPublicClient({
  chain: bsc,
  transport: http(RPC_URL),
});

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256 * 1024) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function authorized(req) {
  if (!API_KEY) return false;
  return req.headers.authorization === `Bearer ${API_KEY}`;
}

function addressesFrom(value) {
  return String(value || "").match(/0x[a-fA-F0-9]{40}/g) || [];
}

function tokenOrFallback(value, fallback) {
  return value && isAddress(value) ? getAddress(value) : fallback;
}

async function readToken(address) {
  const [symbolResult, decimalsResult] = await Promise.allSettled([
    client.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }),
    client.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
  ]);

  return {
    symbol: symbolResult.status === "fulfilled" ? symbolResult.value : `${address.slice(0, 6)}...`,
    decimals: decimalsResult.status === "fulfilled" ? Number(decimalsResult.value) : 18,
  };
}

function asNumber(value, decimals) {
  const parsed = Number(formatUnits(value, decimals));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function analyzePair(tokenA, tokenB) {
  const normalizedTokenA = tokenOrFallback(tokenA, WBNB);
  const normalizedTokenB = tokenOrFallback(tokenB, USDT);
  const pairAddress = await client.readContract({
    address: PANCAKESWAP_V2_FACTORY,
    abi: FACTORY_ABI,
    functionName: "getPair",
    args: [normalizedTokenA, normalizedTokenB],
  });

  if (!isAddress(pairAddress) || pairAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("PancakeSwap V2 pair was not found for those tokens.");
  }

  const pair = getAddress(pairAddress);
  const [token0, token1, reserves] = await Promise.all([
    client.readContract({ address: pair, abi: PAIR_ABI, functionName: "token0" }),
    client.readContract({ address: pair, abi: PAIR_ABI, functionName: "token1" }),
    client.readContract({ address: pair, abi: PAIR_ABI, functionName: "getReserves" }),
  ]);
  const [token0Meta, token1Meta] = await Promise.all([readToken(token0), readToken(token1)]);
  const reserve0 = asNumber(reserves[0], token0Meta.decimals);
  const reserve1 = asNumber(reserves[1], token1Meta.decimals);

  return [
    `${token0Meta.symbol}/${token1Meta.symbol} pair checked on PancakeSwap V2.`,
    `Pair: ${pair}.`,
    `Reserves: ${reserve0.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${token0Meta.symbol} and ${reserve1.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${token1Meta.symbol}.`,
    `Spot price: 1 ${token0Meta.symbol} = ${(reserve1 / reserve0).toLocaleString("en-US", { maximumFractionDigits: 8 })} ${token1Meta.symbol}.`,
    `Explorer: https://bscscan.com/address/${pair}.`,
  ].join("\n");
}

async function inspectAddress(address) {
  if (!isAddress(address)) throw new Error("Invalid BSC address.");
  const normalized = getAddress(address);
  const [balance, transactionCount, bytecode] = await Promise.all([
    client.getBalance({ address: normalized }),
    client.getTransactionCount({ address: normalized }),
    client.getBytecode({ address: normalized }),
  ]);

  return [
    `Address checked: ${normalized}.`,
    `Type: ${bytecode && bytecode !== "0x" ? "contract" : "wallet"}.`,
    `BNB balance: ${formatEther(balance)}.`,
    `Transaction count: ${transactionCount}.`,
    `Explorer: https://bscscan.com/address/${normalized}.`,
  ].join("\n");
}

async function runJob(record) {
  const startedAt = new Date().toISOString();
  const task = `${record?.agent?.name || ""} ${record?.limits?.task || ""}`;
  const addresses = addressesFrom(task);
  const output = addresses.length >= 2
    ? await analyzePair(addresses[0], addresses[1])
    : await inspectAddress(addresses[0]);

  return {
    status: "completed",
    startedAt,
    completedAt: new Date().toISOString(),
    output,
    dataSources: ["BSC RPC", addresses.length >= 2 ? "PancakeSwap V2" : "BscScan address link"],
  };
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { status: "ok", chainId: 56 });
    }

    if (req.method !== "POST" || url.pathname !== "/bnb/jobs/run") {
      return sendJson(res, 404, { error: "Not found." });
    }

    if (!authorized(req)) {
      return sendJson(res, 401, { error: "Unauthorized." });
    }

    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const work = await runJob(body.record);
    return sendJson(res, 200, { work });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "BNB worker failed.",
    });
  }
}).listen(PORT, () => {
  console.log(`Hive BNB worker listening on ${PORT}`);
});

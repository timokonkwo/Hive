import { createPublicClient, formatEther, getAddress, http, isAddress } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import {
  getHiveBnbExplorerAddressUrl,
  getHiveBnbExplorerTxUrl,
  getHiveBnbNetworkConfig,
} from "@/lib/bnb/network";
import type { BnbBscAddressSummary } from "@/lib/bnb/types";

const EIGHT004SCAN_AGENT_CHAIN_SLUGS: Record<number, string> = {
  56: "bsc",
  97: "bsc-testnet",
};

const EIGHT004SCAN_AGENT_CHAIN_NAME_SLUGS: Record<string, string> = {
  binance: "bsc",
  "binance-smart-chain": "bsc",
  bnb: "bsc",
  "bnb-chain": "bsc",
  "bnb-smart-chain": "bsc",
  bsc: "bsc",
  "bsc-mainnet": "bsc",
  "binance-smart-chain-testnet": "bsc-testnet",
  "bnb-chain-testnet": "bsc-testnet",
  "bnb-smart-chain-testnet": "bsc-testnet",
  "bsc-testnet": "bsc-testnet",
};

export function getBscRpcUrl() {
  return getHiveBnbNetworkConfig().rpcUrl;
}

export function getBscChainId() {
  return getHiveBnbNetworkConfig().chainId;
}

export function getBscNativeSymbol() {
  return getHiveBnbNetworkConfig().nativeSymbol;
}

export function getBscViemChain() {
  return getBscChainId() === 97 ? bscTestnet : bsc;
}

export function getBscClient() {
  return createPublicClient({
    chain: getBscViemChain(),
    transport: http(getBscRpcUrl()),
  });
}

export function getBscExplorerAddressUrl(address: string) {
  return getHiveBnbExplorerAddressUrl(address);
}

export function getBscExplorerTxUrl(hash: string) {
  return getHiveBnbExplorerTxUrl(hash);
}

export function get8004scanAgentUrl(chainId: string | number, tokenId: string | number) {
  return `https://8004scan.io/agents/${encodeURIComponent(get8004scanChainSlug(chainId))}/${encodeURIComponent(String(tokenId))}`;
}

export function get8004scanChainSlug(chainId: string | number) {
  const numericChainId = Number(chainId);
  if (Number.isFinite(numericChainId)) return EIGHT004SCAN_AGENT_CHAIN_SLUGS[numericChainId] || String(Math.trunc(numericChainId));

  const slug = String(chainId)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return EIGHT004SCAN_AGENT_CHAIN_NAME_SLUGS[slug] || slug;
}

export async function getBscAddressSummary(address: string): Promise<BnbBscAddressSummary> {
  const checkedAt = new Date().toISOString();

  if (!isAddress(address)) {
    return {
      address,
      valid: false,
      checkedAt,
      explorerUrl: getBscExplorerAddressUrl(address),
      error: "Invalid BSC address.",
    };
  }

  const normalizedAddress = getAddress(address);
  const explorerUrl = getBscExplorerAddressUrl(normalizedAddress);

  try {
    const client = getBscClient();
    const [balance, transactionCount, bytecode] = await Promise.all([
      client.getBalance({ address: normalizedAddress }),
      client.getTransactionCount({ address: normalizedAddress }),
      client.getBytecode({ address: normalizedAddress }),
    ]);

    return {
      address: normalizedAddress,
      valid: true,
      checkedAt,
      explorerUrl,
      balanceBNB: formatEther(balance),
      transactionCount,
      accountType: bytecode && bytecode !== "0x" ? "contract" : "wallet",
    };
  } catch (error) {
    return {
      address: normalizedAddress,
      valid: true,
      checkedAt,
      explorerUrl,
      error: error instanceof Error ? error.message : "BSC RPC request failed.",
    };
  }
}

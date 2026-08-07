import { createPublicClient, formatEther, getAddress, http, isAddress } from "viem";
import { bsc } from "viem/chains";
import type { BnbBscAddressSummary } from "@/lib/bnb/types";

const DEFAULT_BSC_RPC_URL = "https://bsc-dataseed.binance.org";

export function getBscRpcUrl() {
  return process.env.BNB_BSC_RPC_URL?.trim() || DEFAULT_BSC_RPC_URL;
}

export function getBscClient() {
  return createPublicClient({
    chain: bsc,
    transport: http(getBscRpcUrl()),
  });
}

export function getBscExplorerAddressUrl(address: string) {
  return `https://bscscan.com/address/${address}`;
}

export function getBscExplorerTxUrl(hash: string) {
  return `https://bscscan.com/tx/${hash}`;
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

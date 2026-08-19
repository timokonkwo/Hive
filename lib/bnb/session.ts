import {
  encodeFunctionData,
  getAddress,
  isAddress,
  keccak256,
  parseEther,
  parseEventLogs,
  toHex,
  type Hex,
} from "viem";
import { getBscChainId, getBscClient, getBscExplorerTxUrl, getBscNativeSymbol } from "@/lib/bnb/chain";
import { BnbTransactionVerificationError } from "@/lib/bnb/errors";
import type { BnbAgentProfile, BnbAltanaSessionRecord, BnbTransactionRequest } from "@/lib/bnb/types";

export const HIVE_BSC_SESSION_REGISTRY_ABI = [
  {
    type: "function",
    name: "grantSession",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "spendCapWei", type: "uint256" },
      { name: "expiresAt", type: "uint64" },
      { name: "permissionsHash", type: "bytes32" },
      { name: "receiptId", type: "string" },
    ],
    outputs: [{ name: "sessionId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "revokeSession",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sessionId", type: "bytes32" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "SessionGranted",
    inputs: [
      { name: "sessionId", type: "bytes32", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "spendCapWei", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false },
      { name: "permissionsHash", type: "bytes32", indexed: false },
      { name: "receiptId", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SessionRevoked",
    inputs: [
      { name: "sessionId", type: "bytes32", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "reason", type: "string", indexed: false },
    ],
  },
] as const;

export type BnbSessionConfirmation = {
  transactionHash: Hex;
  transactionStatus: "success" | "reverted" | "pending";
  explorerUrl: string;
  blockNumber?: string;
  sessionId?: string;
  contractAddress?: string;
};

function getSessionRegistryAddress() {
  const value = process.env.BNB_SESSION_REGISTRY_ADDRESS?.trim();
  if (!value || !isAddress(value)) return null;
  return getAddress(value) as Hex;
}

function nativeBnbAmountWei(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+(?:\.\d{1,18})?)\s*(?:t?bnb)?$/i);
  if (!match) return null;

  try {
    const amount = parseEther(match[1]);
    return amount >= 0n ? amount : null;
  } catch {
    return null;
  }
}

function expiryToUnix(value: string) {
  const trimmed = value.trim().toLowerCase();
  const relative = trimmed.match(/^(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks)$/);
  const now = Math.floor(Date.now() / 1000);

  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const seconds =
      unit.startsWith("minute") ? amount * 60 :
      unit.startsWith("hour") ? amount * 60 * 60 :
      unit.startsWith("day") ? amount * 24 * 60 * 60 :
      amount * 7 * 24 * 60 * 60;
    return now + seconds;
  }

  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);

  return now + 24 * 60 * 60;
}

function sameAddress(a: string | undefined, b: string | undefined) {
  if (!a || !b || !isAddress(a) || !isAddress(b)) return false;
  return getAddress(a) === getAddress(b);
}

function permissionsHashForRecord(record: BnbAltanaSessionRecord) {
  return keccak256(toHex([
    record.recordId,
    record.templateId,
    record.walletAddress || "",
    record.trigger,
    record.budget,
    record.expires,
  ].join(":")));
}

export function buildBnbSessionGrantRequest(record: BnbAltanaSessionRecord, agent: BnbAgentProfile): BnbTransactionRequest {
  const registryAddress = getSessionRegistryAddress();
  if (!registryAddress) {
    return {
      status: "setup_required",
      reason: "Deploy the BSC session registry and set BNB_SESSION_REGISTRY_ADDRESS.",
    };
  }

  if (!isAddress(agent.agentWallet)) {
    return {
      status: "agent_wallet_invalid",
      reason: "This agent needs a valid BSC wallet before it can receive a session grant.",
    };
  }

  const spendCapWei = nativeBnbAmountWei(record.budget);
  if (spendCapWei === null) {
    return {
      status: "budget_needs_bnb",
      reason: `Use a positive ${getBscNativeSymbol()} budget for the session spend cap.`,
    };
  }

  const permissionsHash = permissionsHashForRecord(record);
  const expiresAt = expiryToUnix(record.expires);
  const data = encodeFunctionData({
    abi: HIVE_BSC_SESSION_REGISTRY_ABI,
    functionName: "grantSession",
    args: [getAddress(agent.agentWallet) as Hex, spendCapWei, BigInt(expiresAt), permissionsHash, record.receiptId],
  });

  return {
    status: "ready",
    chainId: getBscChainId(),
    contractAddress: registryAddress,
    to: registryAddress,
    value: "0",
    data,
    label: "Grant session",
  };
}

export function buildBnbSessionRevokeRequest(record: BnbAltanaSessionRecord, reason: string): BnbTransactionRequest {
  const registryAddress = getSessionRegistryAddress();
  if (!registryAddress) {
    return {
      status: "setup_required",
      reason: "Deploy the BSC session registry and set BNB_SESSION_REGISTRY_ADDRESS.",
    };
  }

  const sessionId = record.session?.sessionId;
  if (!sessionId || !/^0x[0-9a-fA-F]{64}$/.test(sessionId)) {
    return {
      status: "not_ready",
      reason: "This alert does not have a confirmed onchain session yet.",
    };
  }

  const data = encodeFunctionData({
    abi: HIVE_BSC_SESSION_REGISTRY_ABI,
    functionName: "revokeSession",
    args: [sessionId as Hex, reason || "Stopped from Hive"],
  });

  return {
    status: "ready",
    chainId: getBscChainId(),
    contractAddress: registryAddress,
    to: registryAddress,
    value: "0",
    data,
    label: "Revoke session",
  };
}

export async function readBnbSessionGrant(
  txHash: string,
  expectedRecord?: BnbAltanaSessionRecord,
  expectedAgent?: BnbAgentProfile
): Promise<BnbSessionConfirmation> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new Error("Invalid BSC transaction hash.");
  }

  const registryAddress = getSessionRegistryAddress();
  if (!registryAddress) {
    throw new BnbTransactionVerificationError("Deploy the BSC session registry and set BNB_SESSION_REGISTRY_ADDRESS before confirming sessions.");
  }

  const hash = txHash as Hex;
  const client = getBscClient();
  const explorerUrl = getBscExplorerTxUrl(hash);

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash });
  } catch {
    return {
      transactionHash: hash,
      transactionStatus: "pending",
      explorerUrl,
    };
  }

  if (receipt.status !== "success") {
    return {
      transactionHash: hash,
      transactionStatus: "reverted",
      explorerUrl,
      blockNumber: receipt.blockNumber.toString(),
      contractAddress: receipt.to || undefined,
    };
  }

  const grantedEvents = parseEventLogs({
    abi: HIVE_BSC_SESSION_REGISTRY_ABI,
    eventName: "SessionGranted",
    logs: receipt.logs,
  });
  const grantedEvent = grantedEvents.find((event) => sameAddress(event.address, registryAddress));

  if (!grantedEvent) {
    throw new BnbTransactionVerificationError("Transaction does not contain a Hive session grant event from the configured BSC session registry.");
  }

  if (expectedRecord && expectedAgent) {
    const expectedSpendCap = nativeBnbAmountWei(expectedRecord.budget);
    if (expectedSpendCap === null) {
      throw new BnbTransactionVerificationError("Saved wallet alert has an invalid BNB spend cap and cannot be verified against the session grant.");
    }
    if (!sameAddress(grantedEvent.args.agent, expectedAgent.agentWallet)) {
      throw new BnbTransactionVerificationError("Session grant transaction targets a different agent wallet.");
    }
    if (grantedEvent.args.spendCapWei !== expectedSpendCap) {
      throw new BnbTransactionVerificationError("Session grant spend cap does not match the saved wallet alert.");
    }
    if (grantedEvent.args.receiptId !== expectedRecord.receiptId) {
      throw new BnbTransactionVerificationError("Session grant receipt ID does not match the saved wallet alert.");
    }
    if (grantedEvent.args.permissionsHash !== permissionsHashForRecord(expectedRecord)) {
      throw new BnbTransactionVerificationError("Session grant permissions hash does not match the saved wallet alert.");
    }
  }

  return {
    transactionHash: hash,
    transactionStatus: "success",
    explorerUrl,
    blockNumber: receipt.blockNumber.toString(),
    sessionId: grantedEvent.args.sessionId,
    contractAddress: grantedEvent.address,
  };
}

export async function readBnbSessionRevoke(
  txHash: string,
  expectedSessionId?: string
): Promise<BnbSessionConfirmation> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new Error("Invalid BSC transaction hash.");
  }

  const registryAddress = getSessionRegistryAddress();
  if (!registryAddress) {
    throw new BnbTransactionVerificationError("Deploy the BSC session registry and set BNB_SESSION_REGISTRY_ADDRESS before confirming revocations.");
  }

  const hash = txHash as Hex;
  const client = getBscClient();
  const explorerUrl = getBscExplorerTxUrl(hash);

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash });
  } catch {
    return {
      transactionHash: hash,
      transactionStatus: "pending",
      explorerUrl,
    };
  }

  if (receipt.status !== "success") {
    return {
      transactionHash: hash,
      transactionStatus: "reverted",
      explorerUrl,
      blockNumber: receipt.blockNumber.toString(),
      contractAddress: receipt.to || undefined,
    };
  }

  const revokedEvents = parseEventLogs({
    abi: HIVE_BSC_SESSION_REGISTRY_ABI,
    eventName: "SessionRevoked",
    logs: receipt.logs,
  });
  const revokedEvent = revokedEvents.find((event) => sameAddress(event.address, registryAddress));

  if (!revokedEvent) {
    throw new BnbTransactionVerificationError("Transaction does not contain a Hive session revocation event from the configured BSC session registry.");
  }

  if (expectedSessionId && revokedEvent.args.sessionId !== expectedSessionId) {
    throw new BnbTransactionVerificationError("Session revocation transaction does not match the saved session.");
  }

  return {
    transactionHash: hash,
    transactionStatus: "success",
    explorerUrl,
    blockNumber: receipt.blockNumber.toString(),
    sessionId: revokedEvent.args.sessionId,
    contractAddress: revokedEvent.address,
  };
}

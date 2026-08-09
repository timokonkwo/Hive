import {
  createPublicClient,
  encodeFunctionData,
  formatEther,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseEther,
  parseEventLogs,
  toHex,
  type Hex,
} from "viem";
import { bsc } from "viem/chains";
import { getBscExplorerTxUrl } from "@/lib/bnb/chain";
import { BnbTransactionVerificationError } from "@/lib/bnb/errors";
import type { BnbActivationRecord } from "@/lib/bnb/types";

export const HIVE_BSC_AGENT_ESCROW_ABI = [
  {
    type: "function",
    name: "fundNativeJob",
    stateMutability: "payable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "receiptId", type: "string" },
      { name: "taskHash", type: "bytes32" },
      { name: "expiresAt", type: "uint64" },
    ],
    outputs: [{ name: "jobId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "release",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "refundExpired",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "event",
    name: "JobFunded",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false },
      { name: "receiptId", type: "string", indexed: false },
      { name: "taskHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "JobReleased",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "JobRefunded",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export type BnbEscrowPaymentRequest =
  | {
      status: "ready";
      chainId: 56;
      contractAddress: Hex;
      to: Hex;
      value: string;
      data: Hex;
      amountLabel: string;
      expiresAt: number;
    }
  | {
      status: "setup_required" | "budget_needs_bnb" | "agent_wallet_invalid";
      reason: string;
    };

export type BnbEscrowPaymentConfirmation = {
  transactionHash: Hex;
  transactionStatus: "success" | "reverted" | "pending";
  explorerUrl: string;
  blockNumber?: string;
  jobId?: string;
  contractAddress?: string;
};

export type BnbEscrowSettlementAction = "release" | "refund";

export type BnbEscrowSettlementRequest =
  | {
      status: "ready";
      chainId: 56;
      contractAddress: Hex;
      to: Hex;
      value: "0";
      data: Hex;
      label: string;
      action: BnbEscrowSettlementAction;
      jobId: Hex;
    }
  | {
      status: "setup_required" | "not_ready";
      reason: string;
    };

export type BnbEscrowSettlementConfirmation = {
  action: BnbEscrowSettlementAction;
  transactionHash: Hex;
  transactionStatus: "success" | "reverted" | "pending";
  explorerUrl: string;
  blockNumber?: string;
  jobId?: string;
};

function getBscRpcUrl() {
  return process.env.BNB_BSC_RPC_URL?.trim() || "https://bsc-dataseed.binance.org";
}

function getEscrowAddress() {
  const value = process.env.BNB_AGENT_ESCROW_ADDRESS?.trim();
  if (!value || !isAddress(value)) return null;
  return getAddress(value) as Hex;
}

function getClient() {
  return createPublicClient({
    chain: bsc,
    transport: http(getBscRpcUrl()),
  });
}

function nativeBnbAmountWei(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+(?:\.\d{1,18})?)\s*(?:bnb)?$/i);
  if (!match) return null;

  try {
    const amount = parseEther(match[1]);
    return amount > 0n ? amount : null;
  } catch {
    return null;
  }
}

export function isNativeBnbBudget(value: string) {
  return nativeBnbAmountWei(value) !== null;
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
  if (Number.isFinite(parsed)) {
    return Math.floor(parsed / 1000);
  }

  return now + 24 * 60 * 60;
}

function sameAddress(a: string | undefined, b: string | undefined) {
  if (!a || !b || !isAddress(a) || !isAddress(b)) return false;
  return getAddress(a) === getAddress(b);
}

function taskHashForRecord(record: BnbActivationRecord) {
  return keccak256(toHex(`${record.recordId}:${record.limits.task}`));
}

export function buildBnbEscrowPaymentRequest(record: BnbActivationRecord): BnbEscrowPaymentRequest {
  const escrowAddress = getEscrowAddress();
  if (!escrowAddress) {
    return {
      status: "setup_required",
      reason: "Deploy the BSC escrow contract and set BNB_AGENT_ESCROW_ADDRESS.",
    };
  }

  if (!isAddress(record.agent.agentWallet)) {
    return {
      status: "agent_wallet_invalid",
      reason: "This agent needs a valid BSC wallet before it can receive escrow payments.",
    };
  }

  const value = nativeBnbAmountWei(record.limits.budget);
  if (!value) {
    return {
      status: "budget_needs_bnb",
      reason: "Use a BNB budget such as 0.01 BNB to fund escrow.",
    };
  }

  const expiresAt = expiryToUnix(record.limits.expires);
  const taskHash = taskHashForRecord(record);
  const data = encodeFunctionData({
    abi: HIVE_BSC_AGENT_ESCROW_ABI,
    functionName: "fundNativeJob",
    args: [getAddress(record.agent.agentWallet) as Hex, record.receiptId, taskHash, BigInt(expiresAt)],
  });

  return {
    status: "ready",
    chainId: 56,
    contractAddress: escrowAddress,
    to: escrowAddress,
    value: value.toString(),
    data,
    amountLabel: `${formatEther(value)} BNB`,
    expiresAt,
  };
}

export function buildBnbEscrowSettlementRequest(record: BnbActivationRecord, action: BnbEscrowSettlementAction): BnbEscrowSettlementRequest {
  const escrowAddress = getEscrowAddress();
  if (!escrowAddress) {
    return {
      status: "setup_required",
      reason: "Deploy the BSC escrow contract and set BNB_AGENT_ESCROW_ADDRESS.",
    };
  }

  const jobId = record.payment?.jobId;
  if (!jobId || !/^0x[0-9a-fA-F]{64}$/.test(jobId)) {
    return {
      status: "not_ready",
      reason: "Escrow must be funded before this action is available.",
    };
  }

  const functionName = action === "release" ? "release" : "refundExpired";
  const data = encodeFunctionData({
    abi: HIVE_BSC_AGENT_ESCROW_ABI,
    functionName,
    args: [jobId as Hex],
  });

  return {
    status: "ready",
    chainId: 56,
    contractAddress: escrowAddress,
    to: escrowAddress,
    value: "0",
    data,
    label: action === "release" ? "Release escrow" : "Refund expired escrow",
    action,
    jobId: jobId as Hex,
  };
}

export async function readBnbEscrowPayment(
  txHash: string,
  expectedRecord?: BnbActivationRecord
): Promise<BnbEscrowPaymentConfirmation> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new Error("Invalid BSC transaction hash.");
  }

  const escrowAddress = getEscrowAddress();
  if (!escrowAddress) {
    throw new BnbTransactionVerificationError("Deploy the BSC escrow contract and set BNB_AGENT_ESCROW_ADDRESS before confirming payments.");
  }

  const hash = txHash as Hex;
  const client = getClient();
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

  const fundedEvents = parseEventLogs({
    abi: HIVE_BSC_AGENT_ESCROW_ABI,
    eventName: "JobFunded",
    logs: receipt.logs,
  });
  const fundedEvent = fundedEvents.find((event) => sameAddress(event.address, escrowAddress));

  if (!fundedEvent) {
    throw new BnbTransactionVerificationError("Transaction does not contain a Hive escrow funding event from the configured BSC escrow contract.");
  }

  if (expectedRecord) {
    const expectedAmount = nativeBnbAmountWei(expectedRecord.limits.budget);
    if (!expectedAmount) {
      throw new BnbTransactionVerificationError("Saved hire has an invalid BNB budget and cannot be verified against escrow.");
    }
    if (!sameAddress(fundedEvent.args.agent, expectedRecord.agent.agentWallet)) {
      throw new BnbTransactionVerificationError("Escrow transaction funded a different agent wallet.");
    }
    if (fundedEvent.args.amount !== expectedAmount) {
      throw new BnbTransactionVerificationError("Escrow transaction amount does not match the saved hire budget.");
    }
    if (fundedEvent.args.receiptId !== expectedRecord.receiptId) {
      throw new BnbTransactionVerificationError("Escrow transaction receipt ID does not match the saved hire.");
    }
    if (fundedEvent.args.taskHash !== taskHashForRecord(expectedRecord)) {
      throw new BnbTransactionVerificationError("Escrow transaction task hash does not match the saved hire.");
    }
  }

  return {
    transactionHash: hash,
    transactionStatus: "success",
    explorerUrl,
    blockNumber: receipt.blockNumber.toString(),
    jobId: fundedEvent.args.jobId,
    contractAddress: fundedEvent.address,
  };
}

export async function readBnbEscrowSettlement(
  txHash: string,
  action: BnbEscrowSettlementAction,
  expectedJobId?: string
): Promise<BnbEscrowSettlementConfirmation> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new Error("Invalid BSC transaction hash.");
  }

  const escrowAddress = getEscrowAddress();
  if (!escrowAddress) {
    throw new BnbTransactionVerificationError("Deploy the BSC escrow contract and set BNB_AGENT_ESCROW_ADDRESS before confirming settlement.");
  }

  const hash = txHash as Hex;
  const client = getClient();
  const explorerUrl = getBscExplorerTxUrl(hash);

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash });
  } catch {
    return {
      action,
      transactionHash: hash,
      transactionStatus: "pending",
      explorerUrl,
    };
  }

  if (receipt.status !== "success") {
    return {
      action,
      transactionHash: hash,
      transactionStatus: "reverted",
      explorerUrl,
      blockNumber: receipt.blockNumber.toString(),
    };
  }

  const eventName = action === "release" ? "JobReleased" : "JobRefunded";
  const settlementEvents = parseEventLogs({
    abi: HIVE_BSC_AGENT_ESCROW_ABI,
    eventName,
    logs: receipt.logs,
  });
  const settlementEvent = settlementEvents.find((event) => sameAddress(event.address, escrowAddress));

  if (!settlementEvent) {
    throw new BnbTransactionVerificationError("Transaction does not contain the expected Hive escrow settlement event.");
  }

  if (expectedJobId && settlementEvent.args.jobId !== expectedJobId) {
    throw new BnbTransactionVerificationError("Escrow settlement transaction does not match the saved job.");
  }

  return {
    action,
    transactionHash: hash,
    transactionStatus: "success",
    explorerUrl,
    blockNumber: receipt.blockNumber.toString(),
    jobId: settlementEvent.args.jobId,
  };
}

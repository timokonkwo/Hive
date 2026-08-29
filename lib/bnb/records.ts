import { randomUUID } from "crypto";
import type { Filter } from "mongodb";
import { COLLECTIONS, getDb } from "@/lib/db";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { getBscChainId } from "@/lib/bnb/chain";
import { readBnbEscrowPayment } from "@/lib/bnb/escrow";
import { readBnbSessionGrant, readBnbSessionRevoke } from "@/lib/bnb/session";
import { encryptBnbX402PaymentHeader, sanitizeBnbX402PaymentSnapshot, validateBnbX402PaymentHeader } from "@/lib/bnb/x402";
import type {
  BnbAccessRequestRecord,
  BnbActivationRecord,
  BnbAgentProfile,
  BnbAltanaSessionRecord,
  BnbAltanaSessionTemplate,
  BnbJobSpec,
  BnbRecordStorage,
  BnbRecordsSnapshot,
  BnbTermixCapture,
  BnbTermixComparisonRecord,
} from "@/lib/bnb/types";

type BnbStoredRecord =
  | BnbActivationRecord
  | BnbAccessRequestRecord
  | BnbTermixComparisonRecord
  | BnbAltanaSessionRecord;

type BnbX402AuthorizationReservation = {
  _id: string;
  recordId: string;
  createdAt: string;
};

type ProcessRecordStore = {
  activations: BnbActivationRecord[];
  x402Authorizations: Map<string, string>;
  accessRequests: BnbAccessRequestRecord[];
  termixComparisons: BnbTermixComparisonRecord[];
  altanaSessions: BnbAltanaSessionRecord[];
};

const globalForBnbRecords = globalThis as typeof globalThis & {
  __hiveBnbRecords?: ProcessRecordStore;
};

export class BnbStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BnbStorageError";
  }
}

function getProcessStore() {
  if (!globalForBnbRecords.__hiveBnbRecords) {
    globalForBnbRecords.__hiveBnbRecords = {
      activations: [],
      x402Authorizations: new Map(),
      accessRequests: [],
      termixComparisons: [],
      altanaSessions: [],
    };
  }
  return globalForBnbRecords.__hiveBnbRecords;
}

function hasDatabaseConfig() {
  return Boolean(process.env.MONGODB_URI?.trim());
}

function canUseProcessStorage() {
  return process.env.BNB_ALLOW_PROCESS_STORAGE === "true" || (process.env.NODE_ENV !== "production" && !hasDatabaseConfig());
}

function withStorage<T extends BnbStoredRecord>(record: T, storage: BnbRecordStorage): T {
  return {
    ...record,
    storage,
  };
}

function stripMongoId<T extends BnbStoredRecord>(record: T & { _id?: unknown }): T {
  const cleanRecord = { ...record };
  delete cleanRecord._id;
  return cleanRecord as T;
}

async function saveBnbRecord<T extends BnbStoredRecord>(
  collection: string,
  record: T,
  storeRecord: (record: T) => void
) {
  const savedAt = new Date().toISOString();

  if (hasDatabaseConfig()) {
    try {
      const db = await getDb();
      const stored = withStorage(record, { status: "database", collection, savedAt });
      await db.collection(collection).insertOne(stored);
      return stripMongoId(stored as T & { _id?: unknown });
    } catch (error) {
      if (!canUseProcessStorage()) {
        const message = error instanceof Error ? error.message : "Database write failed.";
        throw new BnbStorageError(`BNB record was not saved: ${message}`);
      }
    }
  }

  if (!canUseProcessStorage()) {
    throw new BnbStorageError("BNB record storage is not configured. Set MONGODB_URI or BNB_ALLOW_PROCESS_STORAGE=true for local development.");
  }

  const stored = withStorage(record, { status: "process", collection, savedAt });
  storeRecord(stored);
  return stored;
}

async function listBnbCollection<T extends BnbStoredRecord>(collection: string, limit: number, ownerIds?: string | string[]) {
  if (!hasDatabaseConfig()) return null;

  try {
    const db = await getDb();
    const owners = normalizeOwnerIds(ownerIds);
    const query = (owners.length > 0 ? { clientAddress: { $in: owners } } : {}) as Filter<T & { _id?: unknown }>;
    const records = await db
      .collection<T & { _id?: unknown }>(collection)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return records.map(stripMongoId);
  } catch {
    if (!canUseProcessStorage()) {
      throw new BnbStorageError("BNB records could not be loaded from the database.");
    }
    return null;
  }
}

export async function createBnbActivationRecord({
  agent,
  taskTemplate,
  jobSpec,
  spendCap,
  expiry,
  clientAddress,
  walletConfirmationRequired = true,
  payment,
  executionTarget,
}: {
  agent: BnbAgentProfile;
  taskTemplate: string;
  jobSpec?: BnbJobSpec;
  spendCap: string;
  expiry: string;
  clientAddress?: string;
  walletConfirmationRequired?: boolean;
  payment?: BnbActivationRecord["payment"];
  executionTarget?: BnbActivationRecord["executionTarget"];
}) {
  const now = new Date().toISOString();
  const record: BnbActivationRecord = {
    recordType: "hire",
    recordId: randomUUID(),
    receiptId: `hive-bsc-${agent.tokenId}-${Date.now()}`,
    status: walletConfirmationRequired ? "awaiting_funding" : "saved",
    createdAt: now,
    updatedAt: now,
    ...(clientAddress ? { clientAddress } : {}),
    agent: {
      chainId: agent.chainId,
      tokenId: agent.tokenId,
      name: agent.name,
      activationStatus: agent.activationStatus,
      executionStatus: agent.executionStatus,
      agentWallet: agent.agentWallet,
    },
    ...(jobSpec ? { jobSpec } : {}),
    ...(executionTarget ? { executionTarget } : {}),
    delivery: {
      status: "pending",
    },
    limits: {
      task: taskTemplate,
      budget: spendCap,
      expires: expiry,
      walletConfirmationRequired,
    },
    ...(payment ? { payment } : {}),
  };

  return saveBnbRecord(COLLECTIONS.BNB_ACTIVATIONS, record, (stored) => {
    getProcessStore().activations.unshift(stored);
  });
}

export async function createBnbAccessRequestRecord({
  agent,
  task,
  budget,
  deadline,
  contactPreference,
  clientAddress,
}: {
  agent: BnbAgentProfile;
  task: string;
  budget?: string;
  deadline?: string;
  contactPreference?: string;
  clientAddress?: string;
}) {
  const now = new Date().toISOString();
  const record: BnbAccessRequestRecord = {
    recordType: "access_request",
    recordId: randomUUID(),
    receiptId: `hive-access-${agent.tokenId}-${Date.now()}`,
    status: "requested",
    createdAt: now,
    updatedAt: now,
    ...(clientAddress ? { clientAddress } : {}),
    agent: {
      chainId: agent.chainId,
      tokenId: agent.tokenId,
      name: agent.name,
      activationStatus: agent.activationStatus,
      executionStatus: agent.executionStatus,
      agentWallet: agent.agentWallet,
    },
    task,
    ...(budget ? { budget } : {}),
    ...(deadline ? { deadline } : {}),
    ...(contactPreference ? { contactPreference } : {}),
  };

  return saveBnbRecord(COLLECTIONS.BNB_ACCESS_REQUESTS, record, (stored) => {
    getProcessStore().accessRequests.unshift(stored);
  });
}

export async function createBnbTermixComparisonRecord({
  capture,
  target,
  manualTime,
  agentTime,
  agentTokenId,
  verdict,
  clientAddress,
  artifactUrl,
  transactionHash,
  manualOutput,
  agentOutput,
  qualityScore,
  dataSources,
  notes,
}: {
  capture: BnbTermixCapture;
  target: string;
  manualTime: string;
  agentTime?: string;
  agentTokenId: string;
  verdict: BnbTermixComparisonRecord["verdict"];
  artifactUrl?: string;
  transactionHash?: string;
  manualOutput?: string;
  agentOutput?: string;
  qualityScore?: string;
  dataSources?: string[];
  notes?: string;
  clientAddress?: string;
}) {
  const now = new Date().toISOString();
  const record: BnbTermixComparisonRecord = {
    recordType: "comparison",
    recordId: randomUUID(),
    receiptId: `hive-comparison-${capture.id}-${Date.now()}`,
    status: "saved",
    createdAt: now,
    updatedAt: now,
    ...(clientAddress ? { clientAddress } : {}),
    caseId: capture.id,
    title: capture.title,
    target,
    manualTime: manualTime || "unset",
    agentTime: agentTime || "unset",
    agentTokenId: agentTokenId || "unset",
    verdict,
    ...(artifactUrl ? { artifactUrl } : {}),
    ...(transactionHash ? { transactionHash } : {}),
    ...(manualOutput ? { manualOutput } : {}),
    ...(agentOutput ? { agentOutput } : {}),
    ...(dataSources && dataSources.length > 0 ? { dataSources } : {}),
    ...(qualityScore ? { qualityScore } : {}),
    ...(notes ? { notes } : {}),
  };

  return saveBnbRecord(COLLECTIONS.BNB_TERMIX_COMPARISONS, record, (stored) => {
    getProcessStore().termixComparisons.unshift(stored);
  });
}

export async function createBnbAgentComparisonRecord({
  agents,
  clientAddress,
}: {
  agents: BnbAgentProfile[];
  clientAddress?: string;
}) {
  const now = new Date().toISOString();
  const names = agents.map((agent) => agent.name);
  const record: BnbTermixComparisonRecord = {
    recordType: "comparison",
    recordId: randomUUID(),
    receiptId: `hive-agent-comparison-${Date.now()}`,
    status: "saved",
    createdAt: now,
    updatedAt: now,
    ...(clientAddress ? { clientAddress } : {}),
    caseId: "agent-comparison",
    title: "Agent comparison",
    target: names.join(" and "),
    manualTime: "unset",
    agentTime: "unset",
    agentTokenId: agents.map((agent) => agent.tokenId).join(","),
    verdict: "pending",
    comparisonType: "agents",
    comparedAgents: agents.map((agent) => ({
      chainId: agent.chainId,
      tokenId: agent.tokenId,
      name: agent.name,
      activationStatus: agent.activationStatus,
      executionStatus: agent.executionStatus,
    })),
  };

  return saveBnbRecord(COLLECTIONS.BNB_TERMIX_COMPARISONS, record, (stored) => {
    getProcessStore().termixComparisons.unshift(stored);
  });
}

export async function createBnbAltanaSessionRecord({
  template,
  walletLabel,
  walletAddress,
  trigger,
  budget,
  clientAddress,
  transactionHash,
}: {
  template: BnbAltanaSessionTemplate;
  walletLabel: string;
  walletAddress?: string;
  trigger: string;
  budget?: string;
  clientAddress?: string;
  transactionHash?: string;
}) {
  const now = new Date().toISOString();
  const record: BnbAltanaSessionRecord = {
    recordType: "wallet_watch",
    recordId: randomUUID(),
    receiptId: `hive-wallet-alert-${template.id}-${Date.now()}`,
    status: "saved",
    createdAt: now,
    updatedAt: now,
    ...(clientAddress ? { clientAddress } : {}),
    templateId: template.id,
    title: template.title,
    agentTokenId: template.agentTokenId,
    walletLabel: walletLabel || "unset",
    ...(walletAddress ? { walletAddress } : {}),
    trigger: trigger || template.summary,
    budget: budget || template.spendCap,
    expires: template.expiry,
    ...(transactionHash ? { transactionHash } : {}),
  };

  return saveBnbRecord(COLLECTIONS.BNB_ALTANA_SESSIONS, record, (stored) => {
    getProcessStore().altanaSessions.unshift(stored);
  });
}

export async function revokeBnbAltanaSessionRecord({
  recordId,
  clientAddress,
  revocationNote,
}: {
  recordId: string;
  clientAddress?: string;
  revocationNote?: string;
}) {
  const now = new Date().toISOString();
  const patch = {
    updatedAt: now,
    status: "stopped" as const,
    stoppedAt: now,
    ...(revocationNote ? { stopNote: revocationNote } : {}),
  };

  if (hasDatabaseConfig()) {
    try {
      const db = await getDb();
      const updated = await db
        .collection<BnbAltanaSessionRecord & { _id?: unknown }>(COLLECTIONS.BNB_ALTANA_SESSIONS)
        .findOneAndUpdate(
          { $or: [{ recordId }, { receiptId: recordId }], ...(clientAddress ? { clientAddress } : {}) },
          { $set: patch },
          { returnDocument: "after" }
        );

      if (updated) return stripMongoId(updated);
    } catch (error) {
      if (!canUseProcessStorage()) {
        const message = error instanceof Error ? error.message : "Database update failed.";
        throw new BnbStorageError(`Wallet alert was not stopped: ${message}`);
      }
    }
  }

  if (!canUseProcessStorage()) {
    throw new BnbStorageError("Wallet alert storage is not configured.");
  }

  const processStore = getProcessStore();
  const recordIndex = processStore.altanaSessions.findIndex((record) => {
    if (record.recordId !== recordId && record.receiptId !== recordId) return false;
    return clientAddress ? record.clientAddress === clientAddress : true;
  });
  if (recordIndex === -1) return null;

  const updated = {
    ...processStore.altanaSessions[recordIndex],
    ...patch,
  };
  processStore.altanaSessions[recordIndex] = updated;
  return updated;
}

export async function getBnbAltanaSessionRecord({
  recordId,
  clientAddress,
}: {
  recordId: string;
  clientAddress?: string;
}) {
  if (hasDatabaseConfig()) {
    try {
      const db = await getDb();
      const record = await db
        .collection<BnbAltanaSessionRecord & { _id?: unknown }>(COLLECTIONS.BNB_ALTANA_SESSIONS)
        .findOne({ $or: [{ recordId }, { receiptId: recordId }], ...(clientAddress ? { clientAddress } : {}) });

      return record ? stripMongoId(record) : null;
    } catch (error) {
      if (!canUseProcessStorage()) {
        const message = error instanceof Error ? error.message : "Database read failed.";
        throw new BnbStorageError(`Wallet alert could not be loaded: ${message}`);
      }
    }
  }

  if (!canUseProcessStorage()) {
    throw new BnbStorageError("Wallet alert storage is not configured.");
  }

  const record = getProcessStore().altanaSessions.find((item) => {
    if (item.recordId !== recordId && item.receiptId !== recordId) return false;
    return clientAddress ? item.clientAddress === clientAddress : true;
  });

  return record || null;
}

export async function updateBnbAltanaSessionRecord({
  recordId,
  clientAddress,
  patch,
}: {
  recordId: string;
  clientAddress?: string;
  patch: Partial<BnbAltanaSessionRecord>;
}) {
  const update = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (hasDatabaseConfig()) {
    try {
      const db = await getDb();
      const updated = await db
        .collection<BnbAltanaSessionRecord & { _id?: unknown }>(COLLECTIONS.BNB_ALTANA_SESSIONS)
        .findOneAndUpdate(
          { $or: [{ recordId }, { receiptId: recordId }], ...(clientAddress ? { clientAddress } : {}) },
          { $set: update },
          { returnDocument: "after" }
        );

      if (updated) return stripMongoId(updated);
    } catch (error) {
      if (!canUseProcessStorage()) {
        const message = error instanceof Error ? error.message : "Database update failed.";
        throw new BnbStorageError(`Wallet alert was not updated: ${message}`);
      }
    }
  }

  if (!canUseProcessStorage()) {
    throw new BnbStorageError("Wallet alert storage is not configured.");
  }

  const processStore = getProcessStore();
  const recordIndex = processStore.altanaSessions.findIndex((record) => {
    if (record.recordId !== recordId && record.receiptId !== recordId) return false;
    return clientAddress ? record.clientAddress === clientAddress : true;
  });
  if (recordIndex === -1) return null;

  const updated = {
    ...processStore.altanaSessions[recordIndex],
    ...update,
  };
  processStore.altanaSessions[recordIndex] = updated;
  return updated;
}

export async function confirmBnbAltanaSessionGrant({
  recordId,
  clientAddress,
  transactionHash,
}: {
  recordId: string;
  clientAddress?: string;
  transactionHash: string;
}) {
  const existing = await getBnbAltanaSessionRecord({ recordId, clientAddress });
  if (!existing) return null;

  const agent = await getBnbAgent(56, existing.agentTokenId);
  if (!agent) {
    throw new BnbStorageError("Wallet alert agent is not available for session verification.");
  }

  const confirmation = await readBnbSessionGrant(transactionHash, existing, agent);
  const patch: Partial<BnbAltanaSessionRecord> = {
    status: confirmation.transactionStatus === "success" ? "active" : "grant_submitted",
    session: {
      chainId: getBscChainId(),
      contractAddress: confirmation.contractAddress,
      sessionId: confirmation.sessionId,
      grantTransactionHash: confirmation.transactionHash,
      grantStatus: confirmation.transactionStatus,
      grantExplorerUrl: confirmation.explorerUrl,
      grantBlockNumber: confirmation.blockNumber,
    },
  };

  return updateBnbAltanaSessionRecord({ recordId, clientAddress, patch });
}

export async function confirmBnbAltanaSessionRevoke({
  recordId,
  clientAddress,
  transactionHash,
  revocationNote,
}: {
  recordId: string;
  clientAddress?: string;
  transactionHash: string;
  revocationNote?: string;
}) {
  const existing = await getBnbAltanaSessionRecord({ recordId, clientAddress });
  if (!existing) return null;

  const confirmation = await readBnbSessionRevoke(transactionHash, existing.session?.sessionId);
  const patch: Partial<BnbAltanaSessionRecord> = {
    status: confirmation.transactionStatus === "success" ? "stopped" : "revoke_submitted",
    stoppedAt: confirmation.transactionStatus === "success" ? new Date().toISOString() : existing.stoppedAt,
    ...(revocationNote ? { stopNote: revocationNote } : {}),
    session: {
      ...existing.session,
      chainId: getBscChainId(),
      contractAddress: confirmation.contractAddress || existing.session?.contractAddress,
      sessionId: confirmation.sessionId || existing.session?.sessionId,
      revokeTransactionHash: confirmation.transactionHash,
      revokeStatus: confirmation.transactionStatus,
      revokeExplorerUrl: confirmation.explorerUrl,
      revokeBlockNumber: confirmation.blockNumber,
    },
  };

  return updateBnbAltanaSessionRecord({ recordId, clientAddress, patch });
}

export async function confirmBnbActivationPayment({
  recordId,
  clientAddress,
  transactionHash,
}: {
  recordId: string;
  clientAddress?: string;
  transactionHash: string;
}) {
  const now = new Date().toISOString();
  const existing = await getBnbActivationRecord({ recordId, clientAddress });
  if (!existing) return null;

  const payment = await readBnbEscrowPayment(transactionHash, existing);
  const patch: Partial<BnbActivationRecord> = {
    updatedAt: now,
    status: payment.transactionStatus === "success" ? "funded" : payment.transactionStatus === "reverted" ? "payment_reverted" : "payment_submitted",
    payment: {
      mode: "escrow",
      chainId: getBscChainId(),
      contractAddress: payment.contractAddress,
      transactionHash: payment.transactionHash,
      transactionStatus: payment.transactionStatus,
      explorerUrl: payment.explorerUrl,
      blockNumber: payment.blockNumber,
      jobId: payment.jobId,
      expiresAt: payment.expiresAt,
    },
  };

  if (hasDatabaseConfig()) {
    try {
      const db = await getDb();
      const updated = await db
        .collection<BnbActivationRecord & { _id?: unknown }>(COLLECTIONS.BNB_ACTIVATIONS)
        .findOneAndUpdate({ recordId, ...(clientAddress ? { clientAddress } : {}) }, { $set: patch }, { returnDocument: "after" });

      if (updated) return stripMongoId(updated);
    } catch (error) {
      if (error instanceof BnbStorageError) throw error;
      if (!canUseProcessStorage()) {
        const message = error instanceof Error ? error.message : "Database update failed.";
        throw new BnbStorageError(`Payment receipt was not updated: ${message}`);
      }
    }
  }

  if (!canUseProcessStorage()) {
    throw new BnbStorageError("Payment receipt storage is not configured.");
  }

  const processStore = getProcessStore();
  const recordIndex = processStore.activations.findIndex((record) => {
    if (record.recordId !== recordId) return false;
    return clientAddress ? record.clientAddress === clientAddress : true;
  });
  if (recordIndex === -1) return null;

  const updated = {
    ...processStore.activations[recordIndex],
    ...patch,
  };
  processStore.activations[recordIndex] = updated;
  return updated;
}

export async function confirmBnbActivationX402Payment({
  recordId,
  clientAddress,
  paymentHeader,
}: {
  recordId: string;
  clientAddress?: string;
  paymentHeader: string;
}) {
  const now = new Date().toISOString();
  const existing = await getBnbActivationRecord({ recordId, clientAddress });
  if (!existing) return null;

  const x402 = existing.payment?.x402;
  const paymentRequirement = x402?.selectedRequirement;
  if (existing.payment?.mode !== "x402" || !x402 || !paymentRequirement) {
    throw new BnbStorageError("This payment is not available for this job.");
  }
  const closedStatuses: BnbActivationRecord["status"][] = ["running", "delivered", "work_completed", "paid", "released", "refunded"];
  if (x402.status === "settled" || x402.status === "unconfirmed" || closedStatuses.includes(existing.status)) {
    throw new BnbStorageError("This payment is already closed.");
  }

  const verified = await validateBnbX402PaymentHeader({
    paymentHeader,
    paymentRequirement,
    x402Version: x402.x402Version,
  });
  if (x402.status === "verified") {
    if (x402.paymentHeaderHash === verified.paymentHeaderHash) return existing;
    throw new BnbStorageError("This payment is already closed.");
  }
  const encryptedPaymentHeader = encryptBnbX402PaymentHeader(paymentHeader);
  const patch: Partial<BnbActivationRecord> = {
    updatedAt: now,
    status: "payment_confirmed",
    payment: {
      ...existing.payment,
      mode: "x402",
      chainId: existing.payment.chainId || getBscChainId(),
      transactionStatus: "success",
      x402: {
        ...x402,
        status: "verified",
        paymentHeader: encryptedPaymentHeader,
        paymentHeaderHash: verified.paymentHeaderHash,
        payer: verified.payer || x402.payer,
        verifiedAt: now,
        error: undefined,
      },
    },
  };

  if (hasDatabaseConfig()) {
    let authorizationReserved = false;
    try {
      const db = await getDb();
      await db.collection<BnbX402AuthorizationReservation>(COLLECTIONS.BNB_X402_AUTHORIZATIONS).insertOne({
        _id: verified.paymentHeaderHash,
        recordId,
        createdAt: now,
      });
      authorizationReserved = true;
      const updated = await db
        .collection<BnbActivationRecord & { _id?: unknown }>(COLLECTIONS.BNB_ACTIVATIONS)
        .findOneAndUpdate({
          recordId,
          ...(clientAddress ? { clientAddress } : {}),
          updatedAt: existing.updatedAt,
          status: { $nin: closedStatuses },
          "payment.mode": "x402",
          "payment.x402.status": { $nin: ["settled", "unconfirmed"] },
        }, { $set: patch }, { returnDocument: "after" });

      if (updated) return stripMongoId(updated);
      await db.collection<BnbX402AuthorizationReservation>(COLLECTIONS.BNB_X402_AUTHORIZATIONS).deleteOne({
        _id: verified.paymentHeaderHash,
        recordId,
      });
      authorizationReserved = false;
      throw new BnbStorageError("Payment details changed. Reload this job and try again.");
    } catch (error) {
      if (error instanceof BnbStorageError) throw error;
      if (isMongoDuplicateKeyError(error)) {
        throw new BnbStorageError("This payment confirmation has already been used.");
      }
      if (authorizationReserved) {
        try {
          const db = await getDb();
          await db.collection<BnbX402AuthorizationReservation>(COLLECTIONS.BNB_X402_AUTHORIZATIONS).deleteOne({
            _id: verified.paymentHeaderHash,
            recordId,
          });
        } catch {
          // Preserve the original storage error.
        }
      }
      const message = error instanceof Error ? error.message : "Database update failed.";
      throw new BnbStorageError(`Payment receipt was not updated: ${message}`);
    }
  }

  if (!canUseProcessStorage()) {
    throw new BnbStorageError("Payment receipt storage is not configured.");
  }

  const processStore = getProcessStore();
  const recordIndex = processStore.activations.findIndex((record) => {
    if (record.recordId !== recordId) return false;
    return clientAddress ? record.clientAddress === clientAddress : true;
  });
  if (recordIndex === -1) return null;
  const current = processStore.activations[recordIndex];
  if (
    current.updatedAt !== existing.updatedAt
    || current.payment?.mode !== "x402"
    || current.payment.x402?.status === "settled"
    || current.payment.x402?.status === "unconfirmed"
    || closedStatuses.includes(current.status)
  ) {
    throw new BnbStorageError("Payment details changed. Reload this job and try again.");
  }
  const reservedRecordId = processStore.x402Authorizations.get(verified.paymentHeaderHash);
  if (reservedRecordId && reservedRecordId !== recordId) {
    throw new BnbStorageError("This payment confirmation has already been used.");
  }
  processStore.x402Authorizations.set(verified.paymentHeaderHash, recordId);

  const updated = {
    ...current,
    ...patch,
  };
  processStore.activations[recordIndex] = updated;
  return updated;
}

function isMongoDuplicateKeyError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === 11000);
}

export async function getBnbActivationRecord({
  recordId,
  clientAddress,
}: {
  recordId: string;
  clientAddress?: string;
}) {
  if (hasDatabaseConfig()) {
    try {
      const db = await getDb();
      const record = await db
        .collection<BnbActivationRecord & { _id?: unknown }>(COLLECTIONS.BNB_ACTIVATIONS)
        .findOne({ recordId, ...(clientAddress ? { clientAddress } : {}) });

      return record ? stripMongoId(record) : null;
    } catch (error) {
      if (!canUseProcessStorage()) {
        const message = error instanceof Error ? error.message : "Database read failed.";
        throw new BnbStorageError(`Hire receipt could not be loaded: ${message}`);
      }
    }
  }

  if (!canUseProcessStorage()) {
    throw new BnbStorageError("Hire receipt storage is not configured.");
  }

  const record = getProcessStore().activations.find((item) => {
    if (item.recordId !== recordId) return false;
    return clientAddress ? item.clientAddress === clientAddress : true;
  });

  return record || null;
}

export async function updateBnbActivationRecord({
  recordId,
  clientAddress,
  patch,
}: {
  recordId: string;
  clientAddress?: string;
  patch: Partial<BnbActivationRecord>;
}) {
  const update = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (hasDatabaseConfig()) {
    try {
      const db = await getDb();
      const updated = await db
        .collection<BnbActivationRecord & { _id?: unknown }>(COLLECTIONS.BNB_ACTIVATIONS)
        .findOneAndUpdate({ recordId, ...(clientAddress ? { clientAddress } : {}) }, { $set: update }, { returnDocument: "after" });

      if (updated) return stripMongoId(updated);
    } catch (error) {
      if (!canUseProcessStorage()) {
        const message = error instanceof Error ? error.message : "Database update failed.";
        throw new BnbStorageError(`Hire receipt was not updated: ${message}`);
      }
    }
  }

  if (!canUseProcessStorage()) {
    throw new BnbStorageError("Hire receipt storage is not configured.");
  }

  const processStore = getProcessStore();
  const recordIndex = processStore.activations.findIndex((record) => {
    if (record.recordId !== recordId) return false;
    return clientAddress ? record.clientAddress === clientAddress : true;
  });
  if (recordIndex === -1) return null;

  const updated = {
    ...processStore.activations[recordIndex],
    ...update,
  };
  processStore.activations[recordIndex] = updated;
  return updated;
}

export async function commitBnbActivationRunResult({
  recordId,
  clientAddress,
  attemptId,
  patch,
}: {
  recordId: string;
  clientAddress?: string;
  attemptId: string;
  patch: Partial<BnbActivationRecord>;
}): Promise<{ applied: boolean; record: BnbActivationRecord | null }> {
  if (!attemptId) {
    return { applied: false, record: await getBnbActivationRecord({ recordId, clientAddress }) };
  }

  const update = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (hasDatabaseConfig()) {
    try {
      const db = await getDb();
      const updated = await db
        .collection<BnbActivationRecord & { _id?: unknown }>(COLLECTIONS.BNB_ACTIVATIONS)
        .findOneAndUpdate(
          {
            recordId,
            ...(clientAddress ? { clientAddress } : {}),
            status: "running",
            "execution.state": "running",
            "execution.attemptId": attemptId,
          },
          { $set: update },
          { returnDocument: "after" }
        );

      if (updated) return { applied: true, record: stripMongoId(updated) };
      return { applied: false, record: await getBnbActivationRecord({ recordId, clientAddress }) };
    } catch (error) {
      if (!canUseProcessStorage()) {
        const message = error instanceof Error ? error.message : "Database update failed.";
        throw new BnbStorageError(`Hire receipt was not updated: ${message}`);
      }
    }
  }

  if (!canUseProcessStorage()) {
    throw new BnbStorageError("Hire receipt storage is not configured.");
  }

  const processStore = getProcessStore();
  const recordIndex = processStore.activations.findIndex((record) => {
    if (record.recordId !== recordId) return false;
    return clientAddress ? record.clientAddress === clientAddress : true;
  });
  if (recordIndex === -1) return { applied: false, record: null };

  const current = processStore.activations[recordIndex];
  if (
    current.status !== "running"
    || current.execution?.state !== "running"
    || current.execution.attemptId !== attemptId
  ) {
    return { applied: false, record: current };
  }

  const updated = {
    ...current,
    ...update,
  };
  processStore.activations[recordIndex] = updated;
  return { applied: true, record: updated };
}

export async function claimBnbActivationRun({
  recordId,
  clientAddress,
  patch,
  staleBefore,
}: {
  recordId: string;
  clientAddress?: string;
  patch: Partial<BnbActivationRecord>;
  staleBefore: string;
}): Promise<{ claimed: boolean; record: BnbActivationRecord | null }> {
  const update = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (hasDatabaseConfig()) {
    try {
      const db = await getDb();
      const updated = await db
        .collection<BnbActivationRecord & { _id?: unknown }>(COLLECTIONS.BNB_ACTIVATIONS)
        .findOneAndUpdate(
          {
            recordId,
            ...(clientAddress ? { clientAddress } : {}),
            status: { $nin: ["delivered", "work_completed", "paid", "released", "refunded"] },
            $or: [
              { "work.status": { $exists: false } },
              { "work.status": { $nin: ["running", "completed"] } },
              { "work.status": "running", "work.startedAt": { $lte: staleBefore } },
            ],
          },
          { $set: update },
          { returnDocument: "after" }
        );

      if (updated) return { claimed: true, record: stripMongoId(updated) };
      return { claimed: false, record: await getBnbActivationRecord({ recordId, clientAddress }) };
    } catch (error) {
      if (!canUseProcessStorage()) {
        const message = error instanceof Error ? error.message : "Database update failed.";
        throw new BnbStorageError(`Hire receipt was not updated: ${message}`);
      }
    }
  }

  if (!canUseProcessStorage()) {
    throw new BnbStorageError("Hire receipt storage is not configured.");
  }

  const processStore = getProcessStore();
  const recordIndex = processStore.activations.findIndex((record) => {
    if (record.recordId !== recordId) return false;
    return clientAddress ? record.clientAddress === clientAddress : true;
  });
  if (recordIndex === -1) return { claimed: false, record: null };

  const current = processStore.activations[recordIndex];
  if (!canClaimBnbRun(current, staleBefore)) {
    return { claimed: false, record: current };
  }

  const updated = {
    ...current,
    ...update,
  };
  processStore.activations[recordIndex] = updated;
  return { claimed: true, record: updated };
}

function canClaimBnbRun(record: BnbActivationRecord, staleBefore: string) {
  if (["delivered", "work_completed", "paid", "released", "refunded"].includes(record.status)) return false;
  if (record.work?.status === "completed") return false;
  if (record.status !== "running" && record.work?.status !== "running") return true;

  const startedAt = record.work?.startedAt ? Date.parse(record.work.startedAt) : NaN;
  const staleAt = Date.parse(staleBefore);
  if (!Number.isFinite(startedAt) || !Number.isFinite(staleAt)) return false;
  return startedAt <= staleAt;
}

export async function getBnbAccessRequestRecord({
  recordId,
  clientAddress,
}: {
  recordId: string;
  clientAddress?: string;
}) {
  if (hasDatabaseConfig()) {
    try {
      const db = await getDb();
      const record = await db
        .collection<BnbAccessRequestRecord & { _id?: unknown }>(COLLECTIONS.BNB_ACCESS_REQUESTS)
        .findOne({ $or: [{ recordId }, { receiptId: recordId }], ...(clientAddress ? { clientAddress } : {}) });

      return record ? stripMongoId(record) : null;
    } catch (error) {
      if (!canUseProcessStorage()) {
        const message = error instanceof Error ? error.message : "Database read failed.";
        throw new BnbStorageError(`Access request could not be loaded: ${message}`);
      }
    }
  }

  if (!canUseProcessStorage()) {
    throw new BnbStorageError("Access request storage is not configured.");
  }

  const record = getProcessStore().accessRequests.find((item) => {
    if (item.recordId !== recordId && item.receiptId !== recordId) return false;
    return clientAddress ? item.clientAddress === clientAddress : true;
  });

  return record || null;
}

export async function updateBnbAccessRequestRecord({
  recordId,
  clientAddress,
  patch,
}: {
  recordId: string;
  clientAddress?: string;
  patch: Partial<BnbAccessRequestRecord>;
}) {
  const update = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (hasDatabaseConfig()) {
    try {
      const db = await getDb();
      const updated = await db
        .collection<BnbAccessRequestRecord & { _id?: unknown }>(COLLECTIONS.BNB_ACCESS_REQUESTS)
        .findOneAndUpdate(
          { $or: [{ recordId }, { receiptId: recordId }], ...(clientAddress ? { clientAddress } : {}) },
          { $set: update },
          { returnDocument: "after" }
        );

      if (updated) return stripMongoId(updated);
    } catch (error) {
      if (!canUseProcessStorage()) {
        const message = error instanceof Error ? error.message : "Database update failed.";
        throw new BnbStorageError(`Access request was not updated: ${message}`);
      }
    }
  }

  if (!canUseProcessStorage()) {
    throw new BnbStorageError("Access request storage is not configured.");
  }

  const processStore = getProcessStore();
  const recordIndex = processStore.accessRequests.findIndex((record) => {
    if (record.recordId !== recordId && record.receiptId !== recordId) return false;
    return clientAddress ? record.clientAddress === clientAddress : true;
  });
  if (recordIndex === -1) return null;

  const updated = {
    ...processStore.accessRequests[recordIndex],
    ...update,
  };
  processStore.accessRequests[recordIndex] = updated;
  return updated;
}

export async function cancelBnbAccessRequestRecord({
  recordId,
  clientAddress,
  cancelReason,
}: {
  recordId: string;
  clientAddress?: string;
  cancelReason?: string;
}) {
  const now = new Date().toISOString();
  return updateBnbAccessRequestRecord({
    recordId,
    clientAddress,
    patch: {
      status: "cancelled",
      cancelledAt: now,
      ...(cancelReason ? { cancelReason } : {}),
    },
  });
}

export async function listBnbRecords(limit = 25, ownerIds?: string | string[]): Promise<BnbRecordsSnapshot> {
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const owners = normalizeOwnerIds(ownerIds);
  const ownsRecord = (record: BnbStoredRecord) => owners.length === 0 || owners.some((owner) => owner.toLowerCase() === record.clientAddress?.toLowerCase());

  const [activations, accessRequests, termixComparisons, altanaSessions] = await Promise.all([
    listBnbCollection<BnbActivationRecord>(COLLECTIONS.BNB_ACTIVATIONS, boundedLimit, owners),
    listBnbCollection<BnbAccessRequestRecord>(COLLECTIONS.BNB_ACCESS_REQUESTS, boundedLimit, owners),
    listBnbCollection<BnbTermixComparisonRecord>(COLLECTIONS.BNB_TERMIX_COMPARISONS, boundedLimit, owners),
    listBnbCollection<BnbAltanaSessionRecord>(COLLECTIONS.BNB_ALTANA_SESSIONS, boundedLimit, owners),
  ]);

  if (activations && accessRequests && termixComparisons && altanaSessions) {
    return {
      activations: activations.map(publicBnbActivationRecord),
      accessRequests,
      termixComparisons,
      altanaSessions,
      storage: "database",
      lastUpdated: new Date().toISOString(),
    };
  }

  const processStore = getProcessStore();
  return {
    activations: processStore.activations.filter(ownsRecord).slice(0, boundedLimit).map(publicBnbActivationRecord),
    accessRequests: processStore.accessRequests.filter(ownsRecord).slice(0, boundedLimit),
    termixComparisons: processStore.termixComparisons.filter(ownsRecord).slice(0, boundedLimit),
    altanaSessions: processStore.altanaSessions.filter(ownsRecord).slice(0, boundedLimit),
    storage: "process",
    lastUpdated: new Date().toISOString(),
  };
}

function normalizeOwnerIds(ownerIds?: string | string[]) {
  const values = Array.isArray(ownerIds) ? ownerIds : ownerIds ? [ownerIds] : [];
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function publicBnbActivationRecord(record: BnbActivationRecord): BnbActivationRecord {
  if (!record.payment?.x402?.paymentHeader) return record;
  return {
    ...record,
    payment: {
      ...record.payment,
      x402: sanitizeBnbX402PaymentSnapshot(record.payment.x402),
    },
  };
}

export function normalizeTermixVerdict(value: string): BnbTermixComparisonRecord["verdict"] {
  if (value === "agent_better" || value === "equal" || value === "manual_better") return value;
  return "pending";
}

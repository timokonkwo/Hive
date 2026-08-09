import { randomUUID } from "crypto";
import type { Filter } from "mongodb";
import { COLLECTIONS, getDb } from "@/lib/db";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { readBnbEscrowPayment } from "@/lib/bnb/escrow";
import { readBnbSessionGrant, readBnbSessionRevoke } from "@/lib/bnb/session";
import type {
  BnbAccessRequestRecord,
  BnbActivationRecord,
  BnbAgentProfile,
  BnbAltanaSessionRecord,
  BnbAltanaSessionTemplate,
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

type ProcessRecordStore = {
  activations: BnbActivationRecord[];
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

async function listBnbCollection<T extends BnbStoredRecord>(collection: string, limit: number, ownerId?: string) {
  if (!hasDatabaseConfig()) return null;

  try {
    const db = await getDb();
    const query = (ownerId ? { clientAddress: ownerId } : {}) as Filter<T & { _id?: unknown }>;
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
  spendCap,
  expiry,
  clientAddress,
}: {
  agent: BnbAgentProfile;
  taskTemplate: string;
  spendCap: string;
  expiry: string;
  clientAddress?: string;
}) {
  const now = new Date().toISOString();
  const record: BnbActivationRecord = {
    recordType: "hire",
    recordId: randomUUID(),
    receiptId: `hive-bsc-${agent.tokenId}-${Date.now()}`,
    status: "saved",
    createdAt: now,
    updatedAt: now,
    ...(clientAddress ? { clientAddress } : {}),
    agent: {
      chainId: agent.chainId,
      tokenId: agent.tokenId,
      name: agent.name,
      activationStatus: agent.activationStatus,
      agentWallet: agent.agentWallet,
    },
    limits: {
      task: taskTemplate,
      budget: spendCap,
      expires: expiry,
      walletConfirmationRequired: true,
    },
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
      chainId: 56,
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
      chainId: 56,
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
    status: payment.transactionStatus === "success" ? "payment_confirmed" : payment.transactionStatus === "reverted" ? "payment_reverted" : "payment_submitted",
    payment: {
      chainId: 56,
      contractAddress: payment.contractAddress,
      transactionHash: payment.transactionHash,
      transactionStatus: payment.transactionStatus,
      explorerUrl: payment.explorerUrl,
      blockNumber: payment.blockNumber,
      jobId: payment.jobId,
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

export async function listBnbRecords(limit = 25, ownerId?: string): Promise<BnbRecordsSnapshot> {
  const boundedLimit = Math.min(Math.max(limit, 1), 100);

  const [activations, accessRequests, termixComparisons, altanaSessions] = await Promise.all([
    listBnbCollection<BnbActivationRecord>(COLLECTIONS.BNB_ACTIVATIONS, boundedLimit, ownerId),
    listBnbCollection<BnbAccessRequestRecord>(COLLECTIONS.BNB_ACCESS_REQUESTS, boundedLimit, ownerId),
    listBnbCollection<BnbTermixComparisonRecord>(COLLECTIONS.BNB_TERMIX_COMPARISONS, boundedLimit, ownerId),
    listBnbCollection<BnbAltanaSessionRecord>(COLLECTIONS.BNB_ALTANA_SESSIONS, boundedLimit, ownerId),
  ]);

  if (activations && accessRequests && termixComparisons && altanaSessions) {
    return {
      activations,
      accessRequests,
      termixComparisons,
      altanaSessions,
      storage: "database",
      lastUpdated: new Date().toISOString(),
    };
  }

  const processStore = getProcessStore();
  return {
    activations: processStore.activations.filter((record) => !ownerId || record.clientAddress === ownerId).slice(0, boundedLimit),
    accessRequests: processStore.accessRequests.filter((record) => !ownerId || record.clientAddress === ownerId).slice(0, boundedLimit),
    termixComparisons: processStore.termixComparisons.filter((record) => !ownerId || record.clientAddress === ownerId).slice(0, boundedLimit),
    altanaSessions: processStore.altanaSessions.filter((record) => !ownerId || record.clientAddress === ownerId).slice(0, boundedLimit),
    storage: "process",
    lastUpdated: new Date().toISOString(),
  };
}

export function normalizeTermixVerdict(value: string): BnbTermixComparisonRecord["verdict"] {
  if (value === "agent_better" || value === "equal" || value === "manual_better") return value;
  return "pending";
}

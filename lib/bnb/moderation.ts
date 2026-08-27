import { COLLECTIONS, getDb } from "@/lib/db";
import type {
  BnbAgentProfile,
  BnbListingModerationReason,
  BnbListingModerationRecord,
  BnbListingModerationStatus,
} from "@/lib/bnb/types";

const ACTIVE_BNB_MODERATION_STATUSES: BnbListingModerationStatus[] = ["hidden", "blocked"];
const BNB_MODERATION_KEY_CACHE_TTL_MS = 30_000;
const MAX_ACTIVE_BNB_MODERATION_KEYS = 20_000;
const BNB_MODERATION_REASONS: BnbListingModerationReason[] = [
  "broken_endpoint",
  "malformed_profile",
  "wrong_category",
  "unsafe_endpoint",
  "spam",
  "policy",
  "other",
];

type BnbListingModerationDocument = {
  _id: string;
  key: string;
  chainId: number;
  tokenId: string;
  status: BnbListingModerationStatus;
  reason: BnbListingModerationReason;
  note?: string;
  actorId?: string;
  createdAt: Date;
  updatedAt: Date;
};

type ListBnbListingModerationOptions = {
  status?: string | null;
  page?: number;
  limit?: number;
};

type UpsertBnbListingModerationInput = {
  chainId: string | number;
  tokenId: string | number;
  status: BnbListingModerationStatus;
  reason?: string | null;
  note?: string | null;
  actorId?: string | null;
};

let moderationIndexesReady: Promise<void> | null = null;
let activeModerationKeysCache: { keys: string[]; expiresAt: number } | null = null;

export function bnbListingModerationKey(chainId: string | number, tokenId: string | number) {
  return parseBnbListingIdentity(chainId, tokenId).key;
}

export function normalizeBnbListingModerationStatus(value: unknown): BnbListingModerationStatus | null {
  const status = String(value || "").trim().toLowerCase();
  return ACTIVE_BNB_MODERATION_STATUSES.includes(status as BnbListingModerationStatus)
    ? status as BnbListingModerationStatus
    : null;
}

export function normalizeBnbListingModerationReason(value: unknown): BnbListingModerationReason {
  const reason = String(value || "").trim().toLowerCase();
  return BNB_MODERATION_REASONS.includes(reason as BnbListingModerationReason)
    ? reason as BnbListingModerationReason
    : "other";
}

export async function activeBnbListingModerationKeys() {
  const now = Date.now();
  if (activeModerationKeysCache && activeModerationKeysCache.expiresAt > now) {
    return activeModerationKeysCache.keys;
  }

  const db = await getBnbModerationDb(false);
  if (!db) return [];
  await ensureBnbModerationIndexes(false);

  try {
    const records = await db.collection<BnbListingModerationDocument>(COLLECTIONS.BNB_LISTING_MODERATION)
      .find({ status: { $in: ACTIVE_BNB_MODERATION_STATUSES } })
      .project<{ _id: string }>({ _id: 1 })
      .limit(MAX_ACTIVE_BNB_MODERATION_KEYS)
      .toArray();
    const keys = records.map((record) => record._id).filter(Boolean);
    activeModerationKeysCache = { keys, expiresAt: now + BNB_MODERATION_KEY_CACHE_TTL_MS };
    return keys;
  } catch {
    return [];
  }
}

export async function applyBnbListingModeration<T extends Pick<BnbAgentProfile, "chainId" | "tokenId">>(agents: T[]) {
  if (agents.length === 0) return agents;
  const keys = await activeBnbListingModerationKeys();
  if (keys.length === 0) return agents;

  const moderated = new Set(keys);
  return agents.filter((agent) => {
    try {
      return !moderated.has(bnbListingModerationKey(agent.chainId, agent.tokenId));
    } catch {
      return true;
    }
  });
}

export async function isBnbListingModerated(chainId: string | number, tokenId: string | number) {
  let key: string;
  try {
    key = bnbListingModerationKey(chainId, tokenId);
  } catch {
    return false;
  }

  const db = await getBnbModerationDb(false);
  if (!db) return false;
  await ensureBnbModerationIndexes(false);

  const record = await db.collection<BnbListingModerationDocument>(COLLECTIONS.BNB_LISTING_MODERATION)
    .findOne({
      _id: key,
      status: { $in: ACTIVE_BNB_MODERATION_STATUSES },
    }, { projection: { _id: 1 } })
    .catch(() => null);

  return Boolean(record);
}

export async function listBnbListingModerationRecords(options: ListBnbListingModerationOptions = {}) {
  const db = await getBnbModerationDb(true);
  await ensureBnbModerationIndexes(true);

  const page = Math.max(Math.trunc(options.page || 1), 1);
  const limit = Math.min(Math.max(Math.trunc(options.limit || 50), 1), 100);
  const status = normalizeBnbListingModerationStatus(options.status);
  const query = status ? { status } : {};

  const [records, total] = await Promise.all([
    db.collection<BnbListingModerationDocument>(COLLECTIONS.BNB_LISTING_MODERATION)
      .find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    db.collection<BnbListingModerationDocument>(COLLECTIONS.BNB_LISTING_MODERATION).countDocuments(query),
  ]);

  return {
    records: records.map(publicBnbModerationRecord),
    page,
    limit,
    total,
  };
}

export async function upsertBnbListingModeration(input: UpsertBnbListingModerationInput) {
  const identity = parseBnbListingIdentity(input.chainId, input.tokenId);
  const db = await getBnbModerationDb(true);
  await ensureBnbModerationIndexes(true);

  const status = normalizeBnbListingModerationStatus(input.status);
  if (!status) throw new Error("status must be hidden or blocked");

  const now = new Date();
  const key = identity.key;
  const note = cleanOptionalText(input.note, 600);
  const actorId = cleanOptionalText(input.actorId, 160);
  const unset: Record<string, ""> = {};
  if (!note) unset.note = "";
  if (!actorId) unset.actorId = "";
  const update = {
    $set: {
      key,
      chainId: identity.chainId,
      tokenId: identity.tokenId,
      status,
      reason: normalizeBnbListingModerationReason(input.reason),
      ...(note ? { note } : {}),
      ...(actorId ? { actorId } : {}),
      updatedAt: now,
    },
    $setOnInsert: {
      createdAt: now,
    },
    ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
  };

  await db.collection<BnbListingModerationDocument>(COLLECTIONS.BNB_LISTING_MODERATION)
    .updateOne({ _id: key }, update, { upsert: true });
  clearBnbListingModerationKeyCache();

  const record = await db.collection<BnbListingModerationDocument>(COLLECTIONS.BNB_LISTING_MODERATION)
    .findOne({ _id: key });

  if (!record) throw new Error("moderation update failed");
  return publicBnbModerationRecord(record);
}

export async function clearBnbListingModeration(chainId: string | number, tokenId: string | number) {
  const key = bnbListingModerationKey(chainId, tokenId);
  const db = await getBnbModerationDb(true);
  await ensureBnbModerationIndexes(true);

  await db.collection<BnbListingModerationDocument>(COLLECTIONS.BNB_LISTING_MODERATION).deleteOne({ _id: key });
  clearBnbListingModerationKeyCache();
  return { key };
}

export function clearBnbListingModerationKeyCache() {
  activeModerationKeysCache = null;
}

async function getBnbModerationDb(required: true): Promise<Awaited<ReturnType<typeof getDb>>>;
async function getBnbModerationDb(required: false): Promise<Awaited<ReturnType<typeof getDb>> | null>;
async function getBnbModerationDb(required: boolean) {
  if (process.env.BNB_LISTING_MODERATION_ENABLED === "false" || !process.env.MONGODB_URI) {
    if (required) throw new Error("Moderation storage is not configured");
    return null;
  }

  try {
    return await getDb();
  } catch (error) {
    if (required) throw error;
    return null;
  }
}

async function ensureBnbModerationIndexes(required: boolean) {
  if (moderationIndexesReady) return moderationIndexesReady;
  const db = required ? await getBnbModerationDb(true) : await getBnbModerationDb(false);
  if (!db) return;

  moderationIndexesReady = (async () => {
    const collection = db.collection<BnbListingModerationDocument>(COLLECTIONS.BNB_LISTING_MODERATION);
    await Promise.all([
      collection.createIndex({ chainId: 1, tokenId: 1 }, { unique: true }),
      collection.createIndex({ status: 1, updatedAt: -1 }),
      collection.createIndex({ reason: 1, updatedAt: -1 }),
    ]);
  })().catch((error) => {
    moderationIndexesReady = null;
    if (required) throw error;
  });
  return moderationIndexesReady;
}

function parseBnbListingIdentity(chainId: string | number, tokenId: string | number) {
  const parsedChainId = Number(chainId);
  const parsedTokenId = String(tokenId || "").trim();
  if (!Number.isInteger(parsedChainId) || parsedChainId <= 0 || !parsedTokenId) {
    throw new Error("chainId and tokenId are required");
  }
  return {
    chainId: parsedChainId,
    tokenId: parsedTokenId,
    key: `${parsedChainId}:${parsedTokenId}`,
  };
}

function publicBnbModerationRecord(record: BnbListingModerationDocument): BnbListingModerationRecord {
  return {
    key: record.key || record._id,
    chainId: record.chainId,
    tokenId: record.tokenId,
    status: record.status,
    reason: record.reason,
    ...(record.note ? { note: record.note } : {}),
    ...(record.actorId ? { actorId: record.actorId } : {}),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function cleanOptionalText(value: unknown, max: number) {
  const text = String(value || "").trim();
  if (!text) return undefined;
  return text.length > max ? text.slice(0, max) : text;
}

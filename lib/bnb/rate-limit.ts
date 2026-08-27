import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { COLLECTIONS, getDb } from "@/lib/db";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

type BnbRateLimitDocument = {
  _id: string;
  route: string;
  count: number;
  resetAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const BNB_RATE_LIMITS = {
  read: { maxRequests: 120, windowSeconds: 60 },
  write: RATE_LIMITS.WRITE,
  preflight: { maxRequests: 20, windowSeconds: 60 },
  run: { maxRequests: 10, windowSeconds: 60 },
  payment: { maxRequests: 15, windowSeconds: 60 },
  cron: { maxRequests: 12, windowSeconds: 60 },
} as const;

type BnbRateLimitConfig = typeof BNB_RATE_LIMITS[keyof typeof BNB_RATE_LIMITS];
type BnbRateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
};

let bnbRateLimitIndexesReady: Promise<void> | null = null;

export async function enforceBnbRateLimit(
  request: NextRequest,
  route: string,
  kind: "read" | "write" = "read"
) {
  const ip = getClientIp(request);
  const config = bnbRateLimitConfig(route, kind);
  const result = await checkBnbRateLimit(`bnb:${route}:${ip}`, route, config, kind);

  if (result.allowed) return null;

  return NextResponse.json(
    { error: `Rate limited. Try again in ${result.resetInSeconds}s.` },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.resetInSeconds),
      },
    }
  );
}

async function checkBnbRateLimit(
  identifier: string,
  route: string,
  config: BnbRateLimitConfig,
  kind: "read" | "write"
): Promise<BnbRateLimitResult> {
  if (isMongoBnbRateLimitEnabled(kind)) {
    try {
      return await checkMongoBnbRateLimit(hashBnbRateLimitIdentifier(identifier), route, config);
    } catch {
      if (process.env.NODE_ENV === "production" && kind === "write") {
        return { allowed: false, remaining: 0, resetInSeconds: Math.max(1, config.windowSeconds) };
      }
    }
  }

  return checkRateLimit(identifier, config);
}

function isMongoBnbRateLimitEnabled(kind: "read" | "write") {
  return kind === "write" && process.env.BNB_RATE_LIMIT_STORAGE !== "memory" && Boolean(process.env.MONGODB_URI);
}

async function checkMongoBnbRateLimit(
  key: string,
  route: string,
  config: BnbRateLimitConfig
): Promise<BnbRateLimitResult> {
  const db = await getDb();
  await ensureBnbRateLimitIndexes();
  const now = new Date();
  const resetAt = new Date(now.getTime() + config.windowSeconds * 1000);
  const expired = { $lte: [{ $ifNull: ["$resetAt", new Date(0)] }, now] };
  const collection = db.collection<BnbRateLimitDocument>(COLLECTIONS.BNB_RATE_LIMITS);
  const document = await collection.findOneAndUpdate(
    { _id: key },
    [
      {
        $set: {
          route,
          count: {
            $cond: [
              expired,
              1,
              { $add: [{ $ifNull: ["$count", 0] }, 1] },
            ],
          },
          resetAt: {
            $cond: [expired, resetAt, "$resetAt"],
          },
          createdAt: {
            $ifNull: ["$createdAt", now],
          },
          updatedAt: now,
        },
      },
    ],
    { upsert: true, returnDocument: "after" }
  );
  const count = Math.max(0, Number(document?.count || 0));
  const resetTime = document?.resetAt instanceof Date ? document.resetAt.getTime() : resetAt.getTime();
  return {
    allowed: count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - count),
    resetInSeconds: Math.max(1, Math.ceil((resetTime - now.getTime()) / 1000)),
  };
}

async function ensureBnbRateLimitIndexes() {
  if (bnbRateLimitIndexesReady) return bnbRateLimitIndexesReady;
  bnbRateLimitIndexesReady = (async () => {
    const db = await getDb();
    const collection = db.collection<BnbRateLimitDocument>(COLLECTIONS.BNB_RATE_LIMITS);
    await Promise.all([
      collection.createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 }),
      collection.createIndex({ route: 1, resetAt: 1 }),
    ]);
  })().catch((error) => {
    bnbRateLimitIndexesReady = null;
    throw error;
  });
  return bnbRateLimitIndexesReady;
}

function hashBnbRateLimitIdentifier(identifier: string) {
  const salt = bnbRateLimitHashSalt();
  return createHash("sha256").update(`${salt}:${identifier}`).digest("hex");
}

function bnbRateLimitHashSalt() {
  const salt = process.env.BNB_AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (salt) return salt;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BNB_AUTH_SECRET, NEXTAUTH_SECRET, or AUTH_SECRET is required for Mongo-backed BNB rate limits");
  }
  return "hive-bnb-rate-limit";
}

function bnbRateLimitConfig(route: string, kind: "read" | "write") {
  if (route.includes("cron:")) return BNB_RATE_LIMITS.cron;
  if (route.includes(":run")) return BNB_RATE_LIMITS.run;
  if (route.includes(":preflight")) return BNB_RATE_LIMITS.preflight;
  if (route.includes(":payment") || route.includes(":settlement")) return BNB_RATE_LIMITS.payment;
  return kind === "write" ? BNB_RATE_LIMITS.write : BNB_RATE_LIMITS.read;
}

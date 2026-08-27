import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import {
  clearBnbListingModeration,
  listBnbListingModerationRecords,
  normalizeBnbListingModerationStatus,
  upsertBnbListingModeration,
} from "@/lib/bnb/moderation";

const MAX_BNB_MODERATION_BODY_BYTES = 8 * 1024;

export async function GET(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "admin:bnb-moderation", "read");
  if (limited) return limited;

  const admin = await verifyAdmin(request);
  if (admin.error) return admin.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "50", 10);

  try {
    const result = await listBnbListingModerationRecords({ status, page, limit });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load moderation records" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "admin:bnb-moderation", "write");
  if (limited) return limited;

  const admin = await verifyAdmin(request);
  if (admin.error) return admin.error;

  const parsed = await readModerationBody(request);
  if ("error" in parsed) return parsed.error;

  const body = asRecord(parsed.body);
  const action = String(body.action || "").trim().toLowerCase();
  const chainId = String(body.chainId || "").trim();
  const tokenId = String(body.tokenId || "").trim();
  if (!chainId || !tokenId) {
    return NextResponse.json({ error: "chainId and tokenId are required" }, { status: 400 });
  }

  if (action === "clear" || String(body.status || "").trim().toLowerCase() === "visible") {
    try {
      const result = await clearBnbListingModeration(chainId, tokenId);
      return NextResponse.json({ record: null, key: result.key });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to clear moderation record" },
        { status: 400 },
      );
    }
  }

  const status = normalizeBnbListingModerationStatus(body.status);
  if (!status) {
    return NextResponse.json({ error: "status must be hidden, blocked, or visible" }, { status: 400 });
  }

  try {
    const record = await upsertBnbListingModeration({
      chainId,
      tokenId,
      status,
      reason: String(body.reason || ""),
      note: String(body.note || ""),
      actorId: admin.client?.userId || "admin_api_key",
    });
    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update moderation record" },
      { status: 400 },
    );
  }
}

async function readModerationBody(request: NextRequest): Promise<{ body: unknown } | { error: NextResponse }> {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BNB_MODERATION_BODY_BYTES) {
    return { error: NextResponse.json({ error: "Request body is too large" }, { status: 413 }) };
  }

  try {
    return { body: raw ? JSON.parse(raw) : {} };
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

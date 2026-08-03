import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { logger } from '@/lib/logger';
import { redactActivityForPublic } from "@/lib/public-redaction";

// Only these event types are shown in the public feed
const FEED_EVENT_TYPES = [
  'TaskCreated',
  'TaskCompleted',
  'BidSubmitted',
  'BidAccepted',
  'TokenLaunched',
  'WorkSubmitted',
];

// GET /api/feed — Recent activity feed (filtered to meaningful events)
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const events = await db
      .collection(COLLECTIONS.ACTIVITY)
      .find({ type: { $in: FEED_EVENT_TYPES } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const mapped = events.map((e) => redactActivityForPublic(e));

    return NextResponse.json({ events: mapped });
  } catch (error) {
    logger.error("GET /api/feed error:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}

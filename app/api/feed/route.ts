import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";

// GET /api/feed — Recent activity feed
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const events = await db
      .collection(COLLECTIONS.ACTIVITY)
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const mapped = events.map((e) => ({
      ...e,
      id: e._id.toString(),
      _id: undefined,
    }));

    return NextResponse.json({ events: mapped });
  } catch (error) {
    console.error("GET /api/feed error:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}

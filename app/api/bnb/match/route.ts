import { NextRequest, NextResponse } from "next/server";
import { matchBnbAgents } from "@/lib/bnb/catalog";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "match", "write");
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const intent = typeof body.intent === "string" ? body.intent.trim() : "";

  if (!intent) {
    return NextResponse.json({ error: "intent is required" }, { status: 400 });
  }

  const category = typeof body.category === "string" ? body.category : null;
  const limit = typeof body.limit === "number" ? body.limit : 5;
  const matches = await matchBnbAgents(intent, category, limit);

  return NextResponse.json({
    intent,
    category,
    matches,
    lastUpdated: new Date().toISOString(),
  });
}

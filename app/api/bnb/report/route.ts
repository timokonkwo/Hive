import { NextRequest, NextResponse } from "next/server";
import { authenticateClient } from "@/lib/client-auth";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, listBnbRecords } from "@/lib/bnb/records";

export async function GET(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "report", "read");
  if (limited) return limited;

  const client = await authenticateClient(request);
  if (!client) {
    return NextResponse.json({ error: "Sign in to view receipts." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 25);
  try {
    const records = await listBnbRecords(Number.isFinite(limit) ? limit : 25, client.userId);

    return NextResponse.json(records);
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load report." }, { status: 500 });
  }
}

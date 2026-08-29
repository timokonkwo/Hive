import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient, requireBnbRequestedWalletOwner } from "@/lib/bnb/auth";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, listBnbRecords } from "@/lib/bnb/records";

export async function GET(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "records", "read");
  if (limited) return limited;

  const auth = await requireBnbClient(request, "view activity");
  if (auth.response) return auth.response;
  const walletOwnerResponse = requireBnbRequestedWalletOwner(request, auth);
  if (walletOwnerResponse) return walletOwnerResponse;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 25);
  try {
    const records = await listBnbRecords(Number.isFinite(limit) ? limit : 25, auth.ownerIds);

    return NextResponse.json(records, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load activity." }, { status: 500 });
  }
}

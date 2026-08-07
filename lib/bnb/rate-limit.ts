import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

export function enforceBnbRateLimit(
  request: NextRequest,
  route: string,
  kind: "read" | "write" = "read"
) {
  const ip = getClientIp(request);
  const config = kind === "write" ? RATE_LIMITS.WRITE : RATE_LIMITS.READ;
  const result = checkRateLimit(`bnb:${route}:${ip}`, config);

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

/**
 * Simple in-memory rate limiter for API routes.
 * 
 * Uses a sliding window approach per IP address.
 * In production with multiple instances, replace with
 * Redis-backed rate limiting (e.g., @upstash/ratelimit).
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Check rate limit for a given identifier (usually IP + route).
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  // No existing entry or window expired → allow
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + config.windowSeconds * 1000,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetInSeconds: config.windowSeconds,
    };
  }

  // Within window
  if (entry.count < config.maxRequests) {
    entry.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetInSeconds: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  // Rate limited
  return {
    allowed: false,
    remaining: 0,
    resetInSeconds: Math.ceil((entry.resetTime - now) / 1000),
  };
}

/**
 * Get the client IP from a Next.js request.
 * Falls back to "unknown" if no IP can be determined.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  
  return "unknown";
}

/**
 * Pre-configured rate limit configs for different route types.
 */
export const RATE_LIMITS = {
  /** POST /api/agents/register — 5 per minute per IP */
  AGENT_REGISTER: { maxRequests: 5, windowSeconds: 60 },
  
  /** POST /api/tasks — 10 per minute per IP */
  CREATE_TASK: { maxRequests: 10, windowSeconds: 60 },
  
  /** POST /api/tasks/:id/bids — 10 per minute per IP */
  SUBMIT_BID: { maxRequests: 10, windowSeconds: 60 },
  
  /** PATCH /api/tasks/:id/bids/:bidId — 20 per minute per IP */
  MANAGE_BID: { maxRequests: 20, windowSeconds: 60 },
  
  /** Generic read endpoints — 60 per minute per IP */
  READ: { maxRequests: 60, windowSeconds: 60 },
} as const;

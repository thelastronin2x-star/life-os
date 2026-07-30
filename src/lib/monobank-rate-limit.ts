import "server-only";
import { createHash } from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

/** Monobank enforces ~1 request/60s per token on client-info, and ~1/60s
 *  per (token, account) on statement — separately from each other. This is
 *  the ONE place that limit is enforced, shared across every caller
 *  regardless of how many sources ask at once: the existing client-driven
 *  routes, the new cron reconciliation, and the new durable backfill queue
 *  all ultimately call through monobank-bank-source.ts's fetchAccounts/
 *  fetchStatement, which check this before ever making a real request.
 *  Sliding (not fixed) window — a fixed window allows two requests just
 *  ~1s apart across a window boundary, which is exactly the kind of gap
 *  that produced the original negative-balance bug this is fixing. */
const clientInfoLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, "60 s"),
  prefix: "ratelimit:mono:client-info",
});

const statementLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, "60 s"),
  prefix: "ratelimit:mono:statement",
});

/** Never use the raw token as a Redis key — it's the actual bank
 *  credential, and Redis keys can end up in logs/monitoring. */
function tokenKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface RateLimitCheck {
  allowed: boolean;
  retryAfterMs: number;
}

export async function checkClientInfoRateLimit(token: string): Promise<RateLimitCheck> {
  const { success, reset } = await clientInfoLimiter.limit(tokenKey(token));
  return { allowed: success, retryAfterMs: Math.max(0, reset - Date.now()) };
}

export async function checkStatementRateLimit(token: string, accountId: string): Promise<RateLimitCheck> {
  const { success, reset } = await statementLimiter.limit(`${tokenKey(token)}:${accountId}`);
  return { allowed: success, retryAfterMs: Math.max(0, reset - Date.now()) };
}

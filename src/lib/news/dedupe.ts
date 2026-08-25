import { createHash } from "crypto";

/** Stable id for a news item derived from its URL — the same article
 *  fetched again (same day, a different market bucket, a re-run cron tick)
 *  always hashes to the same id, so upserting by id IS deduping by URL,
 *  with no separate lookup-then-insert step needed. */
export function idFromUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

/** Last-one-wins per URL within a single batch — used before the DB upsert
 *  so a URL that came back from two different market queries in the same
 *  refresh run (e.g. a Fed-rate story tagged both "forex" and "indices")
 *  doesn't insert twice; markets are unioned instead of dropping either. */
export function dedupeByUrl<T extends { url: string; markets: string[] }>(items: T[]): T[] {
  const byUrl = new Map<string, T>();
  for (const item of items) {
    const existing = byUrl.get(item.url);
    if (!existing) {
      byUrl.set(item.url, item);
      continue;
    }
    const mergedMarkets = Array.from(new Set([...existing.markets, ...item.markets]));
    byUrl.set(item.url, { ...existing, markets: mergedMarkets });
  }
  return Array.from(byUrl.values());
}

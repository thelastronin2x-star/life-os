import "server-only";
import { lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { macroEvents } from "@/lib/db/schema";
import { fetchBusinessQuantEvents } from "./businessquant-provider";
import { fetchFxMacroDataEvents } from "./fxmacrodata-provider";
import type { MacroEvent } from "./types";

export interface MacroRefreshResult {
  fetched: number;
  errors: string[];
}

/** Fetches US (BusinessQuant) + EUR/JPY (FXMacroData) upcoming macro
 *  events and replaces the cache. One provider failing (missing key, HTTP
 *  error) doesn't block the other — each is wrapped independently and its
 *  failure recorded in `errors` rather than thrown, since this runs inside
 *  a daily cron that must never crash outright over one bad source. Past
 *  events are dropped first: this feed is explicitly "upcoming events
 *  only", so there is no reason to keep a row once its date has passed —
 *  unlike news, there's no "already translated, don't touch again"
 *  concern here to justify an insert-only strategy. */
export async function refreshMacroEvents(): Promise<MacroRefreshResult> {
  const errors: string[] = [];
  const all: MacroEvent[] = [];

  const businessQuantKey = process.env.BUSINESSQUANT_API_KEY;
  if (businessQuantKey) {
    try {
      all.push(...(await fetchBusinessQuantEvents(businessQuantKey)));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "businessquant_failed");
    }
  } else {
    errors.push("businessquant_not_configured");
  }

  const fxMacroDataKey = process.env.FXMACRODATA_API_KEY;
  if (fxMacroDataKey) {
    for (const [currency, region] of [
      ["EUR", "EU"],
      ["JPY", "JP"],
    ] as const) {
      try {
        all.push(...(await fetchFxMacroDataEvents(currency, region, fxMacroDataKey)));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : `fxmacrodata_${currency.toLowerCase()}_failed`);
      }
    }
  } else {
    errors.push("fxmacrodata_not_configured");
  }

  await db.delete(macroEvents).where(lt(macroEvents.scheduledAt, new Date()));

  if (all.length > 0) {
    await db
      .insert(macroEvents)
      .values(
        all.map((event) => ({
          id: event.id,
          region: event.region,
          currency: event.currency,
          title: event.title,
          importance: event.importance,
          scheduledAt: new Date(event.scheduledAt),
          previous: event.previous ?? null,
          actual: event.actual ?? null,
          sourceUrl: event.sourceUrl ?? null,
          affectedMarkets: event.affectedMarkets,
          provider: event.provider,
          fetchedAt: new Date(),
        }))
      )
      .onConflictDoUpdate({
        target: macroEvents.id,
        set: {
          title: sql`excluded.title`,
          importance: sql`excluded.importance`,
          scheduledAt: sql`excluded.scheduled_at`,
          previous: sql`excluded.previous`,
          actual: sql`excluded.actual`,
          sourceUrl: sql`excluded.source_url`,
          affectedMarkets: sql`excluded.affected_markets`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });
  }

  return { fetched: all.length, errors };
}

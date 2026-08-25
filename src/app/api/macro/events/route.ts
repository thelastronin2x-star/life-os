import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { macroEvents } from "@/lib/db/schema";
import type { MacroEvent, MacroCurrency, MacroRegion, MacroImportance, MacroProvider } from "@/lib/macro/types";

const RESULT_LIMIT = 100;

/** Reads the cache /api/macro/refresh already filled — never calls
 *  BusinessQuant or FXMacroData itself, and never touches either API key.
 *  Rows are pre-filtered to "upcoming only" at refresh time (see
 *  refresh.ts), so this just returns everything currently cached,
 *  soonest-first. */
export async function GET() {
  try {
    const rows = await db.select().from(macroEvents).orderBy(asc(macroEvents.scheduledAt)).limit(RESULT_LIMIT);

    const items: MacroEvent[] = rows.map((row) => ({
      id: row.id,
      region: row.region as MacroRegion,
      currency: row.currency as MacroCurrency,
      title: row.title,
      importance: row.importance as MacroImportance,
      scheduledAt: row.scheduledAt.toISOString(),
      previous: row.previous ?? undefined,
      actual: row.actual ?? undefined,
      sourceUrl: row.sourceUrl ?? undefined,
      affectedMarkets: row.affectedMarkets,
      provider: row.provider as MacroProvider,
    }));

    return NextResponse.json({ items });
  } catch (e) {
    console.error("macro events fetch failed", e);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}

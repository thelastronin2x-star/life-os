import type { MacroEvent, MacroImportance } from "./types";

/** Pure normalization for FXMacroData, kept out of the `server-only`
 *  provider so it stays unit-testable. Unlike BusinessQuant, FXMacroData's
 *  `/v1/calendar/{currency}` endpoint is very thin (just a timestamp + an
 *  indicator slug) — the human-readable title and source link come from a
 *  separate `/v1/data_catalogue/{currency}` call, and the "previous"
 *  reading comes from a third `/v1/announcements/{currency}/{indicator}`
 *  call (the most recent value at or before the event's own scheduled
 *  time). The provider layer fetches all three and passes the merged
 *  pieces in here; this module only does the pure mapping. Same
 *  curated-allowlist rationale as businessquant-normalize.ts: FXMacroData
 *  has no importance/impact field either, so CURATED_FX_INDICATORS is a
 *  hand-picked mapping, not API data. */

export interface FxMacroDataCalendarRow {
  announcement_datetime: number; // unix seconds, UTC
  release: string; // indicator slug
}

export interface FxMacroDataCatalogueEntry {
  name: string;
  source_url?: string;
}

export interface FxMacroDataAnnouncementRow {
  announcement_datetime: number;
  val: number | null;
}

interface CuratedFxIndicator {
  importance: MacroImportance;
  markets: string[];
}

export const CURATED_FX_INDICATORS: Record<string, CuratedFxIndicator> = {
  inflation: { importance: "high", markets: ["forex", "indices", "commodities"] },
  core_inflation: { importance: "high", markets: ["forex", "indices", "commodities"] },
  policy_rate: { importance: "high", markets: ["forex", "indices"] },
  gdp: { importance: "high", markets: ["forex", "indices"] },
  non_farm_payrolls: { importance: "high", markets: ["forex", "indices"] },
  unemployment: { importance: "medium", markets: ["forex", "indices"] },
  retail_sales: { importance: "medium", markets: ["forex"] },
  gov_bond_10y: { importance: "medium", markets: ["forex"] },
};

/** Picks the value of the most recent announcement at or before
 *  `cutoffUnixSeconds`, regardless of the array's sort order (the API
 *  docs don't confirm one). Returns null if nothing qualifies. */
export function mostRecentAnnouncementValue(rows: FxMacroDataAnnouncementRow[], cutoffUnixSeconds: number): number | null {
  let best: FxMacroDataAnnouncementRow | null = null;
  for (const row of rows) {
    if (row.announcement_datetime <= cutoffUnixSeconds && (!best || row.announcement_datetime > best.announcement_datetime)) {
      best = row;
    }
  }
  return best?.val ?? null;
}

export function normalizeFxMacroDataEvent(params: {
  currency: "EUR" | "JPY";
  region: "EU" | "JP";
  calendarRow: FxMacroDataCalendarRow;
  catalogueEntry: FxMacroDataCatalogueEntry | undefined;
  previousValue: number | null;
}): MacroEvent | null {
  const curated = CURATED_FX_INDICATORS[params.calendarRow.release];
  if (!curated || !params.catalogueEntry) return null;

  return {
    id: `fxmacrodata-${params.region.toLowerCase()}-${params.calendarRow.release}-${params.calendarRow.announcement_datetime}`,
    region: params.region,
    currency: params.currency,
    title: params.catalogueEntry.name,
    importance: curated.importance,
    scheduledAt: new Date(params.calendarRow.announcement_datetime * 1000).toISOString(),
    previous: params.previousValue !== null ? String(params.previousValue) : undefined,
    sourceUrl: params.catalogueEntry.source_url,
    affectedMarkets: curated.markets,
    provider: "fxmacrodata",
  };
}

import type { MacroEvent, MacroImportance } from "./types";

/** Pure normalization for BusinessQuant's `/calendar/economic` response,
 *  kept out of the `server-only` provider so it stays unit-testable (same
 *  split as news/alpha-vantage-normalize.ts vs. alpha-vantage-provider.ts).
 *
 *  BusinessQuant's catalog is exclusively US indicators (confirmed via its
 *  own docs: 177 US-only codes), and this single endpoint already bundles
 *  the next scheduled release alongside the last known reading — no
 *  separate "previous value" lookup is needed, unlike FXMacroData. It does
 *  NOT return an importance/impact rating, so CURATED_US_INDICATORS below
 *  is a hand-picked allowlist + importance mapping, not something the API
 *  itself provides. Only indicators appearing in this allowlist ever
 *  surface as a MacroEvent — the raw feed includes ~177 codes (including
 *  daily FX-rate "indicators" that aren't macro releases at all), and
 *  filtering to a curated set here (rather than trusting an API-side
 *  `code=` filter whose exact matching semantics aren't confirmed) keeps
 *  the result grounded in indicators this code actually knows about. */
export interface BusinessQuantIndicator {
  indicator_id: number;
  code: string;
  name: string;
  category: string;
  display_unit: string;
  decimals: number;
  next_release: string | null;
  release_state: string;
  latest_value: number | null;
  prior_value: number | null;
}

export interface BusinessQuantCalendarResponse {
  data: BusinessQuantIndicator[];
}

interface CuratedIndicator {
  importance: MacroImportance;
  markets: string[];
}

export const CURATED_US_INDICATORS: Record<string, CuratedIndicator> = {
  "E:USCPI": { importance: "high", markets: ["indices", "forex", "commodities"] },
  "E:USCPICORE.YOY": { importance: "high", markets: ["indices", "forex", "commodities"] },
  "E:USPCEPICORE.YOY": { importance: "high", markets: ["indices", "forex", "commodities"] },
  "E:USPAYROLL": { importance: "high", markets: ["indices", "forex"] },
  "E:USPAYROLL.MOM": { importance: "high", markets: ["indices", "forex"] },
  "E:USUNEMP": { importance: "high", markets: ["indices", "forex"] },
  "E:USGDP.QOQ": { importance: "high", markets: ["indices", "forex"] },
  "E:USGDP": { importance: "medium", markets: ["indices", "forex"] },
  "E:USRETAIL": { importance: "medium", markets: ["indices", "forex"] },
  "E:USCLAIMS": { importance: "medium", markets: ["indices", "forex"] },
  "E:USIP": { importance: "medium", markets: ["indices"] },
};

export function formatBusinessQuantValue(value: number | null | undefined, unit: string, decimals: number): string | undefined {
  if (value === null || value === undefined) return undefined;
  const safeDecimals = Math.max(0, Math.min(6, decimals ?? 2));
  const rounded = value.toFixed(safeDecimals);
  return unit ? `${rounded} ${unit}` : rounded;
}

/** Returns null for anything outside the curated allowlist, or an
 *  indicator with no scheduled next release (nothing upcoming to show). */
export function normalizeBusinessQuantIndicator(indicator: BusinessQuantIndicator): MacroEvent | null {
  const curated = CURATED_US_INDICATORS[indicator.code];
  if (!curated || !indicator.next_release) return null;

  return {
    id: `businessquant-us-${indicator.code}-${indicator.next_release}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    region: "US",
    currency: "USD",
    title: indicator.name,
    importance: curated.importance,
    scheduledAt: indicator.next_release,
    previous: formatBusinessQuantValue(indicator.latest_value, indicator.display_unit, indicator.decimals),
    sourceUrl: undefined,
    affectedMarkets: curated.markets,
    provider: "businessquant",
  };
}

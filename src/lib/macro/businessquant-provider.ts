import "server-only";
import { normalizeBusinessQuantIndicator, type BusinessQuantCalendarResponse } from "./businessquant-normalize";
import type { MacroEvent } from "./types";

const BASE_URL = "https://data.businessquant.com/calendar/economic";

export class BusinessQuantApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessQuantApiError";
  }
}

/** Fetches every US indicator's upcoming release in one call — no
 *  server-side `code=`/`category=` filter is applied here since its exact
 *  matching semantics aren't confirmed by BusinessQuant's docs; the
 *  allowlist filtering happens client-side in normalizeBusinessQuantIndicator
 *  (see its own comment for why). */
export async function fetchBusinessQuantEvents(apiKey: string): Promise<MacroEvent[]> {
  const params = new URLSearchParams({ api_key: apiKey, release_state: "upcoming" });
  const res = await fetch(`${BASE_URL}?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    throw new BusinessQuantApiError(`businessquant_http_${res.status}`);
  }
  const data = (await res.json()) as BusinessQuantCalendarResponse;
  return (data.data ?? []).map(normalizeBusinessQuantIndicator).filter((event): event is MacroEvent => event !== null);
}

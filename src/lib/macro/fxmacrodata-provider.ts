import "server-only";
import {
  normalizeFxMacroDataEvent,
  mostRecentAnnouncementValue,
  CURATED_FX_INDICATORS,
  type FxMacroDataCalendarRow,
  type FxMacroDataCatalogueEntry,
  type FxMacroDataAnnouncementRow,
} from "./fxmacrodata-normalize";
import type { MacroEvent } from "./types";

const BASE_URL = "https://api.fxmacrodata.com/v1";

export class FxMacroDataApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FxMacroDataApiError";
  }
}

interface CalendarResponse {
  data: FxMacroDataCalendarRow[];
}
type CatalogueResponse = Record<string, FxMacroDataCatalogueEntry>;
interface AnnouncementsResponse {
  data: FxMacroDataAnnouncementRow[];
}

async function fxFetch<T>(path: string, apiKey: string): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE_URL}${path}${separator}api_key=${encodeURIComponent(apiKey)}`, { cache: "no-store" });
  if (!res.ok) {
    throw new FxMacroDataApiError(`fxmacrodata_http_${res.status}`);
  }
  return (await res.json()) as T;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Three calls per currency: the calendar (upcoming dates + indicator
 *  slugs), the data catalogue (slug -> human title + source URL), and one
 *  announcements lookup per distinct curated slug (to find the most recent
 *  already-released value, shown as `previous`). A single indicator's
 *  history failing doesn't drop the whole currency's calendar — it just
 *  surfaces with no `previous` value. */
export async function fetchFxMacroDataEvents(currency: "EUR" | "JPY", region: "EU" | "JP", apiKey: string): Promise<MacroEvent[]> {
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 86_400_000);
  const yesterday = new Date(now.getTime() - 86_400_000);

  const [calendar, catalogue] = await Promise.all([
    fxFetch<CalendarResponse>(`/calendar/${currency}?start_date=${dateKey(now)}&end_date=${dateKey(twoWeeksOut)}`, apiKey),
    fxFetch<CatalogueResponse>(`/data_catalogue/${currency}`, apiKey),
  ]);

  const curatedRows = (calendar.data ?? []).filter((row) => row.release in CURATED_FX_INDICATORS);
  const distinctSlugs = Array.from(new Set(curatedRows.map((row) => row.release)));
  const nowSeconds = Math.floor(now.getTime() / 1000);

  const previousValueBySlug = new Map<string, number | null>();
  await Promise.all(
    distinctSlugs.map(async (slug) => {
      try {
        const announcements = await fxFetch<AnnouncementsResponse>(
          `/announcements/${currency}/${slug}?end_date=${dateKey(yesterday)}&limit=10`,
          apiKey
        );
        previousValueBySlug.set(slug, mostRecentAnnouncementValue(announcements.data ?? [], nowSeconds));
      } catch {
        previousValueBySlug.set(slug, null);
      }
    })
  );

  return curatedRows
    .map((row) =>
      normalizeFxMacroDataEvent({
        currency,
        region,
        calendarRow: row,
        catalogueEntry: catalogue[row.release],
        previousValue: previousValueBySlug.get(row.release) ?? null,
      })
    )
    .filter((event): event is MacroEvent => event !== null);
}

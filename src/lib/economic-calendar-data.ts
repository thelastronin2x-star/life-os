export interface EconomicEvent {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string;
  currency: string;
  flag: string;
  name: string;
  impact: 1 | 2 | 3;
  previous: string;
  forecast: string;
  actual: string | null;
}

export interface HistoryPoint {
  label: string; // short axis label, e.g. "Тра"
  actual: number;
  forecast: number;
}

/**
 * The real calendar feed (JBlanked/Forex Factory) doesn't expose a past-releases
 * history for its free tier, so the sparkline/bar-chart on a handful of
 * well-known recurring events uses illustrative demo data until a real
 * history endpoint is wired up. Matched loosely by name so it still shows for
 * "Non-Farm Payrolls", "NFP", etc. regardless of the exact wording the feed
 * uses that week.
 */
const DEMO_HISTORY: { match: RegExp; points: HistoryPoint[] }[] = [
  {
    match: /nfp|non-?farm/i,
    points: [
      { label: "Кві", actual: 275, forecast: 240 },
      { label: "Тра", actual: 190, forecast: 210 },
      { label: "Чер", actual: 310, forecast: 250 },
      { label: "Лип", actual: 255, forecast: 230 },
    ],
  },
  {
    match: /cpi/i,
    points: [
      { label: "Кві", actual: 0.4, forecast: 0.3 },
      { label: "Тра", actual: 0.2, forecast: 0.3 },
      { label: "Чер", actual: 0.3, forecast: 0.3 },
      { label: "Лип", actual: 0.4, forecast: 0.3 },
    ],
  },
  {
    match: /ecb.*rate|interest rate.*ecb/i,
    points: [
      { label: "Кві", actual: 4.0, forecast: 4.0 },
      { label: "Тра", actual: 3.75, forecast: 3.75 },
      { label: "Чер", actual: 3.75, forecast: 3.75 },
      { label: "Лип", actual: 3.75, forecast: 3.75 },
    ],
  },
];

/** Returns illustrative demo history for a small set of well-known recurring
 *  events, or null when none matches (most events simply show no chart). */
export function getDemoHistory(eventName: string): HistoryPoint[] | null {
  const found = DEMO_HISTORY.find((d) => d.match.test(eventName));
  return found?.points ?? null;
}

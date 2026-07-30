import "server-only";

const BASE_URL = "https://www.jblanked.com";

export interface JBlankedEvent {
  Name: string;
  Currency: string;
  Category: string;
  Impact: "High" | "Medium" | "Low" | "None";
  Date: string; // "2024.02.08 15:30:00"
  Actual: number | string | null;
  Forecast: number | string | null;
  Previous: number | string | null;
  Outcome?: string;
  Strength?: string;
  Quality?: string;
}

export class JBlankedApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }

  /** JBlanked returns a plain 401 both for a genuinely invalid API key AND
   *  for a valid key with zero purchased credits — same status code, two
   *  completely different fixes (rotate the key vs. buy credits at
   *  jblanked.com/api/billing). The only way to tell them apart is the
   *  response body text, which says "requires credits" specifically for
   *  the billing case. */
  get isCreditsExhausted(): boolean {
    return this.message.toLowerCase().includes("credit");
  }
}

/**
 * Fetches the current week's Forex Factory calendar. The free JBlanked tier
 * is limited to ~1 request/day account-wide (shared across every visitor of
 * this app, not per-user) — the 24h Next.js fetch cache is load-bearing here,
 * not just a performance nicety: without it, a handful of concurrent users
 * would burn the whole day's quota within minutes.
 */
export async function fetchForexFactoryWeek(): Promise<JBlankedEvent[]> {
  const apiKey = process.env.JBLANKED_API_KEY;
  if (!apiKey) {
    throw new JBlankedApiError(0, "not_configured");
  }

  const res = await fetch(`${BASE_URL}/news/api/forex-factory/calendar/week/`, {
    headers: {
      Authorization: `Api-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new JBlankedApiError(res.status, text.slice(0, 300));
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

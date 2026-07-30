import { NextResponse } from "next/server";
import { fetchForexFactoryWeek, JBlankedApiError, type JBlankedEvent } from "@/lib/jblanked";

export interface CalendarEventDto {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  currency: string;
  flag: string;
  name: string;
  impact: 1 | 2 | 3;
  previous: string;
  forecast: string;
  actual: string | null;
}

const FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  AUD: "🇦🇺",
  CAD: "🇨🇦",
  CHF: "🇨🇭",
  NZD: "🇳🇿",
  CNY: "🇨🇳",
};

const IMPACT_MAP: Record<JBlankedEvent["Impact"], 1 | 2 | 3 | 0> = {
  High: 3,
  Medium: 2,
  Low: 1,
  None: 0,
};

function formatValue(v: JBlankedEvent["Actual"]): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function parseJBlankedDate(raw: string): { date: string; time: string } | null {
  const match = raw.trim().match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
}

function mapEvent(e: JBlankedEvent): CalendarEventDto | null {
  const parsed = parseJBlankedDate(e.Date);
  const impact = IMPACT_MAP[e.Impact] ?? 0;
  if (!parsed || impact === 0) return null; // skip unparseable rows and non-market-moving ("None") events

  return {
    id: `${e.Currency}-${parsed.date}-${parsed.time}-${e.Name}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    date: parsed.date,
    time: parsed.time,
    currency: e.Currency,
    flag: FLAGS[e.Currency] ?? "🏳️",
    name: e.Name,
    impact,
    previous: formatValue(e.Previous),
    forecast: formatValue(e.Forecast),
    actual: e.Actual === null || e.Actual === undefined || e.Actual === "" ? null : String(e.Actual),
  };
}

export async function GET() {
  if (!process.env.JBLANKED_API_KEY) {
    return NextResponse.json({ configured: false, events: [] });
  }

  try {
    const raw = await fetchForexFactoryWeek();
    const events = raw.map(mapEvent).filter((e): e is CalendarEventDto => e !== null);
    return NextResponse.json({ configured: true, events });
  } catch (e) {
    if (e instanceof JBlankedApiError && e.message === "not_configured") {
      return NextResponse.json({ configured: false, events: [] });
    }
    // Surfaced distinctly from a generic failure — the actual root cause
    // here isn't a bug to patch, it's the connected JBlanked account
    // genuinely having zero purchased credits, and only this specific error
    // tells the user what to actually do about it (buy credits) instead of
    // a vague "try again later" that implies retrying will help.
    if (e instanceof JBlankedApiError && e.isCreditsExhausted) {
      console.error("Economic calendar: JBlanked account has no credits", e.message);
      return NextResponse.json({ configured: true, events: [], error: "no_credits" });
    }
    console.error("Economic calendar fetch failed", e);
    return NextResponse.json({ configured: true, events: [], error: "fetch_failed" });
  }
}

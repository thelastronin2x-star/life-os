export interface ParsedMT5Trade {
  externalId: string; // "mt5:<positionId>"
  symbol: string;
  direction: "LONG" | "SHORT";
  openDate: string; // "YYYY-MM-DD"
  openTime: string; // "HH:MM"
  closeDate: string;
  closeTime: string;
  entry: number;
  stop: number;
  take: number;
  lot: number;
  closePrice: number;
  commission: number;
  swap: number;
  reportedProfit: number; // broker's own P&L, shown for reference only — not stored on Trade
}

export interface MT5ParseResult {
  trades: ParsedMT5Trade[];
  skippedRows: number;
}

const SECTION_NAMES = ["orders", "deals", "positions", "results", "summary"];

/** MT5 report numbers can use either "." or "," as the decimal separator
 *  depending on the terminal's regional settings. */
function parseLocaleNumber(raw: string): number {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return 0;
  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");
  let normalized = trimmed;
  if (hasComma && hasDot) {
    normalized = trimmed.lastIndexOf(",") > trimmed.lastIndexOf(".")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.replace(/,/g, "");
  } else if (hasComma) {
    normalized = trimmed.replace(",", ".");
  }
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

/** MT5 timestamps look like "2024.01.15 10:30:00" or "2024.01.15 10:30". */
function parseMT5DateTime(raw: string): { date: string; time: string } | null {
  const match = raw.trim().match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
}

function cellText(cell: Element): string {
  return (cell.textContent ?? "").trim();
}

/**
 * Parses the "Positions" table from an MT5 "Save as Report" (History tab) HTML
 * export — the one table that already pairs each position's open + close data
 * in a single row. Runs entirely client-side (DOMParser), nothing is sent
 * anywhere.
 *
 * Expected column order (fixed by the MT5 report template, not broker-custom):
 * Time(open), Position, Symbol, Type, Volume, Price(open), S/L, T/P,
 * Time(close), Price(close), Commission, Swap, Profit.
 */
export function parseMT5Report(html: string): MT5ParseResult {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = Array.from(doc.querySelectorAll("tr"));

  const trades: ParsedMT5Trade[] = [];
  let skippedRows = 0;
  let inPositions = false;
  let headerSeen = false;

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length === 0) continue;
    const texts = cells.map(cellText);
    const firstNonEmpty = texts.find((t) => t.length > 0)?.toLowerCase() ?? "";

    if (!inPositions) {
      if (firstNonEmpty === "positions") {
        inPositions = true;
        headerSeen = false;
      }
      continue;
    }

    // A lone section-name cell ends the Positions block (Orders/Deals/etc follow).
    if (SECTION_NAMES.includes(firstNonEmpty) && texts.filter((t) => t.length > 0).length === 1) {
      break;
    }

    if (!headerSeen) {
      // Header row — column names, not data. Sanity-check it looks right.
      const joined = texts.join("|").toLowerCase();
      if (joined.includes("symbol") && joined.includes("profit")) {
        headerSeen = true;
      }
      continue;
    }

    if (texts.length < 13) {
      skippedRows += 1;
      continue;
    }

    const open = parseMT5DateTime(texts[0]);
    const close = parseMT5DateTime(texts[8]);
    const type = texts[3].toLowerCase();
    const direction: "LONG" | "SHORT" | null = type === "buy" ? "LONG" : type === "sell" ? "SHORT" : null;

    if (!open || !close || !direction || !texts[2]) {
      skippedRows += 1;
      continue;
    }

    trades.push({
      externalId: `mt5:${texts[1] || `${open.date}${open.time}${texts[2]}`}`,
      symbol: texts[2],
      direction,
      openDate: open.date,
      openTime: open.time,
      closeDate: close.date,
      closeTime: close.time,
      entry: parseLocaleNumber(texts[5]),
      stop: parseLocaleNumber(texts[6]),
      take: parseLocaleNumber(texts[7]),
      lot: parseLocaleNumber(texts[4]),
      closePrice: parseLocaleNumber(texts[9]),
      commission: Math.abs(parseLocaleNumber(texts[10])),
      swap: parseLocaleNumber(texts[11]),
      reportedProfit: parseLocaleNumber(texts[12]),
    });
  }

  return { trades, skippedRows };
}

/**
 * Matches a broker-reported symbol (which may carry a suffix like "EURUSD.a"
 * or "EURUSDm") against a known bare symbol (e.g. our "EUR/USD" stored
 * without the slash as "EURUSD"). Deliberately conservative — only accepts an
 * exact match or the broker symbol starting with the known one, so it can
 * never mangle a symbol into a shorter, wrong one.
 */
export function matchesKnownSymbol(brokerSymbol: string, knownBareSymbol: string): boolean {
  const cleaned = brokerSymbol.replace(/^#/, "").toUpperCase();
  const known = knownBareSymbol.toUpperCase();
  return cleaned === known || cleaned.startsWith(known);
}

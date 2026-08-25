export type PairCategory = "forex" | "metals" | "indices" | "oil";

export interface CurrencyPair {
  symbol: string;
  /** Approximate USD value of one pip (or, for indices/oil, one whole point)
   *  per 1.0 standard lot at typical exchange rates. Real-time accuracy
   *  needs live FX rates — wire up to a rates API later. */
  pipValuePerLot: number;
  category: PairCategory;
}

export const CURRENCY_PAIRS: CurrencyPair[] = [
  // Majors
  { symbol: "EUR/USD", pipValuePerLot: 10, category: "forex" },
  { symbol: "GBP/USD", pipValuePerLot: 10, category: "forex" },
  { symbol: "AUD/USD", pipValuePerLot: 10, category: "forex" },
  { symbol: "NZD/USD", pipValuePerLot: 10, category: "forex" },
  { symbol: "USD/JPY", pipValuePerLot: 9.1, category: "forex" },
  { symbol: "USD/CAD", pipValuePerLot: 7.4, category: "forex" },
  { symbol: "USD/CHF", pipValuePerLot: 11.3, category: "forex" },
  // JPY crosses
  { symbol: "GBP/JPY", pipValuePerLot: 9.1, category: "forex" },
  { symbol: "EUR/JPY", pipValuePerLot: 9.1, category: "forex" },
  { symbol: "AUD/JPY", pipValuePerLot: 9.1, category: "forex" },
  { symbol: "NZD/JPY", pipValuePerLot: 9.1, category: "forex" },
  { symbol: "CAD/JPY", pipValuePerLot: 9.1, category: "forex" },
  { symbol: "CHF/JPY", pipValuePerLot: 9.1, category: "forex" },
  // EUR crosses
  { symbol: "EUR/GBP", pipValuePerLot: 12.7, category: "forex" },
  { symbol: "EUR/AUD", pipValuePerLot: 6.6, category: "forex" },
  { symbol: "EUR/CHF", pipValuePerLot: 11.3, category: "forex" },
  { symbol: "EUR/CAD", pipValuePerLot: 7.4, category: "forex" },
  { symbol: "EUR/NZD", pipValuePerLot: 6.1, category: "forex" },
  // GBP crosses
  { symbol: "GBP/AUD", pipValuePerLot: 6.6, category: "forex" },
  { symbol: "GBP/CAD", pipValuePerLot: 7.4, category: "forex" },
  { symbol: "GBP/CHF", pipValuePerLot: 11.3, category: "forex" },
  { symbol: "GBP/NZD", pipValuePerLot: 6.1, category: "forex" },
  // Other crosses
  { symbol: "AUD/CAD", pipValuePerLot: 7.4, category: "forex" },
  { symbol: "AUD/CHF", pipValuePerLot: 11.3, category: "forex" },
  { symbol: "AUD/NZD", pipValuePerLot: 6.1, category: "forex" },
  { symbol: "NZD/CAD", pipValuePerLot: 7.4, category: "forex" },
  { symbol: "NZD/CHF", pipValuePerLot: 11.3, category: "forex" },
  { symbol: "CAD/CHF", pipValuePerLot: 11.3, category: "forex" },
  // Metals
  { symbol: "XAU/USD", pipValuePerLot: 10, category: "metals" },
  { symbol: "XAG/USD", pipValuePerLot: 50, category: "metals" },
  // Indices — $1 per point per 1.0 lot, matching the multiplier already used
  // for custom index instruments in the journal (journal-config-store.ts's
  // seeded US30 entry), so the two don't quietly disagree on what a lot means.
  { symbol: "US30", pipValuePerLot: 1, category: "indices" },
  { symbol: "NAS100", pipValuePerLot: 1, category: "indices" },
  { symbol: "SPX500", pipValuePerLot: 1, category: "indices" },
  { symbol: "GER40", pipValuePerLot: 1, category: "indices" },
  { symbol: "UK100", pipValuePerLot: 1, category: "indices" },
  { symbol: "JPN225", pipValuePerLot: 1, category: "indices" },
  // Oil — typical retail CFD convention, ~$10 per $1 (whole-point) move per lot.
  { symbol: "WTI", pipValuePerLot: 10, category: "oil" },
  { symbol: "BRENT", pipValuePerLot: 10, category: "oil" },
];

export const PAIR_CATEGORY_LABELS: Record<PairCategory, string> = {
  forex: "Форекс",
  metals: "Метали",
  indices: "Індекси",
  oil: "Нафта",
};

/** Indices and oil trade in whole points, not fractional forex pips — a
 *  "point" here already equals the same $1 move getPipSize would otherwise
 *  slice into ten-thousandths of. */
const POINT_BASED_SYMBOLS = new Set(["US30", "NAS100", "SPX500", "GER40", "UK100", "JPN225", "WTI", "BRENT"]);

export const RISK_PRESETS = [
  { label: "Консервативний", value: 0.5 },
  { label: "Стандарт", value: 1.5 },
  { label: "Агресивний", value: 3 },
];

/** Standard pip size for a symbol — JPY pairs and metals quote in hundredths,
 *  indices/oil move in whole points, everything else in ten-thousandths. */
export function getPipSize(symbol: string): number {
  if (POINT_BASED_SYMBOLS.has(symbol)) return 1;
  return symbol.includes("JPY") || symbol.startsWith("XAU") || symbol.startsWith("XAG") ? 0.01 : 0.0001;
}

/**
 * $ P&L per unit of raw price movement per 1.0 lot — derived from the same
 * pipValuePerLot table the risk calculator uses, so the journal's P&L math
 * never drifts from the calculator's. (raw price diff × multiplier × lot = $ P&L)
 */
export function getContractMultiplier(pair: CurrencyPair): number {
  return pair.pipValuePerLot / getPipSize(pair.symbol);
}

export function findCurrencyPair(symbol: string): CurrencyPair | undefined {
  return CURRENCY_PAIRS.find((p) => p.symbol === symbol);
}

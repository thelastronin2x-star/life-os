export interface CurrencyPair {
  symbol: string;
  /** Approximate USD value of one pip per 1.0 standard lot at typical exchange rates.
   *  Real-time accuracy needs live FX rates — wire up to a rates API later. */
  pipValuePerLot: number;
}

export const CURRENCY_PAIRS: CurrencyPair[] = [
  // Majors
  { symbol: "EUR/USD", pipValuePerLot: 10 },
  { symbol: "GBP/USD", pipValuePerLot: 10 },
  { symbol: "AUD/USD", pipValuePerLot: 10 },
  { symbol: "NZD/USD", pipValuePerLot: 10 },
  { symbol: "USD/JPY", pipValuePerLot: 9.1 },
  { symbol: "USD/CAD", pipValuePerLot: 7.4 },
  { symbol: "USD/CHF", pipValuePerLot: 11.3 },
  // JPY crosses
  { symbol: "GBP/JPY", pipValuePerLot: 9.1 },
  { symbol: "EUR/JPY", pipValuePerLot: 9.1 },
  { symbol: "AUD/JPY", pipValuePerLot: 9.1 },
  { symbol: "NZD/JPY", pipValuePerLot: 9.1 },
  { symbol: "CAD/JPY", pipValuePerLot: 9.1 },
  { symbol: "CHF/JPY", pipValuePerLot: 9.1 },
  // EUR crosses
  { symbol: "EUR/GBP", pipValuePerLot: 12.7 },
  { symbol: "EUR/AUD", pipValuePerLot: 6.6 },
  { symbol: "EUR/CHF", pipValuePerLot: 11.3 },
  { symbol: "EUR/CAD", pipValuePerLot: 7.4 },
  { symbol: "EUR/NZD", pipValuePerLot: 6.1 },
  // GBP crosses
  { symbol: "GBP/AUD", pipValuePerLot: 6.6 },
  { symbol: "GBP/CAD", pipValuePerLot: 7.4 },
  { symbol: "GBP/CHF", pipValuePerLot: 11.3 },
  { symbol: "GBP/NZD", pipValuePerLot: 6.1 },
  // Other crosses
  { symbol: "AUD/CAD", pipValuePerLot: 7.4 },
  { symbol: "AUD/CHF", pipValuePerLot: 11.3 },
  { symbol: "AUD/NZD", pipValuePerLot: 6.1 },
  { symbol: "NZD/CAD", pipValuePerLot: 7.4 },
  { symbol: "NZD/CHF", pipValuePerLot: 11.3 },
  { symbol: "CAD/CHF", pipValuePerLot: 11.3 },
  // Metals
  { symbol: "XAU/USD", pipValuePerLot: 10 },
  { symbol: "XAG/USD", pipValuePerLot: 50 },
];

export const RISK_PRESETS = [
  { label: "Консервативний", value: 0.5 },
  { label: "Стандарт", value: 1.5 },
  { label: "Агресивний", value: 3 },
];

/** Standard pip size for a symbol — JPY pairs and metals quote in hundredths, everything else in ten-thousandths. */
export function getPipSize(symbol: string): number {
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

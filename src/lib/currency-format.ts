/** The single place money amounts get turned into display strings across
 *  Фінанси — pins fraction digits explicitly so formatting can't drift
 *  between devices/locales (bare toLocaleString()/toFixed() calls were
 *  producing inconsistent decimal places, e.g. stray trailing zeros, on
 *  some devices). */
export function formatAmount(amount: number): string {
  return amount.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCurrency(amount: number, symbol: string): string {
  return `${formatAmount(amount)} ${symbol}`;
}

/** Converts an amount between UAH/USD/EUR using NBU's UAH-per-unit rates. */
export function convertCurrency(
  amount: number,
  from: "UAH" | "USD" | "EUR",
  to: "UAH" | "USD" | "EUR",
  rates: { UAH: number; USD: number; EUR: number }
): number {
  if (from === to) return amount;
  const inUah = amount * rates[from];
  return inUah / rates[to];
}

/** Resolves a display symbol (₴/$/€) back to its ISO currency id — every
 *  place that sums amounts across accounts/transactions needs this to know
 *  which currency a given number is actually in before mixing it with
 *  others. */
export function currencyIdForSymbol(symbol: string): "UAH" | "USD" | "EUR" {
  if (symbol === "$") return "USD";
  if (symbol === "€") return "EUR";
  return "UAH";
}

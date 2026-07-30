/** Strips a crypto quote-currency suffix (USDT/USD/USDC) from a raw broker
 *  symbol, leaving the base asset — "BTCUSDT" -> "BTC". Anchored to the end
 *  of the string, so a variant suffix like "-PERP" is never touched and
 *  stays a genuinely distinct symbol rather than collapsing into the base
 *  market. */
function stripQuoteSuffix(raw: string): string {
  return raw.replace(/(USDT|USD|USDC)$/i, "");
}

/** Canonical form of a crypto symbol used for instrument matching — same
 *  normalization applied everywhere an incoming symbol needs to be compared
 *  against an existing instrument's `symbol`, so creation, lookup, and any
 *  future migration can never silently drift apart from each other.
 *  Case and the "/" separator never affect the result. */
export function normalizeSymbol(raw: string): string {
  return stripQuoteSuffix(raw).replace(/[\s/]/g, "").toUpperCase();
}

/** The base-asset symbol used when creating a NEW instrument for a raw
 *  broker symbol not seen before — "BTCUSDT" -> "BTC/USD". */
export function baseAssetDisplaySymbol(raw: string): string {
  return `${stripQuoteSuffix(raw).toUpperCase()}/USD`;
}

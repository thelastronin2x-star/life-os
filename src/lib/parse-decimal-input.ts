// Requires at least one digit; the integer part is optional so ".5" parses
// same as "0.5", and the decimal part is optional so "5" and "5." both work.
const DECIMAL_PATTERN = /^-?(\d+\.?\d*|\.\d+)$/;

/** Parses a user-typed numeric string that may use either a comma or a
 *  period as the decimal separator — Ukrainian keyboard layouts typically
 *  produce a comma on the numeric-decimal key, and a plain `Number(...)` or
 *  `parseFloat(...)` call treats a comma as garbage, silently truncating or
 *  misreading the value (e.g. "1,0842" being read as "1" or, once the rest
 *  of the digits land with no separator at all, "10842"). Returns null for
 *  anything that isn't a genuine number (including "", "-", or trailing
 *  garbage) so callers can flag it instead of silently saving 0 or NaN. */
export function parseDecimalInput(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!DECIMAL_PATTERN.test(normalized)) return null;
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? null : n;
}

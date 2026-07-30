/** Middle value of a sorted copy of `values` (average of the two middle
 *  values for an even-length array). Returns 0 for an empty array — callers
 *  dealing with "no data yet" should check length themselves if they need
 *  to distinguish that from a genuine zero. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

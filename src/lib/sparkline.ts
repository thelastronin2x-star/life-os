/** Normalizes a series of values into an SVG polyline `points` string,
 *  mapping [min,max] onto [height-padding, padding] so the line always
 *  fills its box regardless of the data's actual scale — shared by every
 *  sparkline on the Фінанси dashboard (capital, income, expense, and each
 *  category row) instead of duplicating this per call site. */
export function sparklinePoints(values: number[], width: number, height: number, padding = 3): string {
  if (values.length === 0) return "";
  if (values.length === 1 || values.every((v) => v === values[0])) {
    const y = height / 2;
    return `0,${y} ${width},${y}`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

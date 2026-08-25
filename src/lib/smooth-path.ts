export interface Point {
  x: number;
  y: number;
}

/** An SVG path through `points` using cubic beziers instead of straight
 *  segments.
 *
 *  Control points come from Catmull-Rom, but with one modification that
 *  matters for money: each control point's y is clamped to the range of the
 *  two data points it sits between. Unclamped Catmull-Rom overshoots around
 *  sharp turns, which on an equity curve draws a dip below a low the account
 *  never actually hit — a smoothing artefact that looks exactly like a real
 *  drawdown. Clamping costs a little of the curve's flow at spikes and buys
 *  the guarantee that the line never leaves the envelope of the data.
 *
 *  `tension` 0 gives straight lines, 1 gives the classic Catmull-Rom curve;
 *  the default is deliberately below that — enough to lose the corners,
 *  not enough to turn a chart into decoration. */
export function smoothPath(points: Point[], tension = 0.8): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${fmt(points[0].x)},${fmt(points[0].y)}`;
  if (points.length === 2) {
    return `M${fmt(points[0].x)},${fmt(points[0].y)} L${fmt(points[1].x)},${fmt(points[1].y)}`;
  }

  const k = (tension * 1) / 6;
  let d = `M${fmt(points[0].x)},${fmt(points[0].y)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);

    const c1x = p1.x + (p2.x - p0.x) * k;
    const c1y = clamp(p1.y + (p2.y - p0.y) * k, lo, hi);
    const c2x = p2.x - (p3.x - p1.x) * k;
    const c2y = clamp(p2.y - (p3.y - p1.y) * k, lo, hi);

    d += ` C${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(p2.x)},${fmt(p2.y)}`;
  }

  return d;
}

/** The same curve closed into a fillable area down to `baseline`. */
export function smoothArea(points: Point[], baseline: number, tension?: number): string {
  if (points.length === 0) return "";
  const last = points[points.length - 1];
  const first = points[0];
  return `${smoothPath(points, tension)} L${fmt(last.x)},${fmt(baseline)} L${fmt(first.x)},${fmt(baseline)} Z`;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

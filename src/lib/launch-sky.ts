/** The launch screen's sky, derived from the wall clock at the moment it
 *  plays — so every open looks slightly different without the app having to
 *  read a single byte of stored data.
 *
 *  That last part is the whole reason this shape was chosen over the
 *  data-driven splash ideas (week-of-spending, category mosaic, day's P&L):
 *  those have nothing to draw during a cold start, because the launch overlay
 *  runs BEFORE localStorage has been rehydrated. The clock is always
 *  available, so this can never fall back to an empty or wrong-looking frame.
 *
 *  Pure and synchronous on purpose — no store, no hooks, no DOM — so the
 *  bands and the sun's position can be unit-tested at any hour without
 *  faking a browser. */

export interface SkyBand {
  /** CSS background for the full-bleed launch layer. */
  background: string;
  /** Sun/moon disc colour; also used for its glow. */
  disc: string;
  /** Text colour that stays legible on `background`. */
  text: string;
  /** Greeting shown under the arc. */
  greeting: string;
}

/** Ordered by `until` (exclusive upper bound, 24h clock). The first band whose
 *  `until` is greater than the current hour wins, so the list must stay
 *  sorted — see skyBandFor. */
const BANDS: (SkyBand & { until: number })[] = [
  { until: 3, background: "linear-gradient(#171b2e,#2a2f45)", disc: "#c9d2e8", text: "#e8ebf2", greeting: "Доброї ночі" },
  { until: 6, background: "linear-gradient(#3b3350,#7a5e6b)", disc: "#f0a58c", text: "#f6ece9", greeting: "Раннього ранку" },
  { until: 12, background: "linear-gradient(#f7ede0,#f6f1e6)", disc: "#e8a33c", text: "#171512", greeting: "Доброго ранку" },
  { until: 17, background: "linear-gradient(#eef2f4,#f6f1e6)", disc: "#e8b44a", text: "#171512", greeting: "Доброго дня" },
  { until: 21, background: "linear-gradient(#f6e3d4,#efe2dc)", disc: "#d97a4a", text: "#171512", greeting: "Доброго вечора" },
  { until: 24, background: "linear-gradient(#20243a,#343a55)", disc: "#b9c3dd", text: "#e8ebf2", greeting: "Доброї ночі" },
];

export function skyBandFor(date: Date = new Date()): SkyBand {
  const hour = date.getHours();
  const band = BANDS.find((b) => hour < b.until) ?? BANDS[BANDS.length - 1];
  // Strip `until` so callers can't accidentally depend on band boundaries.
  return { background: band.background, disc: band.disc, text: band.text, greeting: band.greeting };
}

export interface SunPosition {
  /** 0..1 across the screen — midnight at the left edge, midnight at the right. */
  x: number;
  /** 0..1 down the screen, 0 = top. Peaks (smallest y) around midday. */
  y: number;
}

/** Walks a half-circle arc: low at 00:00, highest at 12:00, low again at
 *  24:00. Returned as fractions rather than pixels so the caller decides the
 *  layer's real size — the launch overlay is full-screen and that varies. */
export function sunPositionAt(dayFraction: number): SunPosition {
  const t = Math.min(1, Math.max(0, dayFraction));
  return {
    x: 0.07 + t * 0.86,
    // 0.86 at the horizon, 0.16 at the zenith — kept off the very top so the
    // disc never collides with a notch or the status bar.
    y: 0.86 - Math.sin(t * Math.PI) * 0.7,
  };
}

export function dayFractionOf(date: Date = new Date()): number {
  return (date.getHours() * 60 + date.getMinutes()) / (24 * 60);
}

export function sunPositionFor(date: Date = new Date()): SunPosition {
  return sunPositionAt(dayFractionOf(date));
}

/** Sampled points along the arc, ending at `date`'s real position — the disc
 *  travels the last few hours of its path and settles where it actually
 *  belongs, instead of just fading in at a spot.
 *
 *  Clamped at the start of the day rather than wrapping: an hour after
 *  midnight, "three hours ago" is yesterday evening, and letting that wrap
 *  would send the disc flying right-to-left across the whole screen —
 *  backwards, and nothing like how the sky actually moves. Clamping just
 *  gives it a shorter run-up, which reads fine.
 *
 *  Returned as a list (not a CSS string) so the trajectory can be asserted in
 *  a test without parsing keyframes. */
export function sunTrailFor(date: Date = new Date(), hoursBefore = 3, steps = 14): SunPosition[] {
  const end = dayFractionOf(date);
  const start = Math.max(0, end - hoursBefore / 24);
  const trail: SunPosition[] = [];
  for (let i = 0; i <= steps; i++) {
    trail.push(sunPositionAt(start + ((end - start) * i) / steps));
  }
  return trail;
}

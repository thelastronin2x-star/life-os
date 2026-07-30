/** Clamps a percent value for an SVG progress ring into a safe 0..100 range.
 *  `NaN` (0/0) and `Infinity` (x/0) both happen for real with a goal/limit of
 *  0 — without this guard they'd flow straight into `strokeDashoffset` and
 *  break the ring's rendering, plus show as "NaN%"/"Infinity%".
 *  NaN (genuinely undefined — no target and nothing contributed) reads as
 *  0%; +Infinity (some positive amount against a 0 target) reads as a full
 *  100% ring, since that's unambiguously "at least fully there". */
export function clampRingPercent(percent: number): number {
  if (Number.isNaN(percent)) return 0;
  if (percent === Infinity) return 100;
  if (percent === -Infinity) return 0;
  return Math.min(100, Math.max(0, percent));
}

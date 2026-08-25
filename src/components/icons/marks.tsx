import type { ReactElement } from "react";

/** Hand-drawn line marks used as corner watermarks on Home cards.
 *
 *  Not icons and not emoji. Emoji dragged their own palette onto a card that
 *  had just been reduced to two colours, and a conventional icon set reads as
 *  UI furniture — a button you can't press. These are small scenes drawn in a
 *  single stroke weight in the card's own accent colour: a road going to the
 *  horizon rather than a car, a stack of coins rather than a wallet. At 11%
 *  opacity they darken the fill instead of adding a hue, so the card still
 *  reads as two colours while being identifiable at arm's length.
 *
 *  Every mark is drawn in the same 100×100 box with the same stroke weight,
 *  which is what makes them a family rather than a collection. `currentColor`
 *  throughout — the caller sets the colour, the mark never picks one. */
export type MarkName =
  | "road"
  | "food"
  | "shopping"
  | "home"
  | "subscriptions"
  | "market"
  | "calendar"
  | "savings"
  | "health"
  | "education"
  | "weather"
  | "income";

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  vectorEffect: "non-scaling-stroke",
} as const;

const PATHS: Record<MarkName, ReactElement> = {
  road: (
    <>
      <path {...S} d="M12 88c14-10 20-24 22-38S40 22 50 20s18 6 20 18 6 26 18 34" />
      <path {...S} d="M30 66h14M36 48h14M44 30h12" />
      <circle cx="50" cy="20" r="3.2" fill="currentColor" />
    </>
  ),
  food: (
    <>
      <path {...S} d="M22 50h56a28 28 0 01-28 28 28 28 0 01-28-28z" />
      <path {...S} d="M14 50h72" />
      <path {...S} d="M44 34c0-5 4-6 4-10s-3-6-3-9M58 34c0-5 4-6 4-10s-3-6-3-9" />
      <circle cx="50" cy="66" r="2.6" fill="currentColor" />
    </>
  ),
  shopping: (
    <>
      <path {...S} d="M26 36h48l6 46H20l6-46z" />
      <path {...S} d="M38 44V30a12 12 0 0124 0v14" />
      <circle cx="38" cy="50" r="2.4" fill="currentColor" />
      <circle cx="62" cy="50" r="2.4" fill="currentColor" />
    </>
  ),
  home: (
    <>
      <path {...S} d="M18 48L50 22l32 26" />
      <path {...S} d="M26 44v34h48V44" />
      <path {...S} d="M42 78V58h16v20" />
      <circle cx="50" cy="50" r="2.6" fill="currentColor" />
    </>
  ),
  subscriptions: (
    <>
      <rect {...S} x="34" y="16" width="32" height="68" rx="7" />
      <path {...S} d="M44 26h12" />
      <circle {...S} cx="50" cy="62" r="9" />
      <path {...S} d="M50 56v6l4 3" />
    </>
  ),
  market: (
    <>
      <path {...S} d="M16 76l18-16 14 10 20-24 16 12" />
      <path {...S} d="M84 46v12H72" />
      <path {...S} d="M30 34v22M30 40h-7v10h14V40h-7z" />
      <circle cx="66" cy="46" r="2.6" fill="currentColor" />
    </>
  ),
  calendar: (
    <>
      <rect {...S} x="18" y="26" width="64" height="56" rx="8" />
      <path {...S} d="M18 44h64M34 18v14M66 18v14" />
      <path {...S} d="M33 58h8M48 58h8M33 70h8" />
      <circle cx="64" cy="70" r="3" fill="currentColor" />
    </>
  ),
  savings: (
    <>
      <ellipse {...S} cx="50" cy="72" rx="24" ry="7" />
      <ellipse {...S} cx="50" cy="58" rx="24" ry="7" />
      <ellipse {...S} cx="50" cy="44" rx="24" ry="7" />
      <path {...S} d="M26 44v28M74 44v28" />
      <path {...S} d="M50 32V16M44 22l6-6 6 6" />
    </>
  ),
  health: (
    <>
      <path {...S} d="M50 84s-26-16-26-36a16 16 0 0126-12 16 16 0 0126 12c0 20-26 36-26 36z" />
      <path {...S} d="M32 50h10l5-8 6 16 5-8h10" />
    </>
  ),
  education: (
    <>
      <path {...S} d="M16 38l34-14 34 14-34 14-34-14z" />
      <path {...S} d="M30 46v18c0 6 9 10 20 10s20-4 20-10V46" />
      <path {...S} d="M84 38v20" />
    </>
  ),
  weather: (
    <>
      <circle {...S} cx="50" cy="50" r="16" />
      <path {...S} d="M50 20v-8M50 88v-8M20 50h-8M88 50h-8M28 28l-6-6M78 78l-6-6M28 72l-6 6M78 22l-6 6" />
    </>
  ),
  income: (
    <>
      <rect {...S} x="16" y="34" width="68" height="42" rx="8" />
      <path {...S} d="M16 48h68" />
      <path {...S} d="M32 28h36a8 8 0 018 6" />
      <circle cx="68" cy="62" r="3" fill="currentColor" />
    </>
  ),
};

export function Mark({ name, className }: { name: MarkName; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type StatTone = "sage" | "clay" | "gold" | "sky" | "rose" | "plain";

const TONE_BG: Record<StatTone, string> = {
  sage: "bg-sage-deep",
  clay: "bg-clay-deep",
  gold: "bg-gold-deep",
  sky: "bg-sky-deep",
  rose: "bg-rose-deep",
  plain: "bg-surface shadow-card",
};

const TONE_TEXT: Record<StatTone, string> = {
  sage: "text-sage",
  clay: "text-clay",
  gold: "text-gold",
  sky: "text-sky",
  rose: "text-rose",
  plain: "text-text",
};

/** A single figure on Home: tinted card, oversized watermark glyph bleeding
 *  off the bottom-right corner, caption and number on top.
 *
 *  The watermark is the whole point of this treatment. At arm's length the
 *  numbers are unreadable but the silhouette isn't — the weather card is
 *  identifiable by the sun in its corner without parsing a single character.
 *  It costs nothing in colour noise because it's drawn at ~15% opacity in the
 *  card's own tone, so it darkens the fill rather than adding a new hue. */
function StatCardBody({
  icon,
  label,
  value,
  unit,
  tone = "plain",
  watermark,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  unit?: string;
  tone?: StatTone;
  watermark?: ReactNode;
}) {
  return (
    <div className={cn("relative h-full overflow-hidden rounded-card p-3.5", TONE_BG[tone])}>
      {watermark && (
        <div
          aria-hidden
          className={cn("pointer-events-none absolute -bottom-4 -right-3 opacity-[0.18]", TONE_TEXT[tone])}
        >
          {watermark}
        </div>
      )}
      <div className={cn("relative flex items-center gap-1.5 text-[11.5px] font-extrabold", TONE_TEXT[tone])}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("relative mt-2 font-mono text-[21px] font-extrabold tracking-tight", TONE_TEXT[tone])}>
        {value}
        {unit && <span className="ml-1 text-[12px] font-bold">{unit}</span>}
      </div>
    </div>
  );
}

export function StatCard(props: {
  icon?: ReactNode;
  label: string;
  value: string;
  unit?: string;
  tone?: StatTone;
  watermark?: ReactNode;
  href?: string;
}) {
  const { href, ...rest } = props;
  if (href) {
    return (
      <Link href={href} className="block h-full">
        <StatCardBody {...rest} />
      </Link>
    );
  }
  return <StatCardBody {...rest} />;
}

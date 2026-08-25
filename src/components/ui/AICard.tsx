import { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Mark, type MarkName } from "@/components/icons/marks";
import { smoothPath, smoothArea, type Point } from "@/lib/smooth-path";

export type AICardTone = "warn" | "positive" | "neutral";

const TONE_TEXT: Record<AICardTone, string> = {
  warn: "text-clay",
  positive: "text-sage",
  neutral: "text-gold",
};

const TONE_VAR: Record<AICardTone, string> = {
  warn: "var(--clay)",
  positive: "var(--sage)",
  neutral: "var(--gold)",
};

/** The insight block on Home: white card, tone-coloured figure, the topic's
 *  line mark watermarked into the corner, and — when the insight has a series
 *  behind it — a faint curve bleeding off the bottom edge.
 *
 *  Previously this was a dark block, which did make it the first thing you
 *  read, but at the cost of being the only inverted surface in the app: it
 *  fought the light canvas rather than sitting on it. Primacy now comes from
 *  size and position instead of inversion — this is the one card with a
 *  sentence on it and the largest figure on the screen, directly under the
 *  greeting.
 *
 *  Everything past `text` is optional. Insights are generated as plain
 *  sentences, so the card has to look finished with nothing but one. */
export function AICard({
  text,
  sub,
  tone = "neutral",
  title,
  mark,
  figure,
  figureUnit,
  meta,
  series,
}: {
  text: ReactNode;
  sub?: string;
  tone?: AICardTone;
  /** Optional bold headline. Without it the body carries the card on its own,
   *  which is the right shape for a short single-sentence insight. */
  title?: string;
  /** Corner watermark. Omitted rather than defaulted — a wrong mark is worse
   *  than none, since it silently mislabels what the card is about. */
  mark?: MarkName;
  /** The one number the insight is built around, pre-formatted. */
  figure?: string;
  figureUnit?: string;
  /** Small line under the figure: limit, comparison, count. */
  meta?: ReactNode;
  /** Values behind the insight, oldest first. Drawn as a faint curve along the
   *  bottom — texture that happens to be true, rather than decoration. */
  series?: number[];
}) {
  const accent = TONE_VAR[tone];

  return (
    <div className="relative overflow-hidden rounded-card border border-border bg-surface px-4 pb-3.5 pt-4 shadow-card">
      {mark && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-5 -top-4 h-[124px] w-[124px] opacity-[0.11]",
            TONE_TEXT[tone]
          )}
        >
          <Mark name={mark} className="h-full w-full" />
        </div>
      )}

      {series && series.length >= 2 && <SeriesWash values={series} color={accent} />}

      <div className="relative">
        {title && (
          <div className={cn("mb-1 text-[15.5px] font-extrabold tracking-[-0.02em]", TONE_TEXT[tone])}>{title}</div>
        )}

        {figure && (
          <div
            className="mb-1.5 font-display text-[35px] font-medium leading-[1.05] tracking-[-0.045em]"
            style={{ color: accent }}
          >
            {figure}
            {figureUnit && <span className="text-[19px] font-normal">{figureUnit}</span>}
          </div>
        )}

        {meta && <div className="mb-2 text-[12.5px] font-semibold text-text-dim">{meta}</div>}

        <div className="max-w-[88%] text-[15px] font-medium leading-[1.45] text-text [&_b]:font-extrabold">
          {text}
        </div>

        {sub && (
          // No divider: on a card this short a rule plus the padding either
          // side of it costs more height than the line it separates.
          <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-text-faint">
            <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" aria-hidden>
              <path
                d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

const WASH_W = 356;
const WASH_H = 52;

/** The faint curve along the card's bottom edge. Absolutely positioned and
 *  clipped by the card, so it runs off both sides rather than sitting in a
 *  chart-shaped box — it's a texture, not a chart, and gets no axes, no
 *  labels and no tooltip. */
function SeriesWash({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const step = WASH_W / (values.length - 1);
  const coords: Point[] = values.map((v, i) => ({
    x: i * step,
    y: WASH_H - 6 - ((v - min) / range) * (WASH_H - 12),
  }));

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[52px]">
      <svg
        width="100%"
        height={WASH_H}
        viewBox={`0 0 ${WASH_W} ${WASH_H}`}
        preserveAspectRatio="none"
        className="block"
      >
        <defs>
          <linearGradient id="aiWash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={smoothArea(coords, WASH_H)} fill="url(#aiWash)" />
        <path
          d={smoothPath(coords)}
          fill="none"
          stroke={color}
          strokeOpacity={0.22}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

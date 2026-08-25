"use client";

import { smoothPath, smoothArea, type Point } from "@/lib/smooth-path";

export type EquityChartType = "line" | "bar" | "drawdown";
/** Which way the curve went. The chart no longer sits on a coloured card, so
 *  the line itself has to say whether the period was up or down. */
export type EquityTone = "positive" | "negative";

const W = 300;
const H = 52;

function buildEquity(deltas: number[]): number[] {
  return deltas.reduce<number[]>((acc, d) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
    return [...acc, prev + d];
  }, []);
}

function LineVariant({ points, tone }: { points: number[]; tone: EquityTone }) {
  const color = tone === "negative" ? "var(--clay)" : "var(--sage)";
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const range = max - min || 1;
  const step = points.length > 1 ? W / (points.length - 1) : 0;
  const coords: Point[] = points.map((v, i) => ({ x: i * step, y: H - ((v - min) / range) * H }));
  const path = smoothPath(coords);
  const area = smoothArea(coords, H);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        {/* Gradient id varies with tone: two charts of different tones on one
            screen would otherwise share the first one's <defs> and both come
            out the same colour. */}
        <linearGradient id={`equityFill-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#equityFill-${tone})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function BarVariant({ deltas }: { deltas: number[] }) {
  const maxAbs = Math.max(1, ...deltas.map((d) => Math.abs(d)));
  return (
    <div className="flex h-[52px] items-end gap-1">
      {deltas.map((d, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[3px]"
          style={{
            height: `${Math.max(4, (Math.abs(d) / maxAbs) * 100)}%`,
            background: d >= 0 ? "var(--sage)" : "var(--rose)",
            opacity: d >= 0 ? 0.8 : 1,
          }}
        />
      ))}
    </div>
  );
}

function DrawdownVariant({ equity, maxDrawdownPct }: { equity: number[]; maxDrawdownPct?: number }) {
  const drawdown = equity.reduce<{ peak: number; values: number[] }>(
    (acc, v) => {
      const peak = Math.max(acc.peak, v);
      return { peak, values: [...acc.values, v - peak] }; // v - peak is always <= 0
    },
    { peak: equity[0] ?? 0, values: [] }
  ).values;

  const minDD = Math.min(0, ...drawdown);
  const range = Math.abs(minDD) || 1;
  const step = drawdown.length > 1 ? W / (drawdown.length - 1) : 0;
  const coords: Point[] = drawdown.map((v, i) => ({ x: i * step, y: (Math.abs(v) / range) * H }));
  const path = smoothPath(coords);
  const area = smoothArea(coords, 0);

  return (
    <div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="ddFill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--rose)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--rose)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#ddFill)" />
        <path d={path} fill="none" stroke="var(--rose)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      {maxDrawdownPct != null && (
        <div className="mt-1 text-right text-[9px] text-text-faint">Ліміт просадки: {maxDrawdownPct}%</div>
      )}
    </div>
  );
}

export function EquityChart({
  type,
  deltas,
  maxDrawdownPct,
  tone = "positive",
}: {
  type: EquityChartType;
  deltas: number[];
  maxDrawdownPct?: number;
  tone?: EquityTone;
}) {
  if (deltas.length < 2) {
    return (
      <div className="flex h-[52px] items-center justify-center text-[10.5px] text-text-faint">
        Замало закритих угод для графіка
      </div>
    );
  }

  if (type === "bar") return <BarVariant deltas={deltas} />;
  const equity = buildEquity(deltas);
  if (type === "drawdown") return <DrawdownVariant equity={equity} maxDrawdownPct={maxDrawdownPct} />;
  return <LineVariant points={equity} tone={tone} />;
}

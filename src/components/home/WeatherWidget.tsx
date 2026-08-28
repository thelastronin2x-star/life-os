"use client";

import { useWeather } from "@/lib/use-weather";
import { smoothPath, smoothArea, type Point } from "@/lib/smooth-path";

/** WMO weather interpretation codes, grouped into the handful of states worth
 *  distinguishing at widget size. The full table has ~28 codes; naming the
 *  difference between "light drizzle" and "moderate drizzle" is detail nobody
 *  reads under a temperature. */
function labelFor(code: number): string {
  if (code === 0) return "Ясно";
  if (code <= 2) return "Мінлива хмарність";
  if (code === 3) return "Хмарно";
  if (code <= 48) return "Туман";
  if (code <= 57) return "Мряка";
  if (code <= 67) return "Дощ";
  if (code <= 77) return "Сніг";
  if (code <= 82) return "Злива";
  if (code <= 86) return "Снігопад";
  return "Гроза";
}

const W = 320;
const H = 44;
/** Hours printed under the curve. Every third one — a label per hour is
 *  unreadable at this width, and the shape carries the rest. */
const TICKS = [0, 3, 6, 9, 12, 15, 18, 21];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="card-raised rounded-card bg-surface p-4 text-center text-[11.5px] font-semibold text-text-faint">
      {children}
    </div>
  );
}

export function WeatherWidget() {
  const { data, status, label, locate, usingFallback } = useWeather(true);

  if (status === "error") return <Shell>Не вдалося отримати прогноз</Shell>;
  if (!data) return <Shell>Завантаження прогнозу…</Shell>;

  const day = data.day;
  // Two points is the minimum a curve can be drawn through; below that the
  // card still has a temperature worth showing, just no shape.
  const hasCurve = day.length >= 2;

  let path = "";
  let area = "";
  let marker: Point | null = null;

  if (hasCurve) {
    const temps = day.map((d) => d.temp);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    // A flat day would divide by zero and, worse, draw a line pinned to the
    // top of the box; a 1° floor keeps it sitting mid-height instead.
    const range = Math.max(1, max - min);
    const step = W / (day.length - 1);
    // 5px of headroom top and bottom so the stroke and the marker dot aren't
    // clipped by the viewBox at the day's extremes.
    const coords: Point[] = day.map((d, i) => ({
      x: i * step,
      y: H - 5 - ((d.temp - min) / range) * (H - 10),
    }));
    path = smoothPath(coords);
    area = smoothArea(coords, H);

    const nowIndex = day.findIndex((d) => d.hour === data.nowHour);
    marker = nowIndex >= 0 ? coords[nowIndex] : null;
  }

  return (
    <div className="card-raised rounded-card bg-surface px-4 pb-2.5 pt-3.5">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-[29px] font-medium leading-none tracking-[-0.055em] text-text">
            {data.current.temp}°
          </div>
          <div className="mt-1.5 text-[12.5px] font-semibold text-text-dim">{labelFor(data.current.code)}</div>
        </div>
        <div className="text-right">
          {/* Tapping the place name is the only thing that triggers a
              geolocation prompt — see useWeather.locate for why it's never
              automatic. */}
          <button onClick={locate} className="text-[12.5px] font-bold text-text">
            {label}
            {usingFallback && <span className="font-semibold text-text-faint"> · уточнити</span>}
          </button>
          <div className="mt-[3px] text-[11.5px] font-semibold text-text-faint">
            {data.today.max}° / {data.today.min}°
          </div>
        </div>
      </div>

      {hasCurve && (
        <>
          <div className="mt-2.5 h-[44px]">
            <svg
              width="100%"
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="block overflow-visible"
            >
              <defs>
                <linearGradient id="weatherFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#weatherFill)" />
              <path
                d={path}
                fill="none"
                stroke="var(--gold)"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {marker && (
                <>
                  <line
                    x1={marker.x}
                    y1={0}
                    x2={marker.x}
                    y2={H}
                    stroke="var(--text)"
                    strokeWidth={1}
                    strokeDasharray="2 3"
                    opacity={0.25}
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Drawn as a tiny ellipse, not a circle: the viewBox is
                      stretched horizontally by preserveAspectRatio="none", so
                      a circle would render as a squashed oval. */}
                  <ellipse
                    cx={marker.x}
                    cy={marker.y}
                    rx={W / 100}
                    ry={3.2}
                    fill="var(--surface)"
                    stroke="var(--text)"
                    strokeWidth={1.6}
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
            </svg>
          </div>

          <div className="mt-1.5 flex justify-between">
            {TICKS.map((h) => (
              <span
                key={h}
                className={h === data.nowHour ? "text-[10px] font-extrabold text-text" : "text-[10px] font-semibold text-text-faint"}
              >
                {String(h).padStart(2, "0")}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

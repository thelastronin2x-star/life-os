import { formatDateKey } from "@/lib/calendar-utils";

export const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/** Last `count` date keys ending today, oldest first — the shared basis for
 *  every widget's weekly bar chart. */
export function lastDays(count: number): string[] {
  const today = new Date();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    keys.push(formatDateKey(d));
  }
  return keys;
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} хв`;
  if (m === 0) return `${h} год`;
  return `${h} год ${m} хв`;
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 1250 -> "1.3", 2000 -> "2", 150 -> "0.2" — drops the decimal only when
 *  it's a whole number. Rounds in integer (0.1 л) space rather than via
 *  `.toFixed(1)` on the raw division: binary floats can't represent 0.15
 *  exactly, so `(150 / 1000).toFixed(1)` rounds down to "0.1" instead of
 *  "0.2". */
export function formatLiters(ml: number): string {
  const tenths = Math.round(ml / 100);
  const l = tenths / 10;
  return Number.isInteger(l) ? String(l) : l.toFixed(1);
}

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

export const CYCLE_PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: "Місячні",
  follicular: "Фолікулярна фаза",
  ovulation: "Овуляція",
  luteal: "Лютеїнова фаза",
};

export interface CycleStatus {
  day: number; // 1-indexed day within the current cycle
  phase: CyclePhase;
  nextPeriodInDays: number;
  progress: number; // 0..1 through the current cycle
}

/** Pure day-count model, not a hormonal simulation — good enough for a
 *  self-tracked estimate, and it's explicitly framed as a forecast on the
 *  dashboard, not a diagnosis. */
export function computeCycleStatus(
  periodStarts: string[],
  settings: { avgCycleLength: number; avgPeriodLength: number }
): CycleStatus | null {
  if (periodStarts.length === 0) return null;
  const last = periodStarts[periodStarts.length - 1];
  const daysSince = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  const cycleLen = settings.avgCycleLength;
  const day = (daysSince % cycleLen) + 1;
  const periodLen = settings.avgPeriodLength;
  const ovulationDay = cycleLen - 14;

  let phase: CyclePhase;
  if (day <= periodLen) phase = "menstrual";
  else if (day >= ovulationDay - 1 && day <= ovulationDay + 1) phase = "ovulation";
  else if (day < ovulationDay) phase = "follicular";
  else phase = "luteal";

  return {
    day,
    phase,
    nextPeriodInDays: cycleLen - day + 1,
    progress: day / cycleLen,
  };
}

import { formatDateKey } from "@/lib/calendar-utils";
import type { SleepSession, WaterEntry, WellbeingEntry, ActivityEntry } from "@/lib/health-store";

export const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/** Consecutive days ending today (or yesterday, if nothing's logged yet
 *  today — mid-day silence shouldn't zero out an otherwise-continuous
 *  streak) where the user logged something in ANY tracker. Real activity
 *  only — a date only counts if it actually has a matching entry, never
 *  inferred or assumed. */
export function computeHealthTrackingStreak(inputs: {
  sleepSessions: SleepSession[];
  waterEntries: WaterEntry[];
  wellbeingEntries: WellbeingEntry[];
  activityEntries: ActivityEntry[];
  habitLogs: Record<string, Record<string, number>>;
  medIntakes: Record<string, string[]>;
}): number {
  const tracked = new Set<string>();
  for (const s of inputs.sleepSessions) {
    tracked.add(s.sleepAt.slice(0, 10));
    if (s.wakeAt) tracked.add(s.wakeAt.slice(0, 10));
  }
  for (const e of inputs.waterEntries) tracked.add(e.date);
  for (const e of inputs.wellbeingEntries) tracked.add(e.date);
  for (const e of inputs.activityEntries) tracked.add(e.date);
  for (const [date, log] of Object.entries(inputs.habitLogs)) {
    if (Object.keys(log).length > 0) tracked.add(date);
  }
  for (const [date, ids] of Object.entries(inputs.medIntakes)) {
    if (ids.length > 0) tracked.add(date);
  }

  const cursor = new Date();
  if (!tracked.has(formatDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (tracked.has(formatDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** "A" / "A і B" / "A, B і C" — repeating " і " between every item (as a
 *  plain .join(" і ") would for 3+) reads wrong in Ukrainian; only the last
 *  pair takes "і", the rest take commas. */
function joinUk(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} і ${items[items.length - 1]}`;
}

interface DayStateSignal {
  nom: string; // nominative, for the positive side of the sentence — "Сон"
  gen: string; // genitive, for "не вистачає ..." — "сну"
  positive: boolean;
}

export interface DayState {
  pct: number;
  text: string;
}

/** "Стан дня" — a real completion score across whichever modules actually
 *  apply today, not a statistical inference (so no min-sample gate is
 *  needed the way AI Аналітика's correlations need one): sleep only
 *  counts once the user has ever logged a session at all, meds only if any
 *  are configured, water/wellbeing always apply (both have an always-on
 *  default). Not-yet-logged today counts as negative, same as the
 *  mockup's own "не вистачає води" phrasing implies — it's today's
 *  checklist, not a probability estimate. */
export function computeDayState(inputs: {
  sleepSessions: SleepSession[];
  waterEntries: WaterEntry[];
  waterGoalMl: number;
  wellbeingEntries: WellbeingEntry[];
  medications: { id: string }[];
  medIntakes: Record<string, string[]>;
}): DayState | null {
  const today = formatDateKey(new Date());
  const signals: DayStateSignal[] = [];

  if (inputs.sleepSessions.length > 0) {
    const lastCompleted = [...inputs.sleepSessions]
      .filter((s) => s.wakeAt)
      .sort((a, b) => new Date(b.wakeAt!).getTime() - new Date(a.wakeAt!).getTime())[0];
    signals.push({
      nom: "Сон",
      gen: "сну",
      positive: lastCompleted?.quality === "good" || lastCompleted?.quality === "great",
    });
  }

  const todayWaterMl = inputs.waterEntries.filter((e) => e.date === today).reduce((sum, e) => sum + e.ml, 0);
  signals.push({ nom: "Вода", gen: "води", positive: todayWaterMl >= inputs.waterGoalMl });

  const todayWellbeing = inputs.wellbeingEntries.find((e) => e.date === today);
  signals.push({
    nom: "Самопочуття",
    gen: "самопочуття",
    positive: todayWellbeing ? ["Добре", "Дуже добре", "Чудово"].includes(todayWellbeing.overallFeeling) : false,
  });

  if (inputs.medications.length > 0) {
    const done = inputs.medIntakes[today] ?? [];
    signals.push({ nom: "Ліки", gen: "прийому ліків", positive: done.length >= inputs.medications.length });
  }

  if (signals.length === 0) return null;

  const pct = Math.round((signals.filter((s) => s.positive).length / signals.length) * 100);
  const positive = signals.filter((s) => s.positive).map((s) => s.nom);
  const negative = signals.filter((s) => !s.positive).map((s) => s.gen);

  let text: string;
  if (negative.length === 0) text = "Усі показники дня в нормі — чудовий день";
  else if (positive.length === 0) text = `Поки що не вистачає: ${joinUk(negative)}`;
  else text = `${joinUk(positive)} добре — не вистачає лише ${joinUk(negative)}`;

  return { pct, text };
}

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

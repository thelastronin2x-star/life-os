import { lastDays, minutesBetween } from "@/lib/health-utils";
import { FEELING_LEVELS, type ActivityEntry, type Habit, type SleepSession, type WaterEntry, type WellbeingEntry } from "@/lib/health-store";

export interface HealthInsight {
  id: string;
  text: string;
  color: string; // CSS var reference, e.g. "var(--sky)"
  sources: string[];
}

interface HealthSnapshot {
  sleepSessions: SleepSession[];
  wellbeingEntries: WellbeingEntry[];
  waterEntries: WaterEntry[];
  activityEntries: ActivityEntry[];
  waterGoalMl: number;
  habits: Habit[];
  habitLogs: Record<string, Record<string, number>>;
}

// One entry per day already (unlike the old multi-per-day MoodEntry), so no
// averaging needed — just map the anchored level to its 1-5 rank.
function feelingByDay(entries: WellbeingEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.date, FEELING_LEVELS.indexOf(e.overallFeeling) + 1);
  return map;
}

function sleepMinutesByDay(sessions: SleepSession[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    if (!s.wakeAt) continue;
    // Attributed to the wake day — that's the day the sleep amount actually affected.
    const day = s.wakeAt.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + minutesBetween(s.sleepAt, s.wakeAt));
  }
  return map;
}

function waterMlByDay(entries: WaterEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + e.ml);
  return map;
}

function isWeekend(dateKey: string): boolean {
  const dow = new Date(`${dateKey}T12:00:00`).getDay();
  return dow === 0 || dow === 6;
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** "У X% днів з низьким <factorLabel> <metricLabel> був нижчим за середній"
 *  — a plain mean-split correlation, not a model. Needs at least 3 days that
 *  have both a factor reading and a metric reading, and a clear-enough
 *  majority (>=60%), or it stays silent rather than force a weak claim. */
function lowFactorCorrelation(
  factorByDay: Map<string, number>,
  factorThreshold: number,
  metricByDay: Map<string, number>
): { percent: number; count: number } | null {
  const metricValues = [...metricByDay.values()];
  if (metricValues.length < 3) return null;
  const metricAvg = metricValues.reduce((a, b) => a + b, 0) / metricValues.length;

  let total = 0;
  let lower = 0;
  for (const [day, factorValue] of factorByDay) {
    if (factorValue >= factorThreshold) continue;
    const metric = metricByDay.get(day);
    if (metric === undefined) continue;
    total++;
    if (metric < metricAvg) lower++;
  }
  if (total < 3) return null;
  const percent = Math.round((lower / total) * 100);
  if (percent < 60) return null;
  return { percent, count: total };
}

export function computeHealthInsights(state: HealthSnapshot): HealthInsight[] {
  const days = new Set(lastDays(21));
  const feeling = feelingByDay(state.wellbeingEntries.filter((e) => days.has(e.date)));
  const sleep = sleepMinutesByDay(state.sleepSessions.filter((s) => s.wakeAt && days.has(s.wakeAt.slice(0, 10))));
  const water = waterMlByDay(state.waterEntries.filter((e) => days.has(e.date)));

  const insights: HealthInsight[] = [];

  // --- Кава ↔ сон: коротший сон у ночі, що почались у день з кавою ---
  // habitLogs has no time-of-day per entry, only a daily count, so "вечірній
  // кофеїн" from the prompt narrows to "будь-яка кава того дня" — the
  // closest honest signal this data actually supports. Attributed to the
  // day the sleep session STARTED (sleepAt), not woke up on
  // (sleepMinutesByDay's own convention) — that's the night the coffee
  // earlier that day would actually have affected.
  const caffeineHabit = state.habits.find((h) => h.name.toLowerCase().includes("кав"));
  if (caffeineHabit) {
    const sleepByStartDay = new Map<string, number>();
    for (const s of state.sleepSessions) {
      if (!s.wakeAt) continue;
      const day = s.sleepAt.slice(0, 10);
      if (!days.has(day)) continue;
      sleepByStartDay.set(day, minutesBetween(s.sleepAt, s.wakeAt));
    }
    const withCaffeine: number[] = [];
    const withoutCaffeine: number[] = [];
    for (const [day, minutes] of sleepByStartDay) {
      const hadCaffeine = (state.habitLogs[day]?.[caffeineHabit.id] ?? 0) > 0;
      (hadCaffeine ? withCaffeine : withoutCaffeine).push(minutes);
    }
    if (withCaffeine.length >= 3 && withoutCaffeine.length >= 3) {
      const avgWith = average(withCaffeine);
      const avgWithout = average(withoutCaffeine);
      const diffMinutes = avgWithout - avgWith;
      if (diffMinutes >= 20) {
        const pct = Math.round((withCaffeine.filter((m) => m < avgWithout).length / withCaffeine.length) * 100);
        insights.push({
          id: "caffeine-sleep",
          text: `Сон коротший на ${Math.round(diffMinutes)}+ хв у дні з «${caffeineHabit.name}» — так було ${pct}% таких днів.`,
          color: "var(--sky)",
          sources: ["Сон", "Звички"],
        });
      }
    }
  }

  // --- Самопочуття ↔ фізичні симптоми (відмічені зони тіла) ---
  const withZones = state.wellbeingEntries.filter((w) => days.has(w.date) && w.bodyZones.length > 0);
  const withoutZones = state.wellbeingEntries.filter((w) => days.has(w.date) && w.bodyZones.length === 0);
  if (withZones.length >= 3 && withoutZones.length >= 3) {
    const feelingScore = (w: WellbeingEntry) => FEELING_LEVELS.indexOf(w.overallFeeling) + 1;
    const avgWith = average(withZones.map(feelingScore));
    const avgWithout = average(withoutZones.map(feelingScore));
    if (avgWithout - avgWith >= 0.7) {
      insights.push({
        id: "symptoms-wellbeing",
        text: "Загальне відчуття помітно гірше в дні з фізичними симптомами.",
        color: "var(--clay)",
        sources: ["Самопочуття"],
      });
    }
  }

  // --- Вода ↔ вихідні ---
  const weekendPcts = [...water.entries()].filter(([d]) => isWeekend(d)).map(([, ml]) => ml / state.waterGoalMl);
  // A weekday minimum too, not just the prompt's weekend-only >= 2 — a
  // weekday average from a single sample would make the comparison as
  // noisy as the thresholds elsewhere are meant to prevent.
  const weekdayPcts = [...water.entries()].filter(([d]) => !isWeekend(d)).map(([, ml]) => ml / state.waterGoalMl);
  if (weekendPcts.length >= 2 && weekdayPcts.length >= 2) {
    const weekendAvg = average(weekendPcts);
    const weekdayAvg = average(weekdayPcts);
    if (weekdayAvg - weekendAvg >= 0.15) {
      insights.push({
        id: "water-weekend",
        text: `У вихідні ти зазвичай п'єш менше води, ніж у будні — в середньому на ${Math.round((weekdayAvg - weekendAvg) * 100)}% менше від цілі.`,
        color: "var(--gold)",
        sources: ["Вода"],
      });
    }
  }

  const sleepFeeling = lowFactorCorrelation(sleep, 7 * 60, feeling);
  if (sleepFeeling) {
    insights.push({
      id: "sleep-wellbeing",
      text: `У ${sleepFeeling.percent}% днів з менш ніж 7 год сну самопочуття було нижчим за середнє`,
      color: "var(--sky)",
      sources: ["Сон", "Самопочуття"],
    });
  }

  const waterFeeling = lowFactorCorrelation(water, state.waterGoalMl * 0.6, feeling);
  if (waterFeeling) {
    insights.push({
      id: "water-wellbeing",
      text: `У ${waterFeeling.percent}% днів з водою менше 60% від цілі самопочуття було нижчим за середнє`,
      color: "var(--gold)",
      sources: ["Вода", "Самопочуття"],
    });
  }

  const activityMinutesByDay = new Map<string, number>();
  for (const a of state.activityEntries) {
    if (!days.has(a.date)) continue;
    activityMinutesByDay.set(a.date, (activityMinutesByDay.get(a.date) ?? 0) + a.minutes);
  }
  const activeDays = [...activityMinutesByDay.keys()];
  const restDays = [...feeling.keys()].filter((d) => !activityMinutesByDay.has(d));
  if (activeDays.length >= 3 && restDays.length >= 3) {
    const avgFeelingActive =
      activeDays.reduce((sum, d) => sum + (feeling.get(d) ?? 0), 0) / activeDays.filter((d) => feeling.has(d)).length ||
      0;
    const avgFeelingRest = restDays.reduce((sum, d) => sum + (feeling.get(d) ?? 0), 0) / restDays.length;
    if (avgFeelingActive > avgFeelingRest + 0.3) {
      insights.push({
        id: "activity-wellbeing",
        text: `У дні з активністю самопочуття в середньому краще, ніж у дні без неї`,
        color: "var(--sage)",
        sources: ["Активність", "Самопочуття"],
      });
    }
  }

  return insights.slice(0, 3);
}

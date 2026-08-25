"use client";

import { useHealthStore, BODY_ZONES } from "./health-store";
import { computeCycleStatus, CYCLE_PHASE_LABEL, formatDuration, minutesBetween } from "./health-utils";
import { formatDateKey } from "./calendar-utils";

/** Health's own context builder, in its own file — see
 *  assistant-context-calendar.ts for why the split matters. */

/** Today's snapshot across every Здоров'я tracker — exported (not just used
 *  by buildHealthContext) because assistant-context-global.ts also folds it
 *  into Home's aggregated context, without needing the "Контекст: вкладка"
 *  prefix that's specific to the Health mini-assistant's own system prompt. */
export function buildHealthSummary(): string {
  const health = useHealthStore.getState();
  const today = formatDateKey(new Date());

  const activeSleep = health.sleepSessions.find((s) => s.wakeAt === null);
  const lastSleep = [...health.sleepSessions]
    .filter((s) => s.wakeAt)
    .sort((a, b) => new Date(b.wakeAt!).getTime() - new Date(a.wakeAt!).getTime())[0];
  const sleepLine = activeSleep
    ? "Зараз триває сон (ще не прокинувся)."
    : lastSleep && lastSleep.wakeAt
      ? `Останній сон: ${formatDuration(minutesBetween(lastSleep.sleepAt, lastSleep.wakeAt))}${lastSleep.quality ? `, якість: ${lastSleep.quality}` : ""}.`
      : "Даних про сон ще немає.";

  const todayWaterMl = health.waterEntries.filter((e) => e.date === today).reduce((sum, e) => sum + e.ml, 0);

  const todayWellbeing = health.wellbeingEntries.find((e) => e.date === today);

  const todayActivityMinutes = health.activityEntries
    .filter((e) => e.date === today)
    .reduce((sum, e) => sum + e.minutes, 0);

  const cycle = computeCycleStatus(health.periodStarts, health.cycleSettings);

  return [
    sleepLine,
    `Вода сьогодні: ${todayWaterMl} / ${health.waterGoalMl} мл.`,
    todayWellbeing
      ? `Самопочуття сьогодні: ${todayWellbeing.overallFeeling}${
          todayWellbeing.bodyZones.length > 0
            ? ` (зони: ${todayWellbeing.bodyZones.map((id) => BODY_ZONES.find((z) => z.id === id)?.label ?? id).join(", ")})`
            : ""
        }.`
      : "Самопочуття сьогодні ще не відмічено.",
    todayActivityMinutes > 0 ? `Активність сьогодні: ${todayActivityMinutes} хв.` : "Активності сьогодні не було.",
    cycle ? `Цикл: день ${cycle.day}, ${CYCLE_PHASE_LABEL[cycle.phase]}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildHealthContext(): string {
  return `Контекст: вкладка "Здоров'я". ${buildHealthSummary()}`;
}

/** Pure — takes the health state as a param (typically a *reactive* whole-
 *  store subscription, `useHealthStore()`) instead of reading `.getState()`
 *  itself, so this recomputes on every render the data actually changes.
 *  See use-health-insight-sync.ts. */
export function computeHealthSignature(health: ReturnType<typeof useHealthStore.getState>): string {
  const today = formatDateKey(new Date());
  const activeSleep = health.sleepSessions.some((s) => s.wakeAt === null);
  const todayWaterMl = health.waterEntries.filter((e) => e.date === today).reduce((sum, e) => sum + e.ml, 0);
  // Upserted, not appended (see setOverallFeeling/toggleBodyZone) — a
  // length check alone wouldn't catch someone re-dragging the slider or
  // toggling a zone later the same day, so the signature needs the actual
  // content, not just whether an entry exists yet.
  const todayWellbeing = health.wellbeingEntries.find((e) => e.date === today);
  const wellbeingSig = todayWellbeing ? `${todayWellbeing.overallFeeling}|${todayWellbeing.bodyZones.length}` : "none";
  return [today, activeSleep, todayWaterMl, wellbeingSig, health.activityEntries.length, health.habits.length].join(
    "|"
  );
}

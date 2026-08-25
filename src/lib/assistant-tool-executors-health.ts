"use client";

import { useHealthStore, FEELING_LEVELS, BODY_ZONES, type FeelingLevel } from "@/lib/health-store";
import { formatDateKey } from "@/lib/calendar-utils";

function todayKey(): string {
  return formatDateKey(new Date());
}

/** Own file, not shared with the calendar/work executors — see the comment
 *  in assistant-tool-executors-calendar.ts for why the split matters. */
export function executeHealthTool(name: string, input: Record<string, unknown>): string {
  const store = useHealthStore.getState();

  if (name === "add_water") {
    const ml = Number(input.ml);
    if (!Number.isFinite(ml) || ml <= 0) return "Некоректна кількість води — нічого не додано.";
    store.addWater(ml);
    const total = useHealthStore
      .getState()
      .waterEntries.filter((e) => e.date === todayKey())
      .reduce((sum, e) => sum + e.ml, 0);
    return `Додано ${ml} мл води. Сьогодні: ${total} / ${store.waterGoalMl} мл.`;
  }

  if (name === "log_wellbeing") {
    const feeling = String(input.feeling ?? "");
    if (!FEELING_LEVELS.includes(feeling as FeelingLevel)) return "Некоректний рівень самопочуття — нічого не записано.";
    store.setOverallFeeling(feeling as FeelingLevel, input.note ? String(input.note) : undefined);
    return `Записав самопочуття: ${feeling}.`;
  }

  if (name === "toggle_body_zone") {
    const zoneInput = String(input.zone ?? "")
      .trim()
      .toLowerCase();
    const zone = BODY_ZONES.find((z) => z.label.toLowerCase() === zoneInput || z.id === zoneInput);
    if (!zone) return `Невідома зона тіла "${input.zone}".`;
    store.toggleBodyZone(zone.id);
    return `Оновив зону "${zone.label}" на сьогодні.`;
  }

  if (name === "log_activity") {
    const type = String(input.type ?? "").trim();
    const minutes = Number(input.minutes);
    if (!type || !Number.isFinite(minutes) || minutes <= 0) return "Не вистачає типу або тривалості активності.";
    store.addActivity(type, minutes);
    return `Записав активність: ${type}, ${minutes} хв.`;
  }

  if (name === "increment_habit") {
    const habitName = String(input.habitName ?? "").trim();
    if (!habitName) return "Не вказано звичку.";
    const existing = store.habits.find((h) => h.name.toLowerCase() === habitName.toLowerCase());
    if (existing) {
      // build habits are a binary done/not-done toggle, not a counter —
      // "increment" only makes literal sense for a limit habit.
      if (existing.kind === "build") {
        store.toggleHabitDone(todayKey(), existing.id);
        return `Позначив "${existing.name}" виконаною сьогодні.`;
      }
      store.incrementHabit(todayKey(), existing.id);
      return `+1 до "${existing.name}" сьогодні.`;
    }
    // No existing habit to match — "increment" implies a limit-style
    // counter, so a freshly-created one is a limit habit, not a streak.
    store.addLimitHabit(habitName, 999, "daily");
    const created = useHealthStore.getState().habits.find((h) => h.name === habitName);
    if (created) store.incrementHabit(todayKey(), created.id);
    return `Додав нову звичку "${habitName}" і зарахував +1.`;
  }

  if (name === "toggle_medication_done") {
    const medName = String(input.medName ?? "").trim();
    const med = store.medications.find((m) => m.name.toLowerCase() === medName.toLowerCase());
    if (!med) return `Ліків "${medName}" немає в списку — спочатку додай їх на вкладці Здоров'я.`;
    store.toggleMedDone(todayKey(), med.id);
    return `Оновив прийом "${med.name}" на сьогодні.`;
  }

  if (name === "start_sleep") {
    store.startSleep();
    return "Почав відлік сну.";
  }

  if (name === "end_sleep") {
    store.endSleep();
    return "Завершив сон.";
  }

  return `Невідомий інструмент: ${name}.`;
}

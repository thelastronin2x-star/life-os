"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { formatDateKey } from "@/lib/calendar-utils";

// 5 anchored categories, not a raw 0-100 number — someone can't reliably
// tell "67%" sleep from "71%", and a bare percentage gives an illusion of
// precision that isn't real. Stable categories also matter for the AI
// insight correlations (health-insights.ts): a noisy continuous value
// would make "sleep is worse after coffee"-style comparisons noisier too.
// The 3 original keys stay valid members of this union on purpose — no
// migration needed for already-persisted sessions.
export type QualityLevel = "very_bad" | "bad" | "ok" | "good" | "great";
export type IntensityLevel = "light" | "moderate" | "strong";

export interface SleepSession {
  id: string;
  sleepAt: string; // ISO datetime
  wakeAt: string | null; // null while the session is active
  quality: QualityLevel | null;
  factors: string[];
}

export interface WaterEntry {
  id: string;
  date: string; // YYYY-MM-DD
  ml: number;
  at: string; // HH:MM
}

// Anchored levels, same rationale as sleep QualityLevel above — a stable,
// nameable scale instead of a raw number, so AI correlations compare like
// with like. Also doubles as the value type for WellbeingEntry directly
// (unlike QualityLevel, there's no separate storage-key/display-label
// split here — the Ukrainian label IS the stored value).
export const FEELING_LEVELS = ["Погано", "Так собі", "Добре", "Дуже добре", "Чудово"] as const;
export type FeelingLevel = (typeof FEELING_LEVELS)[number];

export const BODY_ZONES: { id: string; label: string }[] = [
  { id: "head", label: "Голова" },
  { id: "throat", label: "Горло / шия" },
  { id: "chest", label: "Груди" },
  { id: "stomach", label: "Живіт" },
  { id: "back_arms", label: "Спина / руки" },
  { id: "legs", label: "Ноги" },
];

// One record per day, same shape as Сон/Вода — overall feeling and the body
// zones flagged that day live together rather than as separate Настрій vs
// Симптоми entries, since the merged Самопочуття widget treats them as one
// observation, not two.
export interface WellbeingEntry {
  id: string;
  date: string;
  overallFeeling: FeelingLevel;
  bodyZones: string[]; // ids from BODY_ZONES
  note: string;
}

export interface SymptomEntry {
  id: string;
  date: string;
  time: string;
  tags: string[];
  intensity: IntensityLevel;
  note: string;
}

export interface Medication {
  id: string;
  name: string;
  time: string; // HH:MM
  dose?: string; // free text, e.g. "2000 МО", "400 мг" — optional, shown under the name when present
}

export interface ActivityEntry {
  id: string;
  date: string;
  type: string;
  minutes: number;
  /** Absent/"manual" for entries logged by hand on this widget; "calendar"
   *  for ones synced from an isWorkout Calendar event (see
   *  use-workout-activity-sync.ts) — lets the UI distinguish the two later
   *  without a separate list. */
  source?: "manual" | "calendar";
  /** Only set on "calendar"-sourced entries — the originating CalendarItem's
   *  id, scoped together with `date` as the upsert key so re-syncing (or a
   *  recurring workout's next occurrence) updates/creates the right entry
   *  instead of appending a duplicate. */
  calendarEventId?: string;
}

// "build" (streak-driven) and "limit" (capped counter) are functionally
// different, not just differently labeled — see BuildHabitCard/
// LimitHabitCard and the two separate add-flows in health/habits/page.tsx.
export type HabitKind = "build" | "limit";

export interface Habit {
  id: string;
  name: string;
  kind: HabitKind;
  /** build only: "daily", or a weekly target count (e.g. 3 for "3x на
   *  тиждень"). */
  targetFrequency?: "daily" | number;
  /** limit only: exactly one of dailyCap/weeklyCap is set, never both. */
  dailyCap?: number;
  weeklyCap?: number;
}

export interface CycleSettings {
  avgCycleLength: number;
  avgPeriodLength: number;
}

export const DEFAULT_SYMPTOM_TAGS = [
  "Головний біль",
  "Втома",
  "Нежить",
  "Біль у горлі",
  "Нудота",
  "Біль у спині",
  "Запаморочення",
  "Безсоння",
];

export const DEFAULT_SLEEP_FACTORS = ["Прокидався вночі", "Пізня вечеря", "Екран перед сном", "Стрес"];
export const DEFAULT_ACTIVITY_TYPES = ["Біг", "Хода", "Зал"];

interface HealthState {
  // Сон
  sleepSessions: SleepSession[];
  startSleep: () => void;
  endSleep: (wakeAtIso?: string) => void;
  setSleepQuality: (id: string, quality: QualityLevel) => void;
  toggleSleepFactor: (id: string, factor: string) => void;
  discardActiveSleep: () => void;
  /** "HH:MM", or null when that reminder is off. Both this and
   *  targetWakeTime, plus the live sleepState/sessionStartedAt below, are
   *  synced to the server as one snapshot (see syncSleepSchedule) — the cron
   *  in /api/push/send-reminders needs all four together to decide whether
   *  either reminder is even due, since it runs with no access to this
   *  store's localStorage. */
  targetBedtime: string | null;
  setTargetBedtime: (time: string | null) => void;
  targetWakeTime: string | null;
  setTargetWakeTime: (time: string | null) => void;

  // Вода
  waterGoalMl: number;
  waterEntries: WaterEntry[];
  setWaterGoal: (ml: number) => void;
  addWater: (ml: number) => void;
  /** Reminder settings — synced to the server as a full snapshot alongside
   *  today's live intake/goal (see syncWaterSchedule) on every action that
   *  touches any of them, same reasoning as targetBedtime/targetWakeTime
   *  above: the cron has no access to this store's localStorage. */
  waterRemindersPerDay: number;
  waterActiveStart: string; // "HH:MM"
  waterActiveEnd: string; // "HH:MM"
  setWaterRemindersPerDay: (n: number) => void;
  setWaterActiveHours: (start: string, end: string) => void;

  // Самопочуття (Настрій + Симптоми, обʼєднані)
  wellbeingEntries: WellbeingEntry[];
  setOverallFeeling: (feeling: FeelingLevel, note?: string) => void;
  toggleBodyZone: (zoneId: string) => void;
  setWellbeingNote: (note: string) => void;

  // Симптоми циклу — окрема, вільна система тегів, якою й далі користується
  // лише екран Циклу (див. health/cycle/page.tsx); Самопочуття свідомо на
  // ній більше не будується, бо довільні теги не мапляться на зони тіла.
  symptomEntries: SymptomEntry[];
  customSymptomTags: string[];
  toggleTodaySymptom: (tag: string) => void;
  setSymptomIntensity: (date: string, intensity: IntensityLevel) => void;
  setSymptomNote: (date: string, note: string) => void;
  addCustomSymptomTag: (name: string) => void;

  // Ліки
  medications: Medication[];
  medIntakes: Record<string, string[]>; // date -> medication ids marked done
  addMedication: (name: string, time: string, addReminder: boolean, dose?: string) => void;
  removeMedication: (id: string) => void;
  toggleMedDone: (date: string, medId: string) => void;

  // Активність
  activityEntries: ActivityEntry[];
  customActivityTypes: string[];
  addActivity: (type: string, minutes: number) => void;
  addCustomActivityType: (name: string) => void;
  /** Insert-or-update by (calendarEventId, date) — the sync entry point for
   *  isWorkout Calendar events, both the automatic "event ended" path and
   *  the manual "mark done" toggle. */
  upsertCalendarActivity: (entry: { calendarEventId: string; date: string; type: string; minutes: number }) => void;
  /** Undoes upsertCalendarActivity for one occurrence — backs the manual
   *  toggle's "un-mark done" direction. */
  removeCalendarActivity: (calendarEventId: string, date: string) => void;

  // Звички
  habits: Habit[];
  /** date -> habitId -> count. Shared by both kinds rather than a separate
   *  HabitEntry{done,count} shape — for "build" habits, done is exactly
   *  `count >= 1` (see habit-utils.ts), so one number already covers both
   *  without a redundant parallel field. */
  habitLogs: Record<string, Record<string, number>>;
  addBuildHabit: (name: string, targetFrequency: "daily" | number) => void;
  addLimitHabit: (name: string, cap: number, capPeriod: "daily" | "weekly") => void;
  removeHabit: (id: string) => void;
  /** build only — binary toggle (0/1), not an increment. */
  toggleHabitDone: (date: string, habitId: string) => void;
  /** limit only — the +/− stepper. */
  incrementHabit: (date: string, habitId: string) => void;
  decrementHabit: (date: string, habitId: string) => void;

  // Цикл
  cycleSettings: CycleSettings;
  periodStarts: string[];
  setCycleSettings: (settings: CycleSettings) => void;
  markPeriodStart: (date?: string) => void;
}

function todayKey(): string {
  return formatDateKey(new Date());
}

// Shape of a pre-merge (v0) persisted MoodEntry — kept only for the migrate
// function below, which reads directly from raw localStorage JSON rather
// than the current (Mood-free) HealthState.
interface LegacyMoodEntry {
  date: string;
  time: string;
  score: 1 | 2 | 3 | 4 | 5;
  note: string;
}

/** Medication reminders reuse the same daily-recurring-event mechanism
 *  Calendar already has, rather than a parallel notification system. Fired
 *  as a dynamic import so the health store doesn't pull in the calendar
 *  store (and its own persisted slice) for people who never add a med. */
function addMedicationReminder(medicationId: string, name: string, time: string) {
  import("@/lib/calendar-store").then(({ useCalendarStore }) => {
    useCalendarStore.getState().addItem({
      date: todayKey(),
      kind: "event",
      title: `Прийом: ${name}`,
      time,
      category: "personal",
      reminder: "10min",
      recurrence: { type: "daily", daysOfWeek: [], endCondition: { type: "never" }, excludedDates: [] },
      medicationId,
    });
  });
}

/** Fire-and-forget, same shape as addMedicationReminder above — the server
 *  only needs to know the current snapshot, not track history, so a plain
 *  upsert POST is enough. Always the full 4-field snapshot (not a partial
 *  update) since the cron in /api/push/send-reminders needs bedtime,
 *  wake-time, and the live sleep state together to decide whether either
 *  reminder is actually due — sending only the field that just changed
 *  would leave the other three stale server-side. */
function syncSleepSchedule(schedule: {
  targetBedtime: string | null;
  targetWakeTime: string | null;
  sleepState: "idle" | "sleeping";
  sessionStartedAt: string | null;
}) {
  fetch("/api/health/sleep-schedule/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(schedule),
  }).catch(() => undefined);
}

function computeTodayWaterMl(entries: WaterEntry[]): number {
  const today = todayKey();
  return entries.filter((e) => e.date === today).reduce((sum, e) => sum + e.ml, 0);
}

/** Same "always the full snapshot" reasoning as syncSleepSchedule — the
 *  cron needs reminder settings AND today's live intake/goal together to
 *  decide anything, so every action that touches any one of those five
 *  fields resyncs all five. */
function syncWaterSchedule(schedule: {
  remindersPerDay: number;
  activeStart: string;
  activeEnd: string;
  todayAmountMl: number;
  todayGoalMl: number;
}) {
  fetch("/api/health/water-schedule/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...schedule, todayDate: todayKey() }),
  }).catch(() => undefined);
}

export const useHealthStore = create<HealthState>()(
  persist(
    (set) => ({
      sleepSessions: [],
      startSleep: () =>
        set((s) => {
          if (s.sleepSessions.some((sess) => sess.wakeAt === null)) return s;
          const sleepAt = new Date().toISOString();
          syncSleepSchedule({
            targetBedtime: s.targetBedtime,
            targetWakeTime: s.targetWakeTime,
            sleepState: "sleeping",
            sessionStartedAt: sleepAt,
          });
          return {
            sleepSessions: [
              ...s.sleepSessions,
              { id: crypto.randomUUID(), sleepAt, wakeAt: null, quality: null, factors: [] },
            ],
          };
        }),
      endSleep: (wakeAtIso) =>
        set((s) => {
          if (s.sleepSessions.some((sess) => sess.wakeAt === null)) {
            syncSleepSchedule({
              targetBedtime: s.targetBedtime,
              targetWakeTime: s.targetWakeTime,
              sleepState: "idle",
              sessionStartedAt: null,
            });
          }
          return {
            sleepSessions: s.sleepSessions.map((sess) =>
              sess.wakeAt === null ? { ...sess, wakeAt: wakeAtIso ?? new Date().toISOString() } : sess
            ),
          };
        }),
      setSleepQuality: (id, quality) =>
        set((s) => ({
          sleepSessions: s.sleepSessions.map((sess) => (sess.id === id ? { ...sess, quality } : sess)),
        })),
      toggleSleepFactor: (id, factor) =>
        set((s) => ({
          sleepSessions: s.sleepSessions.map((sess) =>
            sess.id === id
              ? {
                  ...sess,
                  factors: sess.factors.includes(factor)
                    ? sess.factors.filter((f) => f !== factor)
                    : [...sess.factors, factor],
                }
              : sess
          ),
        })),
      discardActiveSleep: () =>
        set((s) => ({ sleepSessions: s.sleepSessions.filter((sess) => sess.wakeAt !== null) })),

      targetBedtime: null,
      setTargetBedtime: (time) =>
        set((s) => {
          const active = s.sleepSessions.find((sess) => sess.wakeAt === null);
          syncSleepSchedule({
            targetBedtime: time,
            targetWakeTime: s.targetWakeTime,
            sleepState: active ? "sleeping" : "idle",
            sessionStartedAt: active?.sleepAt ?? null,
          });
          return { targetBedtime: time };
        }),
      targetWakeTime: null,
      setTargetWakeTime: (time) =>
        set((s) => {
          const active = s.sleepSessions.find((sess) => sess.wakeAt === null);
          syncSleepSchedule({
            targetBedtime: s.targetBedtime,
            targetWakeTime: time,
            sleepState: active ? "sleeping" : "idle",
            sessionStartedAt: active?.sleepAt ?? null,
          });
          return { targetWakeTime: time };
        }),

      waterGoalMl: 2000,
      waterEntries: [],
      waterRemindersPerDay: 5,
      waterActiveStart: "09:00",
      waterActiveEnd: "22:00",
      setWaterGoal: (ml) =>
        set((s) => {
          syncWaterSchedule({
            remindersPerDay: s.waterRemindersPerDay,
            activeStart: s.waterActiveStart,
            activeEnd: s.waterActiveEnd,
            todayAmountMl: computeTodayWaterMl(s.waterEntries),
            todayGoalMl: ml,
          });
          return { waterGoalMl: ml };
        }),
      addWater: (ml) =>
        set((s) => {
          const waterEntries = [
            ...s.waterEntries,
            { id: crypto.randomUUID(), date: todayKey(), ml, at: new Date().toTimeString().slice(0, 5) },
          ];
          syncWaterSchedule({
            remindersPerDay: s.waterRemindersPerDay,
            activeStart: s.waterActiveStart,
            activeEnd: s.waterActiveEnd,
            todayAmountMl: computeTodayWaterMl(waterEntries),
            todayGoalMl: s.waterGoalMl,
          });
          return { waterEntries };
        }),
      setWaterRemindersPerDay: (n) =>
        set((s) => {
          syncWaterSchedule({
            remindersPerDay: n,
            activeStart: s.waterActiveStart,
            activeEnd: s.waterActiveEnd,
            todayAmountMl: computeTodayWaterMl(s.waterEntries),
            todayGoalMl: s.waterGoalMl,
          });
          return { waterRemindersPerDay: n };
        }),
      setWaterActiveHours: (start, end) =>
        set((s) => {
          syncWaterSchedule({
            remindersPerDay: s.waterRemindersPerDay,
            activeStart: start,
            activeEnd: end,
            todayAmountMl: computeTodayWaterMl(s.waterEntries),
            todayGoalMl: s.waterGoalMl,
          });
          return { waterActiveStart: start, waterActiveEnd: end };
        }),

      wellbeingEntries: [],
      setOverallFeeling: (feeling, note) =>
        set((s) => {
          const date = todayKey();
          const existing = s.wellbeingEntries.find((e) => e.date === date);
          if (!existing) {
            return {
              wellbeingEntries: [
                ...s.wellbeingEntries,
                { id: crypto.randomUUID(), date, overallFeeling: feeling, bodyZones: [], note: note ?? "" },
              ],
            };
          }
          return {
            wellbeingEntries: s.wellbeingEntries.map((e) =>
              e.id === existing.id ? { ...e, overallFeeling: feeling, note: note ?? e.note } : e
            ),
          };
        }),
      toggleBodyZone: (zoneId) =>
        set((s) => {
          const date = todayKey();
          const existing = s.wellbeingEntries.find((e) => e.date === date);
          if (!existing) {
            return {
              wellbeingEntries: [
                ...s.wellbeingEntries,
                { id: crypto.randomUUID(), date, overallFeeling: FEELING_LEVELS[2], bodyZones: [zoneId], note: "" },
              ],
            };
          }
          const bodyZones = existing.bodyZones.includes(zoneId)
            ? existing.bodyZones.filter((z) => z !== zoneId)
            : [...existing.bodyZones, zoneId];
          return { wellbeingEntries: s.wellbeingEntries.map((e) => (e.id === existing.id ? { ...e, bodyZones } : e)) };
        }),
      setWellbeingNote: (note) =>
        set((s) => {
          const date = todayKey();
          const existing = s.wellbeingEntries.find((e) => e.date === date);
          if (!existing) {
            return {
              wellbeingEntries: [
                ...s.wellbeingEntries,
                { id: crypto.randomUUID(), date, overallFeeling: FEELING_LEVELS[2], bodyZones: [], note },
              ],
            };
          }
          return { wellbeingEntries: s.wellbeingEntries.map((e) => (e.id === existing.id ? { ...e, note } : e)) };
        }),

      symptomEntries: [],
      customSymptomTags: [],
      toggleTodaySymptom: (tag) =>
        set((s) => {
          const date = todayKey();
          const existing = s.symptomEntries.find((e) => e.date === date);
          if (!existing) {
            return {
              symptomEntries: [
                ...s.symptomEntries,
                { id: crypto.randomUUID(), date, time: new Date().toTimeString().slice(0, 5), tags: [tag], intensity: "moderate", note: "" },
              ],
            };
          }
          const tags = existing.tags.includes(tag) ? existing.tags.filter((t) => t !== tag) : [...existing.tags, tag];
          return { symptomEntries: s.symptomEntries.map((e) => (e.id === existing.id ? { ...e, tags } : e)) };
        }),
      setSymptomIntensity: (date, intensity) =>
        set((s) => ({ symptomEntries: s.symptomEntries.map((e) => (e.date === date ? { ...e, intensity } : e)) })),
      setSymptomNote: (date, note) =>
        set((s) => ({ symptomEntries: s.symptomEntries.map((e) => (e.date === date ? { ...e, note } : e)) })),
      addCustomSymptomTag: (name) =>
        set((s) => (s.customSymptomTags.includes(name) ? s : { customSymptomTags: [...s.customSymptomTags, name] })),

      medications: [],
      medIntakes: {},
      addMedication: (name, time, addReminder, dose) => {
        const id = crypto.randomUUID();
        if (addReminder) addMedicationReminder(id, name, time);
        set((s) => ({ medications: [...s.medications, { id, name, time, dose: dose || undefined }] }));
      },
      removeMedication: (id) => set((s) => ({ medications: s.medications.filter((m) => m.id !== id) })),
      toggleMedDone: (date, medId) =>
        set((s) => {
          const current = s.medIntakes[date] ?? [];
          const next = current.includes(medId) ? current.filter((id) => id !== medId) : [...current, medId];
          return { medIntakes: { ...s.medIntakes, [date]: next } };
        }),

      activityEntries: [],
      customActivityTypes: [],
      addActivity: (type, minutes) =>
        set((s) => ({
          activityEntries: [
            ...s.activityEntries,
            { id: crypto.randomUUID(), date: todayKey(), type, minutes, source: "manual" },
          ],
        })),
      addCustomActivityType: (name) =>
        set((s) => (s.customActivityTypes.includes(name) ? s : { customActivityTypes: [...s.customActivityTypes, name] })),
      upsertCalendarActivity: ({ calendarEventId, date, type, minutes }) =>
        set((s) => {
          const existing = s.activityEntries.find(
            (a) => a.calendarEventId === calendarEventId && a.date === date
          );
          if (existing) {
            return {
              activityEntries: s.activityEntries.map((a) => (a.id === existing.id ? { ...a, type, minutes } : a)),
            };
          }
          return {
            activityEntries: [
              ...s.activityEntries,
              { id: crypto.randomUUID(), date, type, minutes, source: "calendar", calendarEventId },
            ],
          };
        }),
      removeCalendarActivity: (calendarEventId, date) =>
        set((s) => ({
          activityEntries: s.activityEntries.filter((a) => !(a.calendarEventId === calendarEventId && a.date === date)),
        })),

      habits: [
        { id: "coffee", name: "Кава", kind: "limit", dailyCap: 3 },
        { id: "alcohol", name: "Алкоголь", kind: "limit", weeklyCap: 3 },
        { id: "cigarettes", name: "Сигарети", kind: "limit", dailyCap: 5 },
      ],
      habitLogs: {},
      addBuildHabit: (name, targetFrequency) =>
        set((s) => ({
          habits: [...s.habits, { id: crypto.randomUUID(), name, kind: "build", targetFrequency }],
        })),
      addLimitHabit: (name, cap, capPeriod) =>
        set((s) => ({
          habits: [
            ...s.habits,
            {
              id: crypto.randomUUID(),
              name,
              kind: "limit",
              dailyCap: capPeriod === "daily" ? cap : undefined,
              weeklyCap: capPeriod === "weekly" ? cap : undefined,
            },
          ],
        })),
      removeHabit: (id) => set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),
      toggleHabitDone: (date, habitId) =>
        set((s) => {
          const day = s.habitLogs[date] ?? {};
          const wasDone = (day[habitId] ?? 0) >= 1;
          return { habitLogs: { ...s.habitLogs, [date]: { ...day, [habitId]: wasDone ? 0 : 1 } } };
        }),
      incrementHabit: (date, habitId) =>
        set((s) => {
          const day = s.habitLogs[date] ?? {};
          return { habitLogs: { ...s.habitLogs, [date]: { ...day, [habitId]: (day[habitId] ?? 0) + 1 } } };
        }),
      decrementHabit: (date, habitId) =>
        set((s) => {
          const day = s.habitLogs[date] ?? {};
          const next = Math.max(0, (day[habitId] ?? 0) - 1);
          return { habitLogs: { ...s.habitLogs, [date]: { ...day, [habitId]: next } } };
        }),

      cycleSettings: { avgCycleLength: 28, avgPeriodLength: 5 },
      periodStarts: [],
      setCycleSettings: (settings) => set({ cycleSettings: settings }),
      markPeriodStart: (date) =>
        set((s) => {
          const key = date ?? todayKey();
          if (s.periodStarts.includes(key)) return s;
          return { periodStarts: [...s.periodStarts, key].sort() };
        }),
    }),
    {
      name: "life-os-health-v1",
      version: 2,
      migrate: (persisted, version) => {
        let state = persisted as Record<string, unknown>;

        // v0 -> v1: Настрій merges into Самопочуття (see the "Самопочуття —
        // об'єднання з Настроєм" prompt). Only moodEntries carries forward —
        // symptomEntries stays exactly as-is (Цикл still owns it, see the
        // comment on the state interface above) rather than being folded
        // in: its tags are freeform text with no valid mapping to a
        // body-zone id, and it's still a live, independent feature going
        // forward, not something being retired.
        if (version < 1) {
          const old = state as { moodEntries?: LegacyMoodEntry[] } & Record<string, unknown>;
          const moodEntries = old.moodEntries ?? [];
          const wellbeingByDate = new Map<string, WellbeingEntry>();
          for (const m of [...moodEntries].sort((a, b) => a.time.localeCompare(b.time))) {
            wellbeingByDate.set(m.date, {
              id: crypto.randomUUID(),
              date: m.date,
              overallFeeling: FEELING_LEVELS[m.score - 1],
              bodyZones: [],
              note: m.note || "",
            });
          }
          state = { ...state, wellbeingEntries: Array.from(wellbeingByDate.values()) };
        }

        // v1 -> v2: Звички split into build/limit kinds (see "Звички — дві
        // механіки" prompt). Legacy plain {id,name} habits all become
        // "limit" — that matches their original semantics (capped
        // counters, not streaks) better than "build" would. The three
        // original seed habits get the cap the prompt's own example uses;
        // any other, custom-named habit the user had already added gets a
        // generic high cap (effectively no visible ceiling yet) since
        // there's no way to infer what cap they'd actually want for it.
        if (version < 2) {
          const LEGACY_HABIT_CAP: Record<string, { dailyCap?: number; weeklyCap?: number }> = {
            Кава: { dailyCap: 3 },
            Алкоголь: { weeklyCap: 3 },
            Сигарети: { dailyCap: 5 },
          };
          const old = state as { habits?: { id: string; name: string }[] } & Record<string, unknown>;
          const habits = (old.habits ?? []).map((h) => ({
            ...h,
            kind: "limit" as const,
            ...(LEGACY_HABIT_CAP[h.name] ?? { dailyCap: 999 }),
          }));
          state = { ...state, habits };
        }

        return state as unknown as HealthState;
      },
    }
  )
);

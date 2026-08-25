import type { Course, Flashcard, StudySession, Assignment, ClassScheduleItem, Grade } from "./student-store";
import { DAILY_QUEST_GOAL_CARDS, DAILY_QUEST_XP } from "./student-store";
import { formatDateKey, pluralizeUk } from "./calendar-utils";

export const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

function weekdayIndex(dateKey: string): number {
  const d = new Date(`${dateKey}T00:00:00`);
  return (d.getDay() + 6) % 7;
}

function todayKey(): string {
  return formatDateKey(new Date());
}

/** Consecutive calendar days with at least one study session, walking back
 *  from today. Unlike a trading discipline streak, a day that's simply
 *  skipped DOES break this one — study habit streaks are meant to track
 *  actual daily consistency, not "days with any activity ever". Today not
 *  having a session yet doesn't break it (the day isn't over), so the walk
 *  starts from yesterday if today has nothing logged. */
export function computeStudyStreak(sessions: StudySession[]): number {
  const daysWithSession = new Set(sessions.map((s) => s.date));
  const today = todayKey();
  let cursor = new Date(`${today}T00:00:00`);
  if (!daysWithSession.has(today)) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (daysWithSession.has(formatDateKey(cursor))) {
    streak++;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeDueCardsCount(cards: Flashcard[], courseId?: string): number {
  const today = todayKey();
  return cards.filter((c) => (!courseId || c.courseId === courseId) && c.dueDate <= today).length;
}

export interface DailyQuest {
  goalCards: number;
  progressCards: number;
  done: boolean;
  xpReward: number;
}

export function computeDailyQuest(sessions: StudySession[]): DailyQuest {
  const today = todayKey();
  const progressCards = sessions.filter((s) => s.date === today).reduce((sum, s) => sum + s.cardsReviewed, 0);
  return {
    goalCards: DAILY_QUEST_GOAL_CARDS,
    progressCards,
    done: progressCards >= DAILY_QUEST_GOAL_CARDS,
    xpReward: DAILY_QUEST_XP,
  };
}

export interface WeeklyRecap {
  minutes: number;
  xp: number;
  cards: number;
}

/** Last 7 calendar days including today — a fixed trailing window, not a
 *  Mon-Sun calendar week, so "this week" always means "since 6 days ago"
 *  regardless of which weekday it currently is. */
export function computeWeeklyRecap(sessions: StudySession[]): WeeklyRecap {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  const sinceKey = formatDateKey(since);
  const inWindow = sessions.filter((s) => s.date >= sinceKey);
  return {
    minutes: inWindow.reduce((sum, s) => sum + s.minutes, 0),
    xp: inWindow.reduce((sum, s) => sum + s.xpEarned, 0),
    cards: inWindow.reduce((sum, s) => sum + s.cardsReviewed, 0),
  };
}

export function totalXp(sessions: StudySession[]): number {
  return sessions.reduce((sum, s) => sum + s.xpEarned, 0);
}

export type TimeOfDay = "Ранок" | "День" | "Вечір";
const TIME_OF_DAY_LABELS: TimeOfDay[] = ["Ранок", "День", "Вечір"];

function timeOfDayOf(time: string): TimeOfDay {
  const hour = Number(time.split(":")[0]);
  if (hour < 12) return "Ранок";
  if (hour < 18) return "День";
  return "Вечір";
}

export interface HeatmapRow {
  label: TimeOfDay;
  cells: { weekday: number; intensity: number }[]; // intensity 0-1, index === weekday
}

export interface StudyHeatmap {
  rows: HeatmapRow[];
  insight: string;
}

/** Session count per (time-of-day × weekday) cell over the trailing `days`
 *  window, normalized to the busiest cell — same shape as the trading
 *  session heatmap (trade-insights.ts's computeSessionHeatmap), just keyed
 *  by time-of-day instead of trading session. */
export function computeStudyHeatmap(sessions: StudySession[], days = 28): StudyHeatmap {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceKey = formatDateKey(since);
  const recent = sessions.filter((s) => s.date >= sinceKey);

  const counts = new Map<string, number>(); // `${timeOfDay}|${weekday}` -> count
  for (const s of recent) {
    const key = `${timeOfDayOf(s.time)}|${weekdayIndex(s.date)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const max = Math.max(1, ...counts.values());

  const rows: HeatmapRow[] = TIME_OF_DAY_LABELS.map((label) => ({
    label,
    cells: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      intensity: (counts.get(`${label}|${weekday}`) ?? 0) / max,
    })),
  }));

  if (recent.length === 0) {
    return { rows, insight: "Ще немає навчальних сесій за останній місяць." };
  }

  const byWeekday = new Map<number, number>();
  for (const s of recent) byWeekday.set(weekdayIndex(s.date), (byWeekday.get(weekdayIndex(s.date)) ?? 0) + 1);
  const bestWeekdays = [...byWeekday.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => WEEKDAY_LABELS[w]);

  const byTimeOfDay = new Map<TimeOfDay, number>();
  for (const s of recent) byTimeOfDay.set(timeOfDayOf(s.time), (byTimeOfDay.get(timeOfDayOf(s.time)) ?? 0) + 1);
  const morningShare = (byTimeOfDay.get("Ранок") ?? 0) / recent.length;

  const insight =
    bestWeekdays.length > 0
      ? `Найпродуктивніший час — вечір у ${bestWeekdays.join(", ")}.${
          morningShare < 0.1 ? " Ранки практично не використовуються для навчання." : ""
        }`
      : "Ще немає достатньо даних для висновку.";

  return { rows, insight };
}

export interface DeckStats {
  deckName: string;
  courseId: string;
  total: number;
  memorized: number;
  pct: number;
  lastReviewedAt: string | null;
}

export function computeDeckStats(cards: Flashcard[]): DeckStats[] {
  const byDeck = new Map<string, Flashcard[]>();
  for (const c of cards) {
    const key = `${c.courseId}|${c.deckName}`;
    const list = byDeck.get(key) ?? [];
    list.push(c);
    byDeck.set(key, list);
  }
  return Array.from(byDeck.entries()).map(([key, list]) => {
    const [courseId, deckName] = key.split("|");
    const memorized = list.filter((c) => c.repetitions > 0).length;
    const lastReviewedAt = list.reduce<string | null>(
      (latest, c) => (!latest || (c.lastReviewedAt && c.lastReviewedAt > latest) ? c.lastReviewedAt : latest),
      null
    );
    return { deckName, courseId, total: list.length, memorized, pct: list.length > 0 ? Math.round((memorized / list.length) * 100) : 0, lastReviewedAt };
  });
}

/** The deck most recently studied — what the "Флеш-картки" module tile
 *  reports a memorized-% for, since showing every deck at once has no room
 *  on a single tile. */
export function mostRecentDeck(cards: Flashcard[]): DeckStats | null {
  const decks = computeDeckStats(cards);
  if (decks.length === 0) return null;
  return decks.reduce((best, d) => {
    if (!best.lastReviewedAt) return d;
    if (!d.lastReviewedAt) return best;
    return d.lastReviewedAt > best.lastReviewedAt ? d : best;
  });
}

export interface SubjectPerformance {
  courseId: string;
  courseName: string;
  avgGrade: number;
  count: number;
}

export function computeSubjectPerformance(grades: Grade[], courses: Course[]): SubjectPerformance[] {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const byCourse = new Map<string, Grade[]>();
  for (const g of grades) {
    const list = byCourse.get(g.courseId) ?? [];
    list.push(g);
    byCourse.set(g.courseId, list);
  }
  return Array.from(byCourse.entries())
    .map(([courseId, list]) => ({
      courseId,
      courseName: courseById.get(courseId)?.name ?? "—",
      avgGrade: list.reduce((sum, g) => sum + g.value, 0) / list.length,
      count: list.length,
    }))
    .sort((a, b) => b.avgGrade - a.avgGrade);
}

export function computeOverallAverageGrade(grades: Grade[]): number | null {
  if (grades.length === 0) return null;
  return grades.reduce((sum, g) => sum + g.value, 0) / grades.length;
}

export interface Achievement {
  id: string;
  label: string;
  unlocked: boolean;
  /** 0-1 — only meaningful while locked, to show "how close". */
  progress: number;
}

const CARDS_MILESTONE = 500;
const STREAK_MILESTONE = 8;

/** Every threshold here is a real, checkable fact about the student's own
 *  data — no achievement is ever awarded speculatively. */
export function computeAchievements(streak: number, totalCardsReviewed: number, decks: DeckStats[]): Achievement[] {
  const anyDeckComplete = decks.some((d) => d.total > 0 && d.memorized === d.total);
  return [
    {
      id: "streak",
      label: `${STREAK_MILESTONE} днів стрік`,
      unlocked: streak >= STREAK_MILESTONE,
      progress: Math.min(1, streak / STREAK_MILESTONE),
    },
    {
      id: "deck-complete",
      label: "Колода закрита",
      unlocked: anyDeckComplete,
      progress: decks.length > 0 ? Math.max(...decks.map((d) => (d.total > 0 ? d.memorized / d.total : 0))) : 0,
    },
    {
      id: "cards-milestone",
      label: `${CARDS_MILESTONE} карток`,
      unlocked: totalCardsReviewed >= CARDS_MILESTONE,
      progress: Math.min(1, totalCardsReviewed / CARDS_MILESTONE),
    },
  ];
}

export function computeTotalCardsReviewed(sessions: StudySession[]): number {
  return sessions.reduce((sum, s) => sum + s.cardsReviewed, 0);
}

export interface ClassToday {
  courseId: string;
  courseName: string;
  time: string;
}

export function computeClassesToday(schedule: ClassScheduleItem[], courses: Course[]): ClassToday[] {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const todayWeekday = weekdayIndex(todayKey());
  return schedule
    .filter((c) => c.weekday === todayWeekday)
    .map((c) => ({ courseId: c.courseId, courseName: courseById.get(c.courseId)?.name ?? "—", time: c.time }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export interface UpcomingDeadline {
  id: string;
  title: string;
  dueDate: string;
  relativeLabel: string;
}

function relativeLabelFor(dueDate: string): string {
  const today = new Date(`${todayKey()}T00:00:00`);
  const due = new Date(`${dueDate}T00:00:00`);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "прострочено";
  if (days === 0) return "сьогодні";
  if (days === 1) return "завтра";
  return `${days} ${pluralizeUk(days, ["день", "дні", "днів"])}`;
}

export function computeUpcomingDeadlines(assignments: Assignment[]): UpcomingDeadline[] {
  return assignments
    .filter((a) => !a.done)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((a) => ({ id: a.id, title: a.title, dueDate: a.dueDate, relativeLabel: relativeLabelFor(a.dueDate) }));
}

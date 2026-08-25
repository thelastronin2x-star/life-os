import { describe, expect, it } from "vitest";
import {
  computeStudyStreak,
  computeDueCardsCount,
  computeDailyQuest,
  computeWeeklyRecap,
  computeDeckStats,
  mostRecentDeck,
  computeSubjectPerformance,
  computeAchievements,
  computeClassesToday,
  computeUpcomingDeadlines,
} from "./student-insights";
import { formatDateKey } from "./calendar-utils";
import type { Flashcard, StudySession, Assignment, ClassScheduleItem, Course, Grade } from "./student-store";

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDateKey(d);
}

function makeSession(overrides: Partial<StudySession>): StudySession {
  return { id: crypto.randomUUID(), date: dateOffset(0), time: "10:00", minutes: 10, cardsReviewed: 5, xpEarned: 20, ...overrides };
}

function makeCard(overrides: Partial<Flashcard>): Flashcard {
  return {
    id: crypto.randomUUID(),
    courseId: "c1",
    deckName: "Deck A",
    front: "Q",
    back: "A",
    repetitions: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    dueDate: dateOffset(0),
    lastReviewedAt: null,
    ...overrides,
  };
}

describe("computeStudyStreak", () => {
  it("counts consecutive days back from today", () => {
    const sessions = [makeSession({ date: dateOffset(0) }), makeSession({ date: dateOffset(-1) }), makeSession({ date: dateOffset(-2) })];
    expect(computeStudyStreak(sessions)).toBe(3);
  });

  it("still counts yesterday's streak even if today has no session yet", () => {
    const sessions = [makeSession({ date: dateOffset(-1) }), makeSession({ date: dateOffset(-2) })];
    expect(computeStudyStreak(sessions)).toBe(2);
  });

  it("breaks on a skipped day", () => {
    const sessions = [makeSession({ date: dateOffset(0) }), makeSession({ date: dateOffset(-2) })];
    expect(computeStudyStreak(sessions)).toBe(1);
  });

  it("is 0 with no sessions", () => {
    expect(computeStudyStreak([])).toBe(0);
  });
});

describe("computeDueCardsCount", () => {
  it("counts cards due today or earlier", () => {
    const cards = [makeCard({ dueDate: dateOffset(0) }), makeCard({ dueDate: dateOffset(-1) }), makeCard({ dueDate: dateOffset(2) })];
    expect(computeDueCardsCount(cards)).toBe(2);
  });

  it("filters by course when given", () => {
    const cards = [makeCard({ courseId: "c1", dueDate: dateOffset(0) }), makeCard({ courseId: "c2", dueDate: dateOffset(0) })];
    expect(computeDueCardsCount(cards, "c1")).toBe(1);
  });
});

describe("computeDailyQuest", () => {
  it("tracks today's reviewed-card progress against the fixed goal", () => {
    const sessions = [makeSession({ date: dateOffset(0), cardsReviewed: 34 }), makeSession({ date: dateOffset(-1), cardsReviewed: 100 })];
    const quest = computeDailyQuest(sessions);
    expect(quest.progressCards).toBe(34);
    expect(quest.done).toBe(false);
  });

  it("is done once today's cards meet the goal", () => {
    const sessions = [makeSession({ date: dateOffset(0), cardsReviewed: 40 })];
    expect(computeDailyQuest(sessions).done).toBe(true);
  });
});

describe("computeWeeklyRecap", () => {
  it("sums minutes/xp/cards over the trailing 7 days, excluding older sessions", () => {
    const sessions = [
      makeSession({ date: dateOffset(-2), minutes: 30, xpEarned: 50, cardsReviewed: 10 }),
      makeSession({ date: dateOffset(-10), minutes: 999, xpEarned: 999, cardsReviewed: 999 }),
    ];
    const recap = computeWeeklyRecap(sessions);
    expect(recap.minutes).toBe(30);
    expect(recap.xp).toBe(50);
    expect(recap.cards).toBe(10);
  });
});

describe("computeDeckStats / mostRecentDeck", () => {
  it("computes memorized percentage per deck", () => {
    const cards = [
      makeCard({ deckName: "A", repetitions: 1 }),
      makeCard({ deckName: "A", repetitions: 0 }),
      makeCard({ deckName: "B", repetitions: 2 }),
    ];
    const decks = computeDeckStats(cards);
    const a = decks.find((d) => d.deckName === "A")!;
    expect(a.total).toBe(2);
    expect(a.memorized).toBe(1);
    expect(a.pct).toBe(50);
  });

  it("picks the deck with the most recent review as 'most recent'", () => {
    const cards = [
      makeCard({ deckName: "A", lastReviewedAt: "2026-01-01T00:00:00.000Z" }),
      makeCard({ deckName: "B", lastReviewedAt: "2026-02-01T00:00:00.000Z" }),
    ];
    expect(mostRecentDeck(cards)?.deckName).toBe("B");
  });

  it("returns null with no cards at all", () => {
    expect(mostRecentDeck([])).toBeNull();
  });
});

describe("computeSubjectPerformance", () => {
  it("averages grades per course, sorted best first", () => {
    const courses: Course[] = [
      { id: "c1", name: "Math", syllabus: "", notes: "" },
      { id: "c2", name: "History", syllabus: "", notes: "" },
    ];
    const grades: Grade[] = [
      { id: "g1", courseId: "c1", value: 5, date: dateOffset(0) },
      { id: "g2", courseId: "c1", value: 1, date: dateOffset(0) },
      { id: "g3", courseId: "c2", value: 4, date: dateOffset(0) },
    ];
    const perf = computeSubjectPerformance(grades, courses);
    expect(perf[0].courseName).toBe("History");
    expect(perf[1].avgGrade).toBe(3);
  });
});

describe("computeAchievements", () => {
  it("unlocks streak, deck-complete, and cards-milestone only when the real threshold is met", () => {
    const decks = [{ deckName: "A", courseId: "c1", total: 10, memorized: 10, pct: 100, lastReviewedAt: null }];
    const achievements = computeAchievements(8, 500, decks);
    expect(achievements.every((a) => a.unlocked)).toBe(true);
  });

  it("stays locked (with progress) below the threshold", () => {
    const achievements = computeAchievements(2, 50, []);
    const streakAch = achievements.find((a) => a.id === "streak")!;
    expect(streakAch.unlocked).toBe(false);
    expect(streakAch.progress).toBeCloseTo(2 / 8);
  });
});

describe("computeClassesToday", () => {
  it("filters schedule to today's weekday, sorted by time", () => {
    const todayWeekday = (new Date().getDay() + 6) % 7;
    const courses: Course[] = [{ id: "c1", name: "Math", syllabus: "", notes: "" }];
    const schedule: ClassScheduleItem[] = [
      { id: "s1", courseId: "c1", weekday: todayWeekday, time: "14:00" },
      { id: "s2", courseId: "c1", weekday: todayWeekday, time: "09:00" },
      { id: "s3", courseId: "c1", weekday: (todayWeekday + 1) % 7, time: "10:00" },
    ];
    const classes = computeClassesToday(schedule, courses);
    expect(classes.map((c) => c.time)).toEqual(["09:00", "14:00"]);
  });
});

describe("computeUpcomingDeadlines", () => {
  it("excludes done assignments and sorts by due date", () => {
    const assignments: Assignment[] = [
      { id: "a1", courseId: null, title: "Later", dueDate: dateOffset(5), done: false },
      { id: "a2", courseId: null, title: "Soon", dueDate: dateOffset(1), done: false },
      { id: "a3", courseId: null, title: "Done already", dueDate: dateOffset(0), done: true },
    ];
    const deadlines = computeUpcomingDeadlines(assignments);
    expect(deadlines.map((d) => d.title)).toEqual(["Soon", "Later"]);
    expect(deadlines[0].relativeLabel).toBe("завтра");
  });
});

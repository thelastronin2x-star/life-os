"use client";

import { useStudentStore, type StudySession } from "./student-store";
import { computeStudyStreak, computeTotalCardsReviewed, mostRecentDeck } from "./student-insights";
import { formatDateKey } from "./calendar-utils";

/** Real-data context for the Student profile's inline assistant blurb —
 *  same "celebrate progress, never nag about deadlines" tone the prompt asks
 *  for baked directly into the instruction, not left for the model to guess
 *  from a neutral prompt. No friend comparison (no real friends data exists
 *  yet — see the "coming soon" placeholders on the same screen), so the
 *  instruction explicitly steers away from inventing one. */
export function buildStudentContext(): string {
  const { flashcards, studySessions } = useStudentStore.getState();
  const streak = computeStudyStreak(studySessions);
  const deck = mostRecentDeck(flashcards);
  const todayCards = studySessions
    .filter((s) => s.date === formatDateKey(new Date()))
    .reduce((sum, s) => sum + s.cardsReviewed, 0);

  return [
    'Контекст: вкладка "Робота" для профілю Студент. Тон — святкування прогресу й легка мотивація, НІКОЛИ тривога чи тиск про дедлайни.',
    streak > 0 ? `Стрік навчання: ${streak} день(днів) поспіль.` : "Стріку навчання зараз немає.",
    todayCards > 0 ? `Сьогодні вже повторено ${todayCards} карток.` : "Сьогодні ще не було повторення карток.",
    deck ? `Найактивніша колода зараз — "${deck.deckName}", запам'ятано ${deck.pct}% (${deck.memorized}/${deck.total}).` : "Ще немає жодної колоди карток.",
    "Не згадуй друзів чи соціальні порівняння — цих даних ще немає.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function computeStudentSignature(sessions: StudySession[]): string {
  return [sessions.length, computeStudyStreak(sessions), computeTotalCardsReviewed(sessions)].join("|");
}

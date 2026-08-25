/** SuperMemo SM-2 — the standard spaced-repetition scheduling algorithm.
 *  Quality is graded 0-5 in the original algorithm; the review UI only ever
 *  offers three buttons (Знову/Важко/Легко), mapped to 1/3/5 below — the
 *  coarser input Anki-style apps use in practice, still a valid SM-2 input. */

export const REVIEW_QUALITY = { again: 1, hard: 3, easy: 5 } as const;
export type ReviewQuality = (typeof REVIEW_QUALITY)[keyof typeof REVIEW_QUALITY];

export interface Sm2State {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
}

const INITIAL_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;

export function initialSm2State(): Sm2State {
  return { repetitions: 0, easeFactor: INITIAL_EASE_FACTOR, intervalDays: 0 };
}

/** One SM-2 step. A quality below 3 ("Знову") resets the repetition count
 *  and drops the card back to a 1-day interval — it wasn't actually
 *  remembered, so the schedule built on it so far is no longer trustworthy.
 *  Ease factor is clamped at 1.3 (SM-2's own floor) so a run of hard cards
 *  can't spiral the interval growth down to nothing. */
export function reviewSm2(state: Sm2State, quality: ReviewQuality): Sm2State {
  const easeFactor = Math.max(
    MIN_EASE_FACTOR,
    state.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  if (quality < 3) {
    return { repetitions: 0, easeFactor, intervalDays: 1 };
  }

  const repetitions = state.repetitions + 1;
  let intervalDays: number;
  if (repetitions === 1) intervalDays = 1;
  else if (repetitions === 2) intervalDays = 6;
  else intervalDays = Math.round(state.intervalDays * easeFactor);

  return { repetitions, easeFactor, intervalDays };
}

export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

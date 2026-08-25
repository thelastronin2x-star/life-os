/** Flat XP amounts per real action — kept as named constants so the amounts
 *  are easy to eyeball/tune, and so the db layer and any test don't hardcode
 *  magic numbers in three different places. */
export const TEAM_XP = {
  tradeClosed: 15,
  studySessionPerCard: 4, // mirrors XP_PER_CARD in student-store.ts, so team XP and personal XP stay comparable
  studySessionPerMinute: 1,
  sharedDeckReview: 4,
  projectPartDone: 20,
} as const;

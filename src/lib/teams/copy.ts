import type { TeamProfile } from "./types";

export interface TeamCopy {
  memberWord: string; // "6 ОДНОГРУПНИКІВ" / "6 УЧАСНИКІВ"
  secondaryMetricLabel: string; // "Середній win rate" / "Середній бал"
  streakLabel: string; // "Стрік команди" / "Стрік групи"
  ratingTitle: string; // "Рейтинг учасників" / "Рейтинг групи"
  inviteButtonLabel: string;
}

/** The "it" profile has no dedicated content spec (only trader/student were
 *  briefed) — it falls back to the trader wording, the more profile-neutral
 *  of the two, rather than inventing unbriefed copy. */
const TRADER_COPY: TeamCopy = {
  memberWord: "учасників",
  secondaryMetricLabel: "Середній win rate",
  streakLabel: "Стрік команди",
  ratingTitle: "Рейтинг учасників",
  inviteButtonLabel: "Запросити людей",
};

const STUDENT_COPY: TeamCopy = {
  memberWord: "одногрупників",
  secondaryMetricLabel: "Середній бал",
  streakLabel: "Стрік групи",
  ratingTitle: "Рейтинг групи",
  inviteButtonLabel: "Запросити одногрупників",
};

export function teamCopyFor(profile: TeamProfile): TeamCopy {
  return profile === "student" ? STUDENT_COPY : TRADER_COPY;
}

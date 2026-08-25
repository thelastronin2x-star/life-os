import type { CalendarItem } from "./calendar-store";
import type { Medication } from "./health-store";

/** Prefix health-store's addMedicationReminder has always used for a
 *  medication's calendar event title — the only signal available for
 *  reminders created before `medicationId` existed on CalendarItem. */
const LEGACY_TITLE_PREFIX = "Прийом: ";

/** True if this calendar item is a medication reminder — either the modern
 *  explicit link (`medicationId`, set for anything created after this
 *  feature shipped) or the legacy "Прийом: <name>" title format, so
 *  reminders that already existed before this shipped still collapse into
 *  the meds marker instead of continuing to show as a full event card. */
export function isMedicationReminderItem(item: CalendarItem): boolean {
  return !!item.medicationId || item.title.startsWith(LEGACY_TITLE_PREFIX);
}

/** Resolves the Medication record behind a calendar item: the explicit
 *  medicationId link first, falling back to matching the legacy title
 *  format against the current medications list (breaks only if the
 *  medication was since renamed — an accepted, narrow edge case, same as
 *  any other title-based matching in this app). */
export function resolveMedicationForItem(item: CalendarItem, medications: Medication[]): Medication | undefined {
  if (item.medicationId) return medications.find((m) => m.id === item.medicationId);
  return medications.find((m) => item.title === `${LEGACY_TITLE_PREFIX}${m.name}`);
}

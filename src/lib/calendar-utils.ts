export const WEEKDAY_LABELS_MONDAY = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
export const WEEKDAY_LABELS_SUNDAY = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function getWeekdayLabels(firstDayOfWeek: "monday" | "sunday" = "monday"): string[] {
  return firstDayOfWeek === "sunday" ? WEEKDAY_LABELS_SUNDAY : WEEKDAY_LABELS_MONDAY;
}

export const MONTH_LABELS = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "ГГ:ХХ" from a unix-seconds timestamp (bank imports carry an exact time;
 *  manually-added transactions don't, hence the optional/undefined case). */
export function formatTimeOfDay(unixSeconds: number | undefined): string | null {
  if (!unixSeconds) return null;
  const d = new Date(unixSeconds * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export interface DayCell {
  date: Date;
  key: string;
  inCurrentMonth: boolean;
}

/** Returns a flat array of day cells covering the full weeks that overlap the given month. */
export function getMonthMatrix(
  year: number,
  month: number,
  firstDayOfWeek: "monday" | "sunday" = "monday"
): DayCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday =
    firstDayOfWeek === "monday" ? (firstOfMonth.getDay() + 6) % 7 : firstOfMonth.getDay();
  const start = new Date(year, month, 1 - firstWeekday);

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date, key: formatDateKey(date), inCurrentMonth: date.getMonth() === month });
  }
  // Trim trailing rows that are entirely outside the current month
  while (cells.length > 35 && cells.slice(-7).every((c) => !c.inCurrentMonth)) {
    cells.splice(-7, 7);
  }
  return cells;
}

/** The 7 days of the week containing `date`, respecting the same
 *  Monday/Sunday-first setting as getMonthMatrix — so the week view lines up
 *  with the month grid's own row boundaries. */
export function getWeekDays(date: Date, firstDayOfWeek: "monday" | "sunday" = "monday"): DayCell[] {
  const weekday = firstDayOfWeek === "monday" ? (date.getDay() + 6) % 7 : date.getDay();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - weekday);
  const cells: DayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date: d, key: formatDateKey(d), inCurrentMonth: true });
  }
  return cells;
}

export function formatAgendaDate(date: Date): string {
  const weekday = date.toLocaleDateString("uk-UA", { weekday: "long" });
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalized}, ${date.getDate()} ${MONTH_LABELS[date.getMonth()].toLowerCase()}`;
}

export interface DayPeriod {
  key: "morning" | "day" | "evening";
  label: string;
  from: number;
  to: number;
}

export const DAY_PERIODS: DayPeriod[] = [
  { key: "morning", label: "Ранок", from: 5, to: 11 },
  { key: "day", label: "День", from: 12, to: 17 },
  { key: "evening", label: "Вечір", from: 18, to: 23 },
];

/** Which day-period an hour (0-23) belongs to, for the День view's grouping.
 *  Hours outside all three defined ranges (0-4, deep night) fall back to
 *  "evening" — they're really the previous evening running late, not a
 *  fourth undefined period nobody asked for. */
export function periodForHour(hour: number): DayPeriod {
  for (const period of DAY_PERIODS) {
    if (hour >= period.from && hour <= period.to) return period;
  }
  return DAY_PERIODS[DAY_PERIODS.length - 1];
}

/** Ukrainian plural selection (1 / 2-4 / 5+, with the x11-x14 exception
 *  falling into the "many" bucket) — e.g. pluralizeUk(n, ["прийом",
 *  "прийоми", "прийомів"]). */
export function pluralizeUk(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export interface ParsedEventText {
  /** The input with any recognized date/time phrase stripped out — falls
   *  back to the original trimmed text if nothing was recognized, so a
   *  title is never empty just because parsing found nothing to remove. */
  title: string;
  date: string | null;
  time: string | null;
}

const WEEKDAY_STEMS: { stem: string; day: number }[] = [
  { stem: "понеділ", day: 1 },
  { stem: "вівтор", day: 2 },
  { stem: "серед", day: 3 },
  { stem: "четвер", day: 4 },
  { stem: "п'ятниц", day: 5 },
  { stem: "пятниц", day: 5 },
  { stem: "субот", day: 6 },
  { stem: "неділ", day: 0 },
];

/** The next date (today included) that falls on `targetDow` (0=Sun..6=Sat,
 *  matching Date#getDay()) — "у п'ятницю" said on a Friday means today, not
 *  a week from now. */
function nextWeekdayOnOrAfter(from: Date, targetDow: number): Date {
  const d = new Date(from);
  const diff = (targetDow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Best-effort free-text date/time recognition for the quick-add sheet —
 *  deliberately modest, not a full NLP engine: сьогодні/завтра/післязавтра,
 *  Ukrainian weekday names in any common case ending, and a clock time
 *  ("о 15:00", "о 15", or a bare "15:00"). Anything it doesn't recognize is
 *  simply left in the title and the date/time chips stay the fallback —
 *  this is a convenience layer on top of the chips, not their replacement. */
export function parseEventText(text: string, now: Date = new Date()): ParsedEventText {
  let remaining = text;
  let date: string | null = null;

  if (/післязавтра/iu.test(remaining)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    date = formatDateKey(d);
    remaining = remaining.replace(/післязавтра/iu, "");
  } else if (/завтра/iu.test(remaining)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    date = formatDateKey(d);
    remaining = remaining.replace(/завтра/iu, "");
  } else if (/сьогодні/iu.test(remaining)) {
    date = formatDateKey(now);
    remaining = remaining.replace(/сьогодні/iu, "");
  } else {
    for (const { stem, day } of WEEKDAY_STEMS) {
      const re = new RegExp(`\\p{L}*${stem}\\p{L}*`, "iu");
      const match = remaining.match(re);
      if (match) {
        date = formatDateKey(nextWeekdayOnOrAfter(now, day));
        remaining = remaining.replace(re, "");
        break;
      }
    }
  }

  // Not `\bо` — JS's `\b` is ASCII-only (defined off `\w` = [A-Za-z0-9_]), so
  // it doesn't anchor correctly around a Cyrillic letter. Anchoring "о" to
  // whitespace/string edges instead sidesteps that entirely.
  let time: string | null = null;
  const timeMatch =
    remaining.match(/(?:^|\s)о\s+(\d{1,2})(?::(\d{2}))?(?=\s|$)/iu) ?? remaining.match(/\b(\d{1,2}):(\d{2})\b/);
  if (timeMatch) {
    const hh = Math.min(23, parseInt(timeMatch[1], 10));
    const mm = timeMatch[2] ? Math.min(59, parseInt(timeMatch[2], 10)) : 0;
    time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    remaining = remaining.replace(timeMatch[0], "");
  }

  const title = remaining
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[,.;:–—-]+|[,.;:–—-]+$/g, "")
    .trim();

  return { title: title || text.trim(), date, time };
}

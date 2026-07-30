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

export function formatAgendaDate(date: Date): string {
  const weekday = date.toLocaleDateString("uk-UA", { weekday: "long" });
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalized}, ${date.getDate()} ${MONTH_LABELS[date.getMonth()].toLowerCase()}`;
}

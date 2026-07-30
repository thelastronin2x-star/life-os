export interface Holiday {
  month: number; // 1-12
  day: number;
  name: string;
}

export const UA_HOLIDAYS: Holiday[] = [
  { month: 1, day: 1, name: "Новий рік" },
  { month: 1, day: 7, name: "Різдво Христове" },
  { month: 3, day: 8, name: "Міжнародний жіночий день" },
  { month: 5, day: 1, name: "День праці" },
  { month: 5, day: 8, name: "День пам'яті та перемоги над нацизмом" },
  { month: 6, day: 28, name: "День Конституції України" },
  { month: 8, day: 24, name: "День Незалежності України" },
  { month: 10, day: 1, name: "День захисників і захисниць України" },
  { month: 12, day: 25, name: "Різдво Христове (за новим стилем)" },
];

export function getHoliday(date: Date): Holiday | undefined {
  return UA_HOLIDAYS.find((h) => h.month === date.getMonth() + 1 && h.day === date.getDate());
}

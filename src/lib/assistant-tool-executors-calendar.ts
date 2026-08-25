"use client";

import { useCalendarStore } from "@/lib/calendar-store";

/** Kept in its own file, not alongside the health/work executors — importing
 *  one named export from a shared file still bundles the whole module (and
 *  its store imports) together in practice, which is exactly the
 *  cross-scope leak this split avoids. Each scope's bubble only ever
 *  imports its own executor file. */
export function executeCalendarTool(name: string, input: Record<string, unknown>): string {
  const store = useCalendarStore.getState();

  if (name === "create_event") {
    const title = String(input.title ?? "").trim();
    const date = String(input.date ?? "");
    if (!title || !date) return "Не вистачає назви або дати — подію не створено.";
    const category = input.category === "work" ? "work" : "personal";
    store.addItem({
      date,
      kind: "event",
      title,
      time: input.time ? String(input.time) : undefined,
      category,
      reminder: "none",
      recurrence: null,
    });
    return `Створено подію "${title}" на ${date}${input.time ? " о " + input.time : ""}.`;
  }

  if (name === "move_event") {
    const title = String(input.title ?? "");
    const fromDate = String(input.fromDate ?? "");
    const toDate = String(input.toDate ?? "");
    const match = store.items.find((i) => i.title === title && i.date === fromDate);
    if (!match) return `Не знайшов подію "${title}" на ${fromDate} — нічого не перенесено.`;
    store.updateItem(match.id, { date: toDate, time: input.toTime ? String(input.toTime) : match.time });
    return `Перенесено "${title}" на ${toDate}${input.toTime ? " о " + input.toTime : ""}.`;
  }

  if (name === "delete_event") {
    const title = String(input.title ?? "");
    const date = String(input.date ?? "");
    const match = store.items.find((i) => i.title === title && i.date === date);
    if (!match) return `Не знайшов подію "${title}" на ${date} — нічого не видалено.`;
    store.removeItem(match.id);
    return `Видалено "${title}" (${date}).`;
  }

  return `Невідомий інструмент: ${name}.`;
}

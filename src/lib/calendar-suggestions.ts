import type { CalendarItem, CalendarCategory } from "./calendar-store";

export interface TitleSuggestion {
  title: string;
  category: CalendarCategory;
  time?: string;
  count: number;
}

/** The handful of things this person actually creates, ranked by how often.
 *
 *  No new stored entity: suggestions are derived from the existing items on
 *  every open, the same way recurring payments are derived from transactions.
 *  A saved "templates" list would be one more thing to keep in sync, and it
 *  would go stale the moment habits change — this can't.
 *
 *  Carries the category and time along with the title, because that's what
 *  makes a suggestion worth a tap: picking "Зал" should also mean "особисте,
 *  19:30", not just fill in a word. */
export function frequentTitles(items: CalendarItem[], limit = 3): TitleSuggestion[] {
  const groups = new Map<string, { titles: Map<string, number>; category: Map<CalendarCategory, number>; times: Map<string, number>; count: number }>();

  for (const item of items) {
    const key = item.title.trim().toLowerCase();
    if (!key) continue;
    let g = groups.get(key);
    if (!g) {
      g = { titles: new Map(), category: new Map(), times: new Map(), count: 0 };
      groups.set(key, g);
    }
    g.count += 1;
    g.titles.set(item.title.trim(), (g.titles.get(item.title.trim()) ?? 0) + 1);
    g.category.set(item.category, (g.category.get(item.category) ?? 0) + 1);
    if (item.time) g.times.set(item.time, (g.times.get(item.time) ?? 0) + 1);
  }

  function mostCommon<T>(counts: Map<T, number>): T | undefined {
    let best: T | undefined;
    let bestCount = 0;
    for (const [value, n] of counts) {
      if (n > bestCount) {
        best = value;
        bestCount = n;
      }
    }
    return best;
  }

  return Array.from(groups.values())
    // A single past occurrence isn't a habit — suggesting it would just be
    // echoing the last thing typed back at the user.
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((g) => ({
      title: mostCommon(g.titles)!,
      category: mostCommon(g.category) ?? "personal",
      time: mostCommon(g.times),
      count: g.count,
    }));
}

/** Times this person actually schedules things at, padded with sensible
 *  defaults so the grid is never half-empty on a fresh install. */
export function frequentTimes(items: CalendarItem[], limit = 4): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.time) continue;
    counts.set(item.time, (counts.get(item.time) ?? 0) + 1);
  }
  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([time]) => time);

  const defaults = ["09:00", "12:00", "18:00", "20:00"];
  const out: string[] = [];
  for (const t of [...ranked, ...defaults]) {
    if (out.length >= limit) break;
    if (!out.includes(t)) out.push(t);
  }
  return out.sort();
}

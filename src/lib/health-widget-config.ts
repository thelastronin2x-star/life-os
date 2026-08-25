export type HealthWidgetId = "sleep" | "water" | "wellbeing" | "meds" | "activity" | "habits" | "cycle";

/** Сон and Ліки get the full-width bento cell (most content / most
 *  important), the rest pair up two-per-row. Order here also defines the
 *  fixed list order on the "Віджети Здоров'я" settings screen — independent
 *  of `enabledHealthWidgets`' own order, which drives the dashboard instead. */
export const HEALTH_WIDGET_IDS: HealthWidgetId[] = ["sleep", "water", "wellbeing", "meds", "activity", "habits", "cycle"];

export const HEALTH_WIDGET_CONFIG: Record<HealthWidgetId, { size: "full" | "half"; label: string }> = {
  sleep: { size: "full", label: "Сон" },
  meds: { size: "full", label: "Ліки та добавки" },
  water: { size: "half", label: "Вода" },
  wellbeing: { size: "half", label: "Самопочуття" },
  activity: { size: "half", label: "Активність" },
  habits: { size: "half", label: "Звички" },
  cycle: { size: "half", label: "Цикл" },
};

// cycle stays opted-out by default, same as before this widget-picker
// existed — everything else was always shown, so it stays on for anyone
// who's never touched this setting.
export const DEFAULT_ENABLED_HEALTH_WIDGETS: HealthWidgetId[] = [
  "sleep",
  "water",
  "wellbeing",
  "meds",
  "activity",
  "habits",
];

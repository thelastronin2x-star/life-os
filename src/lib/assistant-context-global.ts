"use client";

import { buildCalendarContext, computeCalendarSignature } from "./assistant-context-calendar";
import { buildHealthSummary, computeHealthSignature } from "./assistant-context-health";
import { buildFinanceContext, computeFinanceSignature } from "./assistant-context-finance";
import { buildWorkSummary, computeWorkSignature } from "./assistant-context-work";
import type { Profile } from "./store";
import type { CalendarItem } from "./calendar-store";
import type { Trade } from "./journal-store";
import type { Transaction, BudgetCategory } from "./finance-store";
import type { useHealthStore } from "./health-store";

/** Home's global context — the only place all four domains are meant to
 *  come together, which is exactly why this file (and only this file) is
 *  allowed to import all four assistant-context-*.ts modules. Nothing in
 *  the calendar/health/work scoped bubbles imports this. */

/** Clearly labeled sections rather than a run-on paragraph — a concatenated
 *  blob is exactly what assistant-context-report.ts's buildReportContext
 *  already does, and reading it back confirms it just makes the model
 *  restate each source in turn. Section headers plus
 *  GLOBAL_ASSISTANT_PROMPT's explicit "look across sections" instruction is
 *  what actually gets cross-source reasoning instead of four paragraphs
 *  glued together. */
export function buildGlobalContext(profile: Profile): string {
  return [
    `=== Календар ===\n${buildCalendarContext()}`,
    `=== Здоров'я ===\n${buildHealthSummary()}`,
    `=== Фінанси ===\n${buildFinanceContext()}`,
    `=== Робота ===\n${buildWorkSummary(profile)}`,
  ].join("\n\n");
}

export interface GlobalSignatureInputs {
  calendarItems: CalendarItem[];
  health: ReturnType<typeof useHealthStore.getState>;
  trades: Trade[];
  transactions: Transaction[];
  budgetCategories: BudgetCategory[];
  profile: Profile;
}

/** Combines every source's own signature — the global insight goes stale the
 *  moment any single source would, since a cross-source correlation can
 *  hinge on whichever one just changed. Pure — every slice comes in as a
 *  param (reactive selectors from useGlobalInsightSync), so this recomputes
 *  whenever any of the four actually changes, not just whenever Home
 *  happens to re-render for some unrelated reason. */
export function computeGlobalSignature(inputs: GlobalSignatureInputs): string {
  return [
    computeCalendarSignature(inputs.calendarItems),
    computeWorkSignature(inputs.trades, inputs.profile),
    computeFinanceSignature(inputs.transactions, inputs.budgetCategories),
    computeHealthSignature(inputs.health),
  ].join("||");
}

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Only these two adviceTypes ever get an outcome computed — both map to a
 *  concrete, already-stored limit (BudgetCategory.limitsByAccount,
 *  PropAccount.maxDrawdown), so "did it work" can be measured on real
 *  before/after numbers (see assistant-effectiveness.ts). calendar-event and
 *  automation-rule are still real, executed actions — they just don't have a
 *  single measurable follow-up metric, so their outcome is set to
 *  "not_measurable" immediately rather than left in permanent fake-pending
 *  limbo. */
export type AdviceType = "budget-limit" | "risk-limit" | "calendar-event" | "automation-rule";
export type AdviceDomain = "finance" | "work" | "calendar" | "automation";
export type AdviceUserAction = "accepted" | "shown";
export type AdviceOutcome = "worked" | "not_worked" | "insufficient_data" | "not_measurable";

export interface AdviceRecord {
  id: string;
  date: string; // ISO, when the advice/action happened
  domain: AdviceDomain;
  adviceType: AdviceType;
  /** Short human-readable summary of the problem + chosen action, e.g.
   *  "Категорія 'Одяг' перевищила ліміт на 320₴ — перенесено 320₴ з
   *  'Розваги'." Shown as-is on the Пам'ять асистента screen. */
  summary: string;
  userAction: AdviceUserAction;
  /** The exact tool call that was executed, when userAction is "accepted" —
   *  null for "shown"/"dismissed" records (nothing ran) or for the neutral
   *  "show everything" pick. Lets a genuine past-match proactive card (see
   *  assistant-problem-detectors.ts's findProactiveInsights) literally
   *  repeat the same action rather than re-deriving one. */
  action: { tool: string; input: Record<string, unknown> } | null;
  outcomeCheckedAt: string | null;
  outcomeResult: AdviceOutcome | null;
  /** What assistant-effectiveness.ts needs to recompute a real before/after
   *  number for this specific record — shape depends on adviceType:
   *  budget-limit needs {categoryId, accountId} (spend in that bucket,
   *  7 days before vs 7 days after `date`); risk-limit needs {accountId,
   *  drawdownPctAtAdvice} (current PropAccount.drawdownPct vs its value when
   *  the advice was given). null for calendar-event/automation-rule, which
   *  never get an outcome computed at all. */
  metricRef: { categoryId: string; accountId: string } | { accountId: string; drawdownPctAtAdvice: number } | null;
}

interface AdviceState {
  records: AdviceRecord[];
  addAdvice: (r: Omit<AdviceRecord, "id">) => string;
  updateAdviceOutcome: (id: string, checkedAt: string, result: AdviceOutcome) => void;
}

export const useAdviceStore = create<AdviceState>()(
  persist(
    (set) => ({
      records: [],
      addAdvice: (r) => {
        const id = crypto.randomUUID();
        set((s) => ({ records: [{ ...r, id }, ...s.records] }));
        return id;
      },
      updateAdviceOutcome: (id, checkedAt, result) =>
        set((s) => ({
          records: s.records.map((r) =>
            r.id === id ? { ...r, outcomeCheckedAt: checkedAt, outcomeResult: result } : r
          ),
        })),
    }),
    { name: "life-os-advice" }
  )
);

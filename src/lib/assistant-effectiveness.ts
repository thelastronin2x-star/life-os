"use client";

import { useAdviceStore, type AdviceRecord, type AdviceOutcome } from "./advice-store";
import { useFinanceStore } from "./finance-store";
import { usePropAccountsStore } from "./prop-accounts-store";
import { useAutomationsStore } from "./automations-store";
import { formatDateKey } from "./calendar-utils";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const GRACE_PERIOD_MS = 21 * 24 * 60 * 60 * 1000;

/** null return means "not enough time/data has passed yet — check again
 *  later", distinct from insufficient_data (a terminal "we waited long
 *  enough and there's still nothing to compare" state). */
function checkBudgetLimit(record: AdviceRecord, now: number): AdviceOutcome | null {
  if (!record.metricRef || !("categoryId" in record.metricRef)) return "not_measurable";
  const { categoryId, accountId } = record.metricRef;
  const adviceAt = new Date(record.date).getTime();
  const afterWindowEnd = adviceAt + SEVEN_DAYS_MS;
  if (now < afterWindowEnd) return null;

  const { transactions } = useFinanceStore.getState();
  const inWindow = (from: number, to: number) =>
    transactions
      .filter((t) => t.categoryId === categoryId && t.accountId === accountId && t.type === "expense")
      .filter((t) => {
        const at = new Date(t.date).getTime();
        return at >= from && at < to;
      })
      .reduce((sum, t) => sum + t.amount, 0);

  const before = inWindow(adviceAt - SEVEN_DAYS_MS, adviceAt);
  const after = inWindow(adviceAt, afterWindowEnd);

  if (before === 0) {
    return now - adviceAt >= GRACE_PERIOD_MS ? "insufficient_data" : null;
  }
  return after < before ? "worked" : "not_worked";
}

function checkRiskLimit(record: AdviceRecord, now: number): AdviceOutcome | null {
  const ref = record.metricRef;
  if (!ref || !("drawdownPctAtAdvice" in ref)) return "not_measurable";
  const adviceAt = new Date(record.date).getTime();
  if (now < adviceAt + SEVEN_DAYS_MS) return null;

  const { accounts } = usePropAccountsStore.getState();
  const account = accounts.find((a) => a.id === ref.accountId);
  if (!account) return now - adviceAt >= GRACE_PERIOD_MS ? "insufficient_data" : null;

  return account.drawdownPct <= ref.drawdownPctAtAdvice ? "worked" : "not_worked";
}

/** Opportunistic, app-open-triggered — same "best-effort client-side
 *  substitute for a real cron job" pattern as checkAndGenerateAutoReports in
 *  reports.ts (see layout.tsx, where both are called from the same effect).
 *  Only ever looks at AdviceRecords the user actually accepted — "shown" or
 *  "dismissed" advice was never acted on, so there's nothing to measure. */
export function checkAdviceOutcomes(): void {
  if (!useAutomationsStore.getState().enabled["advice-follow-up"]) return;

  const { records, updateAdviceOutcome } = useAdviceStore.getState();
  const now = Date.now();

  for (const record of records) {
    if (record.userAction !== "accepted" || record.outcomeResult !== null) continue;

    const result =
      record.adviceType === "budget-limit"
        ? checkBudgetLimit(record, now)
        : record.adviceType === "risk-limit"
          ? checkRiskLimit(record, now)
          : "not_measurable";

    if (result !== null) {
      updateAdviceOutcome(record.id, formatDateKey(new Date()), result);
    }
  }
}

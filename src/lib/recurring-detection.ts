import type { Transaction, TxnType } from "./finance-store";
import { formatDateKey } from "./calendar-utils";
import { normalizeMerchantForGrouping } from "./merchant-normalize";

const MIN_OCCURRENCES = 3;
const AMOUNT_TOLERANCE = 0.1; // ±10% of the group's average amount
const MIN_GAP_DAYS = 24;
const MAX_GAP_DAYS = 36;
const NEXT_DATE_OFFSET_DAYS = 30;

export interface DetectedRecurring {
  key: string;
  title: string;
  amount: number;
  type: TxnType;
  accountId: string;
  occurrences: number;
  nextDateEstimate: string; // "YYYY-MM-DD"
}

/** Auto-detects recurring payments instead of relying on the manual
 *  `recurring` field, which bank-imported transactions never set (there's
 *  no such flag in a Monobank statement) — meaning the old field-based
 *  filter left "Регулярні платежі" permanently empty for anyone whose
 *  transactions come from a bank sync rather than manual entry.
 *
 *  A merchant (grouped via normalizeMerchantForGrouping, so different
 *  terminal/store-number suffixes still count as the same place) qualifies
 *  when it has at least 3 occurrences, all within ±10% of the group's
 *  average amount, and every consecutive gap between occurrences falls in a
 *  roughly-monthly 24–36 day window. Returns the most recent occurrence per
 *  qualifying group, sorted by occurrence count (most established first). */
export function detectRecurringTransactions(transactions: Transaction[]): DetectedRecurring[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = normalizeMerchantForGrouping(t.title);
    const existing = groups.get(key);
    if (existing) existing.push(t);
    else groups.set(key, [t]);
  }

  const results: DetectedRecurring[] = [];

  for (const [key, txns] of groups) {
    if (txns.length < MIN_OCCURRENCES) continue;

    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));

    const avgAmount = sorted.reduce((sum, t) => sum + t.amount, 0) / sorted.length;
    if (avgAmount === 0) continue;
    const amountsSimilar = sorted.every((t) => Math.abs(t.amount - avgAmount) / avgAmount <= AMOUNT_TOLERANCE);
    if (!amountsSimilar) continue;

    const gapsAreMonthly = sorted.slice(1).every((t, i) => {
      const prevMs = new Date(sorted[i].date).getTime();
      const curMs = new Date(t.date).getTime();
      const days = (curMs - prevMs) / 86_400_000;
      return days >= MIN_GAP_DAYS && days <= MAX_GAP_DAYS;
    });
    if (!gapsAreMonthly) continue;

    const last = sorted[sorted.length - 1];
    const nextDate = new Date(last.date);
    nextDate.setDate(nextDate.getDate() + NEXT_DATE_OFFSET_DAYS);

    results.push({
      key,
      title: last.title,
      amount: last.amount,
      type: last.type,
      accountId: last.accountId,
      occurrences: sorted.length,
      nextDateEstimate: formatDateKey(nextDate),
    });
  }

  return results.sort((a, b) => b.occurrences - a.occurrences);
}

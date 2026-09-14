"use client";

import { useFinanceStore, type BudgetCategory, type Transaction } from "./finance-store";
import { usePropAccountsStore, type PropAccount } from "./prop-accounts-store";
import { periodStartKey } from "./finance-periods";
import { buildGlobalContext } from "./assistant-context-global";
import type { Profile } from "./store";
import type { AdviceRecord } from "./advice-store";

/** The only two "problem" shapes the dialogue-resolution flow and the
 *  effectiveness check both understand — see advice-store.ts's AdviceType
 *  comment for why the set is deliberately this narrow: both map to a
 *  concrete already-stored limit, so "is there a real problem" and later
 *  "did the fix work" are both measurable on real numbers, never guessed. */

export interface BudgetOverrunFinding {
  domain: "finance";
  adviceType: "budget-limit";
  categoryId: string;
  categoryName: string;
  /** The account whose limitsByAccount entry an option should edit — the
   *  one with the highest configured limit for this category, picked
   *  deterministically when more than one account has a limit set. */
  accountId: string;
  limit: number;
  spent: number;
  overBy: number;
}

export interface RiskNearLimitFinding {
  domain: "work";
  adviceType: "risk-limit";
  accountId: string;
  firm: string;
  drawdownPct: number;
  maxDrawdown: number;
}

// Aggregate limit/spend across every account a category has a limit on —
// matches assistant-context-finance.ts's own overLimitCategoryIds so the
// "over limit" framing here never disagrees with what buildFinanceContext
// already told the model in the same conversation.
export function detectBudgetOverrun(transactions: Transaction[], budgetCategories: BudgetCategory[]): BudgetOverrunFinding[] {
  const monthStart = periodStartKey("Місяць");
  const findings: BudgetOverrunFinding[] = [];

  for (const c of budgetCategories) {
    const entries = Object.entries(c.limitsByAccount).filter(([, limit]) => limit > 0);
    if (entries.length === 0) continue;
    const limit = entries.reduce((sum, [, v]) => sum + v, 0);
    const spent = transactions
      .filter((t) => t.categoryId === c.id && t.type === "expense" && t.date >= monthStart)
      .reduce((sum, t) => sum + t.amount, 0);
    if (spent <= limit) continue;
    const [primaryAccountId] = entries.sort((a, b) => b[1] - a[1])[0];
    findings.push({
      domain: "finance",
      adviceType: "budget-limit",
      categoryId: c.id,
      categoryName: c.name,
      accountId: primaryAccountId,
      limit,
      spent,
      overBy: spent - limit,
    });
  }

  return findings;
}

const RISK_PROXIMITY_RATIO = 0.8;

export function detectRiskNearLimit(accounts: PropAccount[]): RiskNearLimitFinding[] {
  return accounts
    .filter((a) => a.maxDrawdown > 0 && a.drawdownPct >= a.maxDrawdown * RISK_PROXIMITY_RATIO)
    .map((a) => ({
      domain: "work" as const,
      adviceType: "risk-limit" as const,
      accountId: a.id,
      firm: a.firm,
      drawdownPct: a.drawdownPct,
      maxDrawdown: a.maxDrawdown,
    }));
}

/** Per-category this-month spent/limit for every category that HAS a limit
 *  set (not just the over-limit ones) — the model needs visibility into
 *  under-spent categories to pick a real "move budget from X" donor itself,
 *  rather than the app guessing one for it. */
function buildBudgetLedgerText(transactions: Transaction[], budgetCategories: BudgetCategory[]): string {
  const monthStart = periodStartKey("Місяць");
  const lines = budgetCategories
    .map((c) => {
      const limit = Object.values(c.limitsByAccount).reduce((sum, v) => sum + v, 0);
      if (limit <= 0) return null;
      const spent = transactions
        .filter((t) => t.categoryId === c.id && t.type === "expense" && t.date >= monthStart)
        .reduce((sum, t) => sum + t.amount, 0);
      return `${c.name}: ${spent.toFixed(0)} з ${limit.toFixed(0)}${spent > limit ? " (ПЕРЕВИЩЕНО)" : ""}`;
    })
    .filter((l): l is string => l !== null);
  return lines.length > 0 ? `Ліміти категорій цього місяця: ${lines.join("; ")}.` : "Жодна категорія ще не має встановленого ліміту.";
}

function buildRiskLedgerText(accounts: PropAccount[]): string {
  if (accounts.length === 0) return "Проп-акаунтів ще немає.";
  const lines = accounts.map(
    (a) => `${a.firm} (${a.phase}): просадка ${a.drawdownPct}% з ліміту ${a.maxDrawdown}%${a.drawdownPct >= a.maxDrawdown * RISK_PROXIMITY_RATIO ? " (БЛИЗЬКО ДО ЛІМІТУ)" : ""}`
  );
  return `Проп-акаунти: ${lines.join("; ")}.`;
}

/** The context block for the assistant-main scope's chat call — the full
 *  cross-domain picture (reused from Home's own buildGlobalContext) plus the
 *  two measurable ledgers above, so a model deciding whether to call
 *  present_options has real per-category/per-account numbers to reason over
 *  instead of only the aggregate "over limit" summary. */
export interface ProactiveInsight {
  id: string;
  summary: string;
  pastReference: string;
  actionLabel: string;
  action: { tool: string; input: Record<string, unknown> };
}

/** A proactive card only ever exists for a CURRENT finding that also has a
 *  genuine past AdviceRecord where the same adviceType was accepted AND
 *  later confirmed to have worked — no match means no card, per the "never
 *  fabricate a comparison" principle (see advice-store.ts's AdviceType
 *  comment). Repeats the past record's exact action rather than deriving a
 *  new one, so "проактивна" pointing at history and "what actually runs"
 *  never disagree. */
export function findProactiveInsights(records: AdviceRecord[]): ProactiveInsight[] {
  const { transactions, budgetCategories } = useFinanceStore.getState();
  const { accounts } = usePropAccountsStore.getState();
  const insights: ProactiveInsight[] = [];

  const latestWorkedAction = (adviceType: AdviceRecord["adviceType"]) =>
    records
      .filter((r) => r.adviceType === adviceType && r.userAction === "accepted" && r.outcomeResult === "worked" && r.action)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

  for (const finding of detectBudgetOverrun(transactions, budgetCategories)) {
    const past = latestWorkedAction("budget-limit");
    if (!past?.action) continue;
    insights.push({
      id: `budget-${finding.categoryId}`,
      summary: `Категорія "${finding.categoryName}" знову перевищила ліміт — на ${finding.overBy.toFixed(0)}.`,
      pastReference: `${new Date(past.date).toLocaleDateString("uk-UA")}: ${past.summary}`,
      actionLabel: "Повторити ту саму дію",
      action: past.action,
    });
  }

  for (const finding of detectRiskNearLimit(accounts)) {
    const past = latestWorkedAction("risk-limit");
    if (!past?.action) continue;
    insights.push({
      id: `risk-${finding.accountId}`,
      summary: `Акаунт "${finding.firm}" знову близько до ліміту просадки — ${finding.drawdownPct}% з ${finding.maxDrawdown}%.`,
      pastReference: `${new Date(past.date).toLocaleDateString("uk-UA")}: ${past.summary}`,
      actionLabel: "Повторити ту саму дію",
      action: past.action,
    });
  }

  return insights;
}

export function buildAssistantMainContext(profile: Profile): string {
  const { transactions, budgetCategories } = useFinanceStore.getState();
  const { accounts } = usePropAccountsStore.getState();
  return [
    buildGlobalContext(profile),
    `=== Деталі лімітів (для конкретних пропозицій) ===\n${buildBudgetLedgerText(transactions, budgetCategories)}\n${buildRiskLedgerText(accounts)}`,
  ].join("\n\n");
}

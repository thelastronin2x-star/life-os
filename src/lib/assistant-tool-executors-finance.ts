"use client";

import { useFinanceStore } from "./finance-store";
import { FINANCE_CATEGORIES, type FinanceCategoryKey } from "./finance-categories";

/** Own file, same "use client" + getState() pattern as the other scoped
 *  executors — see assistant-tool-executors-calendar.ts for why the split
 *  matters. Finance has no MiniContext bubble of its own; these are only
 *  ever called from the assistant-main dialogue flow (see
 *  /assistant/page.tsx), either directly after a tap on an OptionsCard
 *  action, or after a free-text selection resolves to one. */

/** Picks the account a category's limit should be read/written on when the
 *  caller doesn't name one explicitly — the entry with the highest existing
 *  limit, or the store's first account if the category has none yet.
 *  Mirrors assistant-problem-detectors.ts's own "primary account" choice so
 *  a tool call referencing a category the detector just flagged lands on
 *  the same account the problem was computed against. */
function resolveAccountId(categoryLimits: Record<string, number>): string | null {
  const entries = Object.entries(categoryLimits).filter(([, limit]) => limit > 0);
  if (entries.length > 0) return entries.sort((a, b) => b[1] - a[1])[0][0];
  const { accounts } = useFinanceStore.getState();
  return accounts[0]?.id ?? null;
}

export function executeFinanceTool(name: string, input: Record<string, unknown>): string {
  const store = useFinanceStore.getState();

  if (name === "update_budget_limit") {
    const categoryName = String(input.categoryName ?? "").trim();
    const newLimit = Number(input.newLimit);
    if (!categoryName || !Number.isFinite(newLimit) || newLimit < 0) return "Не вистачає назви категорії або коректного ліміту.";
    const category = store.budgetCategories.find((c) => c.name === categoryName);
    if (!category) return `Категорію "${categoryName}" не знайдено.`;
    const accountId = resolveAccountId(category.limitsByAccount);
    if (!accountId) return "Немає жодного рахунку, щоб встановити ліміт.";
    store.updateBudgetCategory(category.id, { limitsByAccount: { ...category.limitsByAccount, [accountId]: newLimit } });
    return `Ліміт категорії "${categoryName}" змінено на ${newLimit.toFixed(0)}.`;
  }

  if (name === "move_budget") {
    const fromName = String(input.fromCategoryName ?? "").trim();
    const toName = String(input.toCategoryName ?? "").trim();
    const amount = Number(input.amount);
    if (!fromName || !toName || !Number.isFinite(amount) || amount <= 0) return "Не вистачає категорій або суми перенесення.";
    const from = store.budgetCategories.find((c) => c.name === fromName);
    const to = store.budgetCategories.find((c) => c.name === toName);
    if (!from || !to) return `Категорію "${!from ? fromName : toName}" не знайдено.`;
    const fromAccountId = resolveAccountId(from.limitsByAccount);
    const toAccountId = resolveAccountId(to.limitsByAccount) ?? fromAccountId;
    if (!fromAccountId || !toAccountId) return "Немає жодного рахунку, щоб перенести ліміт.";
    const fromNewLimit = Math.max(0, (from.limitsByAccount[fromAccountId] ?? 0) - amount);
    const toNewLimit = (to.limitsByAccount[toAccountId] ?? 0) + amount;
    store.updateBudgetCategory(from.id, { limitsByAccount: { ...from.limitsByAccount, [fromAccountId]: fromNewLimit } });
    store.updateBudgetCategory(to.id, { limitsByAccount: { ...to.limitsByAccount, [toAccountId]: toNewLimit } });
    return `Перенесено ${amount.toFixed(0)} з "${fromName}" (тепер ліміт ${fromNewLimit.toFixed(0)}) в "${toName}" (тепер ліміт ${toNewLimit.toFixed(0)}).`;
  }

  if (name === "create_budget_category") {
    const key = String(input.categoryKey ?? "") as FinanceCategoryKey;
    const meta = FINANCE_CATEGORIES[key];
    const limit = Number(input.limit);
    if (!meta || !Number.isFinite(limit) || limit < 0) return "Не вистачає коректної категорії або ліміту.";
    const accountId = store.accounts[0]?.id;
    if (!accountId) return "Немає жодного рахунку, щоб створити категорію з лімітом.";
    store.addBudgetCategory({ name: meta.name, icon: key, color: meta.color, limitsByAccount: { [accountId]: limit } });
    return `Створено категорію "${meta.name}" з лімітом ${limit.toFixed(0)}.`;
  }

  return `Невідомий інструмент: ${name}.`;
}

"use client";

import { useState } from "react";
import { NumberInput } from "@/components/ui/NumberInput";
import type { BudgetCategory, FinanceAccount, GoalColor } from "@/lib/finance-store";
import { CATEGORY_ICON_OPTIONS } from "@/lib/category-icons";
import { cn } from "@/lib/cn";

const COLORS: GoalColor[] = ["sage", "sky", "gold", "clay", "rose"];

export function BudgetCategoryForm({
  editingCategory,
  accounts,
  currentAccountId,
  onSave,
  onClose,
  onDelete,
}: {
  editingCategory: BudgetCategory | null;
  accounts: FinanceAccount[];
  /** The card currently selected on Огляд, if any — featured as the primary
   *  limit field so editing "this card's limit" never requires opening the
   *  full per-account list. */
  currentAccountId: string | null;
  onSave: (data: Omit<BudgetCategory, "id">) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const [name, setName] = useState(editingCategory?.name ?? "");
  const [icon, setIcon] = useState(editingCategory?.icon ?? CATEGORY_ICON_OPTIONS[0].id);
  const [color, setColor] = useState<GoalColor>(editingCategory?.color ?? "sage");
  const [limitsByAccount, setLimitsByAccount] = useState<Record<string, number>>(
    editingCategory?.limitsByAccount ?? {}
  );
  const [showAllLimits, setShowAllLimits] = useState(currentAccountId === null);

  const currentAccount = accounts.find((a) => a.id === currentAccountId) ?? null;
  const otherAccounts = accounts.filter((a) => a.id !== currentAccountId);

  function setLimitFor(accountId: string, value: number) {
    setLimitsByAccount((prev) => {
      // Drop zero entries rather than storing an explicit 0 — "no limit set"
      // and "limit of 0" must stay distinguishable (see finance-scope.ts).
      if (value <= 0) {
        const rest = { ...prev };
        delete rest[accountId];
        return rest;
      }
      return { ...prev, [accountId]: value };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), icon, color, limitsByAccount });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">
            {editingCategory ? "Редагувати категорію" : "Нова категорія"}
          </div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input
            type="text"
            placeholder="Назва (напр. Їжа)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-[13px] text-text outline-none"
          />

          <div>
            <span className="mb-1.5 block text-[10.5px] font-semibold text-text-dim">Іконка</span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setIcon(opt.id)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-[10px] border",
                    icon === opt.id ? "border-sage bg-sage/15 text-sage" : "border-border bg-surface-2 text-text-dim"
                  )}
                >
                  <opt.Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-[10.5px] font-semibold text-text-dim">Колір</span>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2",
                    color === c ? "border-text" : "border-transparent"
                  )}
                  style={{ background: `var(--${c})` }}
                />
              ))}
            </div>
          </div>

          {currentAccount ? (
            <label className="block">
              <span className="mb-1 block text-[9.5px] uppercase text-text-faint">
                Ліміт на місяць — {currentAccount.name}
              </span>
              <NumberInput
                value={limitsByAccount[currentAccount.id] ?? 0}
                onChange={(v) => setLimitFor(currentAccount.id, v)}
                className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
              />
            </label>
          ) : (
            accounts.length > 0 && (
              <div className="text-[10.5px] text-text-faint">
                Обери конкретний рахунок на Огляді, щоб редагувати його ліміт як основний — нижче можна задати ліміти для всіх рахунків одразу.
              </div>
            )
          )}

          {otherAccounts.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowAllLimits((v) => !v)}
                className="flex w-full items-center justify-between py-1 text-[10.5px] font-semibold text-text-dim"
              >
                <span>Ліміти по всіх рахунках</span>
                <span>{showAllLimits ? "▲" : "▼"}</span>
              </button>
              {showAllLimits && (
                <div className="space-y-2 pt-1">
                  {(currentAccount ? otherAccounts : accounts).map((acc) => (
                    <label key={acc.id} className="block">
                      <span className="mb-1 block text-[9.5px] uppercase text-text-faint">{acc.name}</span>
                      <NumberInput
                        value={limitsByAccount[acc.id] ?? 0}
                        onChange={(v) => setLimitFor(acc.id, v)}
                        className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
          >
            Зберегти
          </button>

          {editingCategory && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(editingCategory.id)}
              className="w-full rounded-btn border border-rose/30 py-2.5 text-center text-[12.5px] font-semibold text-rose"
            >
              Видалити
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

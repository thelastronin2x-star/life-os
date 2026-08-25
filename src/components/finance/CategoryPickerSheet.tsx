"use client";

import { useState } from "react";
import type { BudgetCategory, GoalColor } from "@/lib/finance-store";
import { FINANCE_CATEGORY_KEYS, categoryMeta, CategoryIcon, type FinanceCategoryKey } from "@/lib/finance-categories";
import { PlusIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const COLORS: GoalColor[] = ["sage", "sky", "gold", "clay", "rose"];

export function CategoryPickerSheet({
  categories,
  value,
  onSelect,
  onCreate,
  onClose,
}: {
  categories: BudgetCategory[];
  value: string | null;
  onSelect: (id: string) => void;
  onCreate: (data: Omit<BudgetCategory, "id">) => string;
  onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [categoryKey, setCategoryKey] = useState<FinanceCategoryKey>(FINANCE_CATEGORY_KEYS[0]);
  const [color, setColor] = useState<GoalColor>(categoryMeta(FINANCE_CATEGORY_KEYS[0]).color);

  // Categories already tracked don't need to be offered again — picking one
  // that already exists belongs to the "select" grid above, not "create".
  const usedKeys = new Set(categories.map((c) => c.icon));
  const availableKeys = FINANCE_CATEGORY_KEYS.filter((k) => !usedKeys.has(k));

  function handleCreate() {
    // No limit on any account by default — a quick-created category starts
    // unlimited until the user explicitly sets one via BudgetCategoryForm,
    // rather than silently inheriting an arbitrary guessed number.
    onCreate({ name: categoryMeta(categoryKey).name, icon: categoryKey, color, limitsByAccount: {} });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">Оберіть категорію</div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        <div className="mb-1.5 grid grid-cols-4 gap-2.5">
          {categories.map((cat) => {
            const active = value === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  onSelect(cat.id);
                  onClose();
                }}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-card-sm p-3 text-center",
                  active && "bg-surface shadow-card"
                )}
              >
                <CategoryIcon categoryKey={cat.icon} color={cat.color} className="h-9 w-9 rounded-full" />
                <div className="text-[9.5px] text-text-dim">{cat.name}</div>
              </button>
            );
          })}
        </div>

        {!creating ? (
          availableKeys.length > 0 && (
            <button
              onClick={() => {
                setCategoryKey(availableKeys[0]);
                setColor(categoryMeta(availableKeys[0]).color);
                setCreating(true);
              }}
              className="mt-2 flex w-full items-center gap-2.5 border-t border-border py-3.5 text-left"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm border-[1.5px] border-dashed border-border text-sage">
                <PlusIcon className="h-3.5 w-3.5" />
              </span>
              <span className="text-[13px] font-semibold text-sage">Додати категорію</span>
            </button>
          )
        ) : (
          <div className="mt-3 border-t border-border pt-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
              Нова категорія
            </div>
            <div className="mb-3.5 grid grid-cols-4 gap-1.5">
              {availableKeys.map((key) => {
                const meta = categoryMeta(key);
                const active = categoryKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setCategoryKey(key);
                      setColor(meta.color);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-card-sm border-2 p-2 text-center",
                      active ? "border-sage" : "border-transparent bg-surface-2"
                    )}
                  >
                    <CategoryIcon categoryKey={key} color={meta.color} className="h-8 w-8 rounded-full" />
                    <span className="truncate text-[9px] font-medium text-text-dim">{meta.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="mb-1.5 text-[10px] text-text-faint">Колір</div>
            <div className="mb-4 flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2",
                    color === c ? "border-text" : "border-transparent"
                  )}
                  style={{ background: `var(--${c})` }}
                />
              ))}
            </div>
            <button
              onClick={handleCreate}
              className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
            >
              Додати категорію
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

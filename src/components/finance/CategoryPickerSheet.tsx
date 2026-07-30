"use client";

import { useState } from "react";
import type { BudgetCategory, GoalColor } from "@/lib/finance-store";
import { CATEGORY_ICON_OPTIONS, getCategoryIcon } from "@/lib/category-icons";
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
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(CATEGORY_ICON_OPTIONS[0].id);
  const [color, setColor] = useState<GoalColor>("sage");

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    // No limit on any account by default — a quick-created category starts
    // unlimited until the user explicitly sets one via BudgetCategoryForm,
    // rather than silently inheriting an arbitrary guessed number.
    onCreate({ name: trimmed, icon, color, limitsByAccount: {} });
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
            const CatIcon = getCategoryIcon(cat.icon);
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
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-card-sm"
                  style={{ background: `color-mix(in srgb, var(--${cat.color}) 15%, transparent)` }}
                >
                  <CatIcon className="h-4 w-4" style={{ color: `var(--${cat.color})` }} />
                </div>
                <div className="text-[9.5px] text-text-dim">{cat.name}</div>
              </button>
            );
          })}
        </div>

        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="mt-2 flex w-full items-center gap-2.5 border-t border-border py-3.5 text-left"
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm border-[1.5px] border-dashed border-border text-sage">
              <PlusIcon className="h-3.5 w-3.5" />
            </span>
            <span className="text-[13px] font-semibold text-sage">Додати свою категорію</span>
          </button>
        ) : (
          <div className="mt-3 border-t border-border pt-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
              Нова категорія
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Назва (напр. Спортзал)"
              className="mb-3.5 w-full rounded-input border border-border bg-surface-2 px-3.5 py-3 text-[14px] text-text outline-none"
            />
            <div className="mb-1.5 text-[10px] text-text-faint">Іконка</div>
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              {CATEGORY_ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setIcon(opt.id)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-card-sm border-2",
                    icon === opt.id ? "border-sage" : "border-transparent bg-surface-2"
                  )}
                >
                  <opt.Icon className="h-4 w-4 text-text-dim" />
                </button>
              ))}
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
              Створити категорію
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { NumberInput } from "@/components/ui/NumberInput";
import type { FinancialGoal } from "@/lib/finance-store";
import { validateGoal } from "@/lib/goal-validation";

export function GoalForm({
  editingGoal,
  onSave,
  onClose,
  onDelete,
}: {
  editingGoal: FinancialGoal | null;
  onSave: (data: Omit<FinancialGoal, "id">) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const [name, setName] = useState(editingGoal?.name ?? "");
  const [targetAmount, setTargetAmount] = useState(editingGoal?.targetAmount ?? 10000);
  const [currentAmount, setCurrentAmount] = useState(editingGoal?.currentAmount ?? 0);
  const [targetDate, setTargetDate] = useState(editingGoal?.targetDate ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const validationError = validateGoal(targetAmount, currentAmount);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSave({
      name: name.trim(),
      targetAmount,
      currentAmount,
      ...(targetDate ? { targetDate } : {}),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">
            {editingGoal ? "Редагувати ціль" : "Нова ціль"}
          </div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input
            type="text"
            placeholder="Назва цілі (напр. Відпустка)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-[13px] text-text outline-none"
          />

          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Ціль (₴)</span>
              <NumberInput
                value={targetAmount}
                onChange={setTargetAmount}
                className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
              />
            </label>
            <label className="block flex-1">
              <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Вже накопичено (₴)</span>
              <NumberInput
                value={currentAmount}
                onChange={setCurrentAmount}
                className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Орієнтовна дата (необов&apos;язково)</span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-[12px] text-text outline-none"
            />
          </label>

          {error && <div className="text-[11.5px] text-rose">{error}</div>}

          <button
            type="submit"
            className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
          >
            Зберегти
          </button>

          {editingGoal && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(editingGoal.id)}
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

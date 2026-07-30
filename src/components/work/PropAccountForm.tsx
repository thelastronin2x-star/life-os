"use client";

import { useState } from "react";
import { NumberInput } from "@/components/ui/NumberInput";
import type { PropAccount } from "@/lib/prop-accounts-store";

export function PropAccountForm({
  editingAccount,
  onSave,
  onClose,
  onDelete,
}: {
  editingAccount: PropAccount | null;
  onSave: (data: Omit<PropAccount, "id">) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const [firm, setFirm] = useState(editingAccount?.firm ?? "");
  const [phase, setPhase] = useState(editingAccount?.phase ?? "Challenge Phase 1");
  const [profitPct, setProfitPct] = useState(editingAccount?.profitPct ?? 0);
  const [profitTarget, setProfitTarget] = useState(editingAccount?.profitTarget ?? 10);
  const [drawdownPct, setDrawdownPct] = useState(editingAccount?.drawdownPct ?? 0);
  const [maxDrawdown, setMaxDrawdown] = useState(editingAccount?.maxDrawdown ?? 10);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firm.trim()) return;
    onSave({ firm: firm.trim(), phase: phase.trim(), profitPct, profitTarget, drawdownPct, maxDrawdown });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">
            {editingAccount ? "Редагувати акаунт" : "Новий prop-акаунт"}
          </div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input
            type="text"
            placeholder="Фірма (напр. FundingPips)"
            value={firm}
            onChange={(e) => setFirm(e.target.value)}
            required
            className="w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-[13px] text-text outline-none"
          />
          <input
            type="text"
            placeholder="Фаза (напр. Challenge Phase 1)"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            className="w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-[13px] text-text outline-none"
          />

          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Profit %</span>
              <NumberInput
                value={profitPct}
                onChange={setProfitPct}
                className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
              />
            </label>
            <label className="block flex-1">
              <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Target %</span>
              <NumberInput
                value={profitTarget}
                onChange={setProfitTarget}
                className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="mb-1 block text-[9.5px] uppercase text-text-faint">
                Drawdown %
              </span>
              <NumberInput
                value={drawdownPct}
                onChange={setDrawdownPct}
                className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
              />
            </label>
            <label className="block flex-1">
              <span className="mb-1 block text-[9.5px] uppercase text-text-faint">
                Max drawdown %
              </span>
              <NumberInput
                value={maxDrawdown}
                onChange={setMaxDrawdown}
                className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
              />
            </label>
          </div>

          <button
            type="submit"
            className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
          >
            Зберегти
          </button>

          {editingAccount && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(editingAccount.id)}
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

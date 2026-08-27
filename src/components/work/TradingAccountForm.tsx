"use client";

import { useState } from "react";
import { NumberInput } from "@/components/ui/NumberInput";
import { cn } from "@/lib/cn";
import type { PersonalTradingAccount } from "@/lib/personal-trading-accounts-store";
import type { PropAccount } from "@/lib/prop-accounts-store";

type Kind = "personal" | "prop";

export function TradingAccountForm({
  editingAccount,
  onSavePersonal,
  onSaveProp,
  onClose,
  onDelete,
}: {
  /** Only personal accounts are editable here — prop accounts already have
   *  a full edit/delete experience at /work/prop-accounts (profitPct/
   *  drawdownPct progress fields this quick-add modal never had), so
   *  duplicating that here would just be a second, incomplete copy. */
  editingAccount?: PersonalTradingAccount | null;
  onSavePersonal: (data: Omit<PersonalTradingAccount, "id">) => void;
  onSaveProp: (data: Omit<PropAccount, "id">) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const [kind, setKind] = useState<Kind>("personal");

  const [name, setName] = useState(editingAccount?.name ?? "");
  const [startingDeposit, setStartingDeposit] = useState(editingAccount?.startingDeposit ?? 1000);

  const [firm, setFirm] = useState("");
  const [phase, setPhase] = useState("Challenge Phase 1");
  const [profitTarget, setProfitTarget] = useState(10);
  const [maxDrawdown, setMaxDrawdown] = useState(10);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "personal") {
      if (!name.trim()) return;
      onSavePersonal({ name: name.trim(), startingDeposit });
    } else {
      if (!firm.trim()) return;
      onSaveProp({ firm: firm.trim(), phase: phase.trim(), profitPct: 0, profitTarget, drawdownPct: 0, maxDrawdown });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">
            {editingAccount ? "Редагувати рахунок" : "Новий рахунок"}
          </div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        {!editingAccount && (
          <div className="mb-3 flex rounded-btn bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setKind("personal")}
              className={cn(
                "flex-1 rounded-btn py-2 text-center text-xs font-semibold",
                kind === "personal" ? "bg-surface text-text shadow-card" : "text-text-dim"
              )}
            >
              Особистий
            </button>
            <button
              type="button"
              onClick={() => setKind("prop")}
              className={cn(
                "flex-1 rounded-btn py-2 text-center text-xs font-semibold",
                kind === "prop" ? "bg-surface text-text shadow-card" : "text-text-dim"
              )}
            >
              Prop-firm
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2.5">
          {kind === "personal" ? (
            <>
              <input
                type="text"
                placeholder="Назва (напр. Мій депозит)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-[13px] text-text outline-none"
              />
              <label className="block">
                <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Стартовий депозит</span>
                <NumberInput
                  value={startingDeposit}
                  onChange={setStartingDeposit}
                  className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
                />
              </label>
            </>
          ) : (
            <>
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
                  <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Target %</span>
                  <NumberInput
                    value={profitTarget}
                    onChange={setProfitTarget}
                    className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
                  />
                </label>
                <label className="block flex-1">
                  <span className="mb-1 block text-[9.5px] uppercase text-text-faint">
                    Ліміт просадки %
                  </span>
                  <NumberInput
                    value={maxDrawdown}
                    onChange={setMaxDrawdown}
                    className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
                  />
                </label>
              </div>
            </>
          )}

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
              Видалити рахунок
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

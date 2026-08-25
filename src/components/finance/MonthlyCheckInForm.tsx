"use client";

import { useState } from "react";
import { NumberInput } from "@/components/ui/NumberInput";
import { cn } from "@/lib/cn";

const STEP = 1000;

function FieldRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - STEP))}
        className="h-9 w-[46px] flex-shrink-0 rounded-input bg-surface-2 text-[12px] font-extrabold text-accent"
      >
        −{STEP}
      </button>
      <NumberInput
        value={value}
        onChange={onChange}
        className="w-full flex-1 rounded-input border border-border bg-surface-2 px-3 py-2.5 text-center font-mono text-[13px] font-semibold text-text outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + STEP)}
        className="h-9 w-[46px] flex-shrink-0 rounded-input bg-surface-2 text-[12px] font-extrabold text-accent"
      >
        +{STEP}
      </button>
    </div>
  );
}

/** The month's central data-entry point — see finance-store.ts's own doc
 *  comment on MonthlyCheckIn. Three numbers, nothing else: investmentsTotal/
 *  debtsTotal are captured automatically from the live Investment[]/Debt[]
 *  arrays when this saves (see upsertCheckIn), not asked here again.
 *
 *  Pre-filled from the previous check-in (whatever `initial` the caller
 *  passes in — FinanceOverview resolves that to the latest known snapshot)
 *  plus a ±1000 stepper next to every field, rather than three blank
 *  inputs every month — most months' numbers are close to last month's,
 *  so "adjust what changed" is a lot less friction than "retype everything". */
export function MonthlyCheckInForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: { savings: number; monthlyIncome: number; monthlyExpenses: number };
  onSave: (data: { savings: number; monthlyIncome: number; monthlyExpenses: number }) => void;
  onClose: () => void;
}) {
  const [savings, setSavings] = useState(initial?.savings ?? 0);
  const [monthlyIncome, setMonthlyIncome] = useState(initial?.monthlyIncome ?? 0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(initial?.monthlyExpenses ?? 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ savings, monthlyIncome, monthlyExpenses });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-1 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">Місячний чек-ін</div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>
        {initial && (
          <div className="mb-3.5 text-[11px] leading-snug text-text-faint">
            Значення підставлені з минулого місяця — просто зміни, що змінилось
          </div>
        )}

        <form onSubmit={handleSubmit} className={cn("space-y-3", !initial && "mt-3.5")}>
          <label className="block">
            <span className="mb-1.5 block text-[9.5px] uppercase text-text-faint">Поточні заощадження</span>
            <FieldRow value={savings} onChange={setSavings} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[9.5px] uppercase text-text-faint">Дохід за місяць</span>
            <FieldRow value={monthlyIncome} onChange={setMonthlyIncome} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[9.5px] uppercase text-text-faint">Витрати за місяць</span>
            <FieldRow value={monthlyExpenses} onChange={setMonthlyExpenses} />
          </label>

          <button
            type="submit"
            className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
          >
            Зберегти чек-ін
          </button>
        </form>
      </div>
    </div>
  );
}

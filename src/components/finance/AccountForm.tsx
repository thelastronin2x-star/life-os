"use client";

import { useState } from "react";
import { NumberInput } from "@/components/ui/NumberInput";
import type { AccountType, FinanceAccount } from "@/lib/finance-store";
import { cn } from "@/lib/cn";

const ACCOUNT_TYPES: { id: AccountType; label: string }[] = [
  { id: "personal", label: "Особистий" },
  { id: "prop", label: "Prop" },
  { id: "savings", label: "Заощадження" },
];

const CURRENCY_SYMBOLS = ["₴", "$", "€"];

export function AccountForm({
  editingAccount,
  onSave,
  onClose,
  onDelete,
}: {
  editingAccount: FinanceAccount | null;
  onSave: (data: Omit<FinanceAccount, "id">) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const [name, setName] = useState(editingAccount?.name ?? "");
  const [type, setType] = useState<AccountType>(editingAccount?.type ?? "personal");
  const [currencySymbol, setCurrencySymbol] = useState(editingAccount?.currencySymbol ?? "₴");
  const [startingBalance, setStartingBalance] = useState(editingAccount?.startingBalance ?? 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), type, currencySymbol, startingBalance });
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

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input
            type="text"
            placeholder="Назва (напр. Особистий)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-[13px] text-text outline-none"
          />

          <div>
            <span className="mb-1.5 block text-[10.5px] font-semibold text-text-dim">Тип</span>
            <div className="flex rounded-btn bg-surface-2 p-1">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={cn(
                    "flex-1 rounded-btn py-2 text-center text-xs font-semibold",
                    type === t.id ? "bg-surface text-text shadow-card" : "text-text-dim"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-shrink-0">
              <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Валюта</span>
              <div className="flex gap-1">
                {CURRENCY_SYMBOLS.map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => setCurrencySymbol(sym)}
                    className={cn(
                      "h-9 w-9 rounded-icon border text-[13px] font-semibold",
                      currencySymbol === sym
                        ? "border-sage bg-sage/15 text-sage"
                        : "border-border bg-surface-2 text-text-dim"
                    )}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
            <label className="block flex-1">
              <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Стартовий баланс</span>
              <NumberInput
                value={startingBalance}
                onChange={setStartingBalance}
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

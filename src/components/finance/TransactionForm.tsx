"use client";

import { useRef, useState } from "react";
import { NumberInput } from "@/components/ui/NumberInput";
import type { BudgetCategory, FinanceAccount, Transaction, TxnType } from "@/lib/finance-store";
import { useFinanceStore } from "@/lib/finance-store";
import { formatDateKey } from "@/lib/calendar-utils";
import { getCategoryIcon } from "@/lib/category-icons";
import { CategoryPickerSheet } from "./CategoryPickerSheet";
import { WalletIcon, CalendarDateIcon, RefreshIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

function formatRowDate(dateKey: string): string {
  const todayKey = formatDateKey(new Date());
  if (dateKey === todayKey) return "Сьогодні";
  const d = new Date(dateKey);
  return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
}

export function TransactionForm({
  categories,
  accounts,
  editingTxn,
  onSave,
  onClose,
  onDelete,
}: {
  categories: BudgetCategory[];
  accounts: FinanceAccount[];
  editingTxn: Transaction | null;
  onSave: (data: Omit<Transaction, "id">) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const addBudgetCategory = useFinanceStore((s) => s.addBudgetCategory);

  const [type, setType] = useState<TxnType>(editingTxn?.type ?? "expense");
  const [title, setTitle] = useState(editingTxn?.title ?? "");
  const [amount, setAmount] = useState(editingTxn?.amount ?? 0);
  // Only default to the first category for a BRAND NEW transaction. When
  // editing an existing one, respect its actual categoryId as-is — including
  // null (uncategorized) — otherwise opening an uncategorized transaction to
  // fix something unrelated (the amount, say) silently assigns and "learns"
  // whatever category happens to be first in the list.
  const [categoryId, setCategoryId] = useState<string | null>(
    editingTxn ? editingTxn.categoryId : (categories[0]?.id ?? null)
  );
  const [accountId, setAccountId] = useState(editingTxn?.accountId ?? accounts[0]?.id ?? "");
  const [transferAccountId, setTransferAccountId] = useState(
    editingTxn?.transferAccountId ?? accounts.find((a) => a.id !== (editingTxn?.accountId ?? accounts[0]?.id))?.id ?? ""
  );
  const [date, setDate] = useState(editingTxn?.date ?? formatDateKey(new Date()));
  const [recurring, setRecurring] = useState(!!editingTxn?.recurring);
  const [frequency, setFrequency] = useState<"weekly" | "monthly">(editingTxn?.recurring?.frequency ?? "monthly");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  const dateInputRef = useRef<HTMLInputElement>(null);
  const accountSelectRef = useRef<HTMLSelectElement>(null);
  const transferAccountSelectRef = useRef<HTMLSelectElement>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedCategoryIcon = selectedCategory
    ? getCategoryIcon(selectedCategory.icon)({ className: "h-4 w-4" })
    : <WalletIcon className="h-4 w-4" />;
  const selectedAccount = accounts.find((a) => a.id === accountId);

  const destinationAccounts = accounts.filter((a) => a.id !== accountId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !accountId) return;
    if (type === "transfer" && (!transferAccountId || transferAccountId === accountId)) return;
    onSave({
      type,
      title: title.trim(),
      amount,
      categoryId: type === "expense" ? categoryId : null,
      accountId,
      transferAccountId: type === "transfer" ? transferAccountId : undefined,
      date,
      recurring: recurring
        ? {
            frequency,
            nextDate: formatDateKey(
              new Date(Date.now() + (frequency === "weekly" ? 7 : 30) * 86400000)
            ),
          }
        : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">
            {editingTxn ? "Редагувати транзакцію" : "Нова транзакція"}
          </div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        <div className="mb-1 flex justify-center">
          <div className="flex rounded-btn bg-surface p-1">
            {(["expense", "income", "transfer"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "rounded-btn px-4 py-1.5 text-center text-[11.5px] font-semibold",
                  type === t
                    ? t === "expense"
                      ? "bg-surface-2 text-clay"
                      : t === "income"
                        ? "bg-surface-2 text-sage"
                        : "bg-surface-2 text-sky"
                    : "text-text-faint"
                )}
              >
                {t === "expense" ? "Витрата" : t === "income" ? "Дохід" : "Переказ"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-1 py-4">
          <NumberInput
            value={amount}
            onChange={setAmount}
            className={cn(
              "w-32 bg-transparent text-center font-mono text-[38px] font-bold outline-none",
              type === "expense" ? "text-clay" : type === "income" ? "text-sage" : "text-sky"
            )}
          />
          <span className="text-[15px] text-text-faint">₴</span>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Назва"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mb-1 w-full rounded-input border border-border bg-surface-2 px-3.5 py-2.5 text-[13.5px] text-text outline-none"
          />

          <div className="flex flex-col">
            {type === "expense" && (
              <button
                type="button"
                onClick={() => setCategoryPickerOpen(true)}
                className="flex w-full items-center gap-3 border-b border-border py-3.5 text-left"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface text-text-dim">
                  {selectedCategoryIcon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] uppercase tracking-wide text-text-faint">Категорія</span>
                  <span className="block text-[13.5px] font-medium text-text">
                    {selectedCategory?.name ?? "Обрати категорію"}
                  </span>
                </span>
                <span className="text-text-faint">›</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => accountSelectRef.current?.showPicker?.() ?? accountSelectRef.current?.focus()}
              className="relative flex w-full items-center gap-3 border-b border-border py-3.5 text-left"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface text-text-dim">
                <WalletIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase tracking-wide text-text-faint">
                  {type === "transfer" ? "Рахунок-джерело" : "Рахунок"}
                </span>
                <span className="block text-[13.5px] font-medium text-text">
                  {selectedAccount?.name ?? "Немає рахунків"}
                </span>
              </span>
              <span className="text-text-faint">›</span>
              <select
                ref={accountSelectRef}
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  if (e.target.value === transferAccountId) {
                    setTransferAccountId(accounts.find((a) => a.id !== e.target.value)?.id ?? "");
                  }
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </button>

            {type === "transfer" && (
              <button
                type="button"
                onClick={() =>
                  transferAccountSelectRef.current?.showPicker?.() ?? transferAccountSelectRef.current?.focus()
                }
                className="relative flex w-full items-center gap-3 border-b border-border py-3.5 text-left"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface text-text-dim">
                  <WalletIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] uppercase tracking-wide text-text-faint">Рахунок-призначення</span>
                  <span className="block text-[13.5px] font-medium text-text">
                    {destinationAccounts.find((a) => a.id === transferAccountId)?.name ?? "Обрати рахунок"}
                  </span>
                </span>
                <span className="text-text-faint">›</span>
                <select
                  ref={transferAccountSelectRef}
                  value={transferAccountId}
                  onChange={(e) => setTransferAccountId(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                >
                  {destinationAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </button>
            )}

            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.focus()}
              className="relative flex w-full items-center gap-3 border-b border-border py-3.5 text-left"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface text-text-dim">
                <CalendarDateIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase tracking-wide text-text-faint">Дата</span>
                <span className="block text-[13.5px] font-medium text-text">{formatRowDate(date)}</span>
              </span>
              <span className="text-text-faint">›</span>
              <input
                ref={dateInputRef}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </button>

            <div className="flex w-full items-center gap-3 py-3.5">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface text-text-dim">
                <RefreshIcon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-[13.5px] font-medium text-text">Повторювана транзакція</span>
              <button
                type="button"
                onClick={() => setRecurring((v) => !v)}
                className={cn(
                  "relative h-5 w-9 flex-shrink-0 rounded-full transition-colors",
                  recurring ? "bg-sage" : "bg-surface-2"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-text transition-all",
                    recurring ? "left-[18px] bg-bg" : "left-0.5"
                  )}
                />
              </button>
            </div>
          </div>

          {recurring && (
            <div className="mt-2 flex rounded-btn bg-surface p-1">
              {(["weekly", "monthly"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={cn(
                    "flex-1 rounded-btn py-2 text-center text-xs font-semibold",
                    frequency === f ? "bg-surface-2 text-text" : "text-text-faint"
                  )}
                >
                  {f === "weekly" ? "Щотижня" : "Щомісяця"}
                </button>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="mt-4 w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
          >
            Зберегти транзакцію
          </button>

          {editingTxn && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(editingTxn.id)}
              className="mt-2 w-full rounded-btn border border-rose/30 py-2.5 text-center text-[12.5px] font-semibold text-rose"
            >
              Видалити
            </button>
          )}
        </form>
      </div>

      {categoryPickerOpen && (
        <CategoryPickerSheet
          categories={categories}
          value={categoryId}
          onSelect={setCategoryId}
          onCreate={(data) => {
            const id = addBudgetCategory(data);
            setCategoryId(id);
            return id;
          }}
          onClose={() => setCategoryPickerOpen(false)}
        />
      )}
    </div>
  );
}

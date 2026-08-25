"use client";

import { useMemo, useState } from "react";
import { FinanceSubpageHeader } from "@/components/finance/FinanceSubpageHeader";
import { useFinanceStore, type FinanceAccount } from "@/lib/finance-store";
import { computeFinanceScope } from "@/lib/finance-scope";
import { useFinanceScope } from "@/lib/finance-scope-store";
import { useNbuRates } from "@/lib/use-nbu-rates";
import { formatCurrency, convertCurrency, currencyIdForSymbol } from "@/lib/currency-format";
import { CURRENCIES } from "@/lib/store";
import { AccountForm } from "@/components/finance/AccountForm";
import { useLongPress } from "@/lib/use-long-press";
import { PlusIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/** Account list + management, split out of the Огляд dashboard (which is
 *  now analytics-first and shows one combined Капітал number, not a card
 *  carousel) — everything the old AccountCarousel did (pick the active
 *  scope, add, edit, switch display currency) still lives somewhere, just
 *  not on the main screen anymore. */
export default function AccountsPage() {
  const { accounts, transactions, addAccount, updateAccount, removeAccount } = useFinanceStore();
  const { rates } = useNbuRates();
  const { selectedAccountId, setSelectedAccountId, displayCurrency, displaySymbol, selectDisplayCurrency } =
    useFinanceScope();

  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [rateUnavailable, setRateUnavailable] = useState(false);

  const allScope = useMemo(
    () => computeFinanceScope(null, accounts, transactions, displayCurrency, displaySymbol, rates),
    [accounts, transactions, displayCurrency, displaySymbol, rates]
  );
  const scopesByAccountId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeFinanceScope>>();
    for (const acc of accounts) {
      map.set(acc.id, computeFinanceScope(acc, accounts, transactions, displayCurrency, displaySymbol, rates));
    }
    return map;
  }, [accounts, transactions, displayCurrency, displaySymbol, rates]);

  function openAdd() {
    setEditingAccount(null);
    setFormOpen(true);
  }
  function openEdit(acc: FinanceAccount) {
    setEditingAccount(acc);
    setFormOpen(true);
  }
  const longPress = useLongPress<FinanceAccount>((acc) => openEdit(acc));

  function closeForm() {
    setFormOpen(false);
    setEditingAccount(null);
  }

  function handleSave(data: Omit<FinanceAccount, "id">) {
    if (!editingAccount) {
      addAccount(data);
      closeForm();
      return;
    }

    const oldCurrency = currencyIdForSymbol(editingAccount.currencySymbol);
    const newCurrency = currencyIdForSymbol(data.currencySymbol);

    if (oldCurrency === newCurrency) {
      updateAccount(editingAccount.id, data);
      closeForm();
      return;
    }

    if (!rates) {
      updateAccount(editingAccount.id, { ...data, currencySymbol: editingAccount.currencySymbol });
      closeForm();
      return;
    }

    updateAccount(editingAccount.id, {
      ...data,
      startingBalance: convertCurrency(data.startingBalance, oldCurrency, newCurrency, rates),
    });
    for (const t of transactions) {
      if (t.accountId === editingAccount.id) {
        useFinanceStore.getState().updateTransaction(t.id, { amount: convertCurrency(t.amount, oldCurrency, newCurrency, rates) });
      }
    }
    closeForm();
  }

  function handleDelete(id: string) {
    removeAccount(id);
    closeForm();
  }

  function handleSelectCurrency(currency: (typeof CURRENCIES)[number]["id"]) {
    const ok = selectDisplayCurrency(currency, Boolean(rates));
    setRateUnavailable(!ok);
    if (ok) return;
    window.setTimeout(() => setRateUnavailable(false), 2500);
  }

  return (
    <div>
      <FinanceSubpageHeader title="Рахунки" subtitle="Оберіть активний рахунок або додайте новий" />

      <div className="mb-2.5 space-y-1.5">
        <button
          onClick={() => setSelectedAccountId(null)}
          className={cn(
            "flex w-full items-center justify-between rounded-card-sm border-[1.5px] p-3.5 text-left",
            selectedAccountId === null ? "border-text bg-text" : "border-border bg-surface"
          )}
        >
          <span className={cn("text-[12.5px] font-semibold", selectedAccountId === null ? "text-bg" : "text-text")}>
            Усі рахунки
          </span>
          <span className={cn("font-display text-[14px]", selectedAccountId === null ? "text-bg" : "text-text")}>
            {formatCurrency(allScope.balance, allScope.symbol)}
          </span>
        </button>

        {accounts.map((acc) => {
          const scope = scopesByAccountId.get(acc.id)!;
          const active = selectedAccountId === acc.id;
          return (
            <button
              key={acc.id}
              onClick={() => {
                if (longPress.wasLongPress()) return;
                setSelectedAccountId(acc.id);
              }}
              onPointerDown={() => longPress.start(acc)}
              onPointerUp={longPress.cancel}
              onPointerLeave={longPress.cancel}
              onPointerCancel={longPress.cancel}
              className={cn(
                "flex w-full items-center justify-between rounded-card-sm border-[1.5px] p-3.5 text-left",
                active ? "border-text bg-text" : "border-border bg-surface"
              )}
            >
              <span className={cn("truncate text-[12.5px] font-semibold", active ? "text-bg" : "text-text")}>
                {acc.name}
              </span>
              <span className={cn("font-display flex-shrink-0 text-[14px]", active ? "text-bg" : "text-text")}>
                {formatCurrency(scope.balance, scope.symbol)}
              </span>
            </button>
          );
        })}

        <button
          onClick={openAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-card-sm border-[1.5px] border-dashed border-border py-3 text-text-faint"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="text-[11.5px] font-semibold">Додати рахунок</span>
        </button>
      </div>

      <div className="mb-1.5 text-[11px] text-text-faint">Утримуй рахунок, щоб редагувати. Валюта відображення:</div>
      <div className="mb-2.5 flex gap-1 rounded-btn bg-surface-2 p-1">
        {CURRENCIES.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelectCurrency(c.id)}
            className={cn(
              "flex-1 rounded-btn py-2 text-center text-[13px] font-bold",
              c.id === displayCurrency ? "bg-surface text-text shadow-card" : "text-text-faint"
            )}
          >
            {c.symbol}
          </button>
        ))}
      </div>
      {rateUnavailable && (
        <div className="mb-2.5 text-center text-[10.5px] font-semibold text-clay">
          Курс НБУ ще не завантажився — спробуй за хвилину
        </div>
      )}

      {formOpen && (
        <AccountForm
          editingAccount={editingAccount}
          onSave={handleSave}
          onClose={closeForm}
          onDelete={editingAccount ? handleDelete : undefined}
        />
      )}
    </div>
  );
}

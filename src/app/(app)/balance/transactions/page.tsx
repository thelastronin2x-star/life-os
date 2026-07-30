"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FinanceSubpageHeader } from "@/components/finance/FinanceSubpageHeader";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { useFinanceStore, sortTransactionsDesc, getAccountBalance, type Transaction } from "@/lib/finance-store";
import { formatDateKey, formatTimeOfDay } from "@/lib/calendar-utils";
import { SearchIcon, BankIcon, ShoppingBagIcon, TransferIcon } from "@/components/icons";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatCurrency } from "@/lib/currency-format";
import { learnMerchantRule, recategorizeUncategorizedTransactions } from "@/lib/recategorize";
import { useFinanceScope } from "@/lib/finance-scope-store";

function AllTransactionsInner() {
  const searchParams = useSearchParams();
  const { transactions, budgetCategories, accounts, updateTransaction, removeTransaction } = useFinanceStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>(searchParams.get("category") ?? "all");
  const { selectedAccountId, selectedAccount, setSelectedAccountId } = useFinanceScope();
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);

  const filteredAccount = selectedAccount;

  // Belt-and-suspenders: FinanceOverview already runs this on mount, but if
  // the user ever lands here directly (deep link, PWA shortcut) without that
  // screen mounting first, uncategorized entries would never get a second
  // look otherwise.
  useEffect(() => {
    recategorizeUncategorizedTransactions();
  }, []);

  // Account scope is shared (Огляд/Аналітика/Транзакції all read the same
  // selection) — a `?account=` link only needs to seed it once on arrival,
  // not own it going forward.
  useEffect(() => {
    const fromUrl = searchParams.get("account");
    if (fromUrl) setSelectedAccountId(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once from the URL this page was opened with, not on every store update
  }, []);

  const sortedCategories = useMemo(() => {
    return [...budgetCategories].sort((a, b) => {
      const spentA = transactions.filter((t) => t.categoryId === a.id && t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const spentB = transactions.filter((t) => t.categoryId === b.id && t.type === "expense").reduce((s, t) => s + t.amount, 0);
      return spentB - spentA;
    });
  }, [budgetCategories, transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "uncategorized" ? t.categoryId === null && t.type === "expense" : t.categoryId === filter);
      // A transfer touches TWO accounts (accountId — source, transferAccountId
      // — destination), so filtering by account must match either side, not
      // just accountId — otherwise a transfer would silently vanish from the
      // receiving account's own transaction list.
      const matchesAccountFilter =
        selectedAccountId === null ||
        t.accountId === selectedAccountId ||
        (t.type === "transfer" && t.transferAccountId === selectedAccountId);
      return matchesSearch && matchesFilter && matchesAccountFilter;
    });
  }, [transactions, search, filter, selectedAccountId]);

  const groups = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = formatDateKey(yesterday);
    const map = new Map<string, Transaction[]>();
    for (const t of sortTransactionsDesc(filtered)) {
      const label = t.date === todayKey ? "Сьогодні" : t.date === yesterdayKey ? "Вчора" : t.date;
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(t);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function closeForm() {
    setEditingTxn(null);
  }

  function handleSave(data: Omit<Transaction, "id">) {
    if (editingTxn) updateTransaction(editingTxn.id, data);
    if (data.type === "expense" && data.categoryId) {
      learnMerchantRule(data.title, data.categoryId);
    }
    closeForm();
  }

  function handleDelete(id: string) {
    removeTransaction(id);
    closeForm();
  }

  return (
    <div>
      <FinanceSubpageHeader
        title={filteredAccount ? filteredAccount.name : "Транзакції"}
        subtitle={
          filteredAccount
            ? formatCurrency(getAccountBalance(filteredAccount, transactions), filteredAccount.currencySymbol)
            : `${transactions.length} записів`
        }
      />

      <div className="mb-2.5 flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2.5">
        <SearchIcon className="h-4 w-4 text-text-faint" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук..."
          className="flex-1 bg-transparent text-[12px] text-text outline-none placeholder:text-text-faint"
        />
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter("all")}
          className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-medium ${
            filter === "all" ? "border-sage bg-surface-2 text-sage font-semibold" : "border-border bg-surface text-text-dim"
          }`}
        >
          Всі
        </button>
        {sortedCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilter(cat.id)}
            className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-medium ${
              filter === cat.id ? "border-sage bg-surface-2 text-sage font-semibold" : "border-border bg-surface text-text-dim"
            }`}
          >
            {cat.name}
          </button>
        ))}
        <button
          onClick={() => setFilter("uncategorized")}
          className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-medium ${
            filter === "uncategorized" ? "border-gold bg-surface-2 text-gold font-semibold" : "border-gold/40 bg-surface text-gold"
          }`}
        >
          Некатегоризовано ✎
        </button>
      </div>

      {accounts.length > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedAccountId(null)}
            className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-medium ${
              selectedAccountId === null ? "border-sky bg-surface-2 text-sky font-semibold" : "border-border bg-surface text-text-dim"
            }`}
          >
            Усі рахунки
          </button>
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => setSelectedAccountId(acc.id)}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-medium ${
                selectedAccountId === acc.id ? "border-sky bg-surface-2 text-sky font-semibold" : "border-border bg-surface text-text-dim"
              }`}
            >
              {acc.name}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 && (
        <div className="rounded-card-sm bg-surface shadow-card py-8 text-center text-[11.5px] text-text-faint">
          Нічого не знайдено
        </div>
      )}

      {groups.map(([label, txns]) => (
        <div key={label}>
          <div className="mb-1.5 mt-3 text-[9.5px] font-semibold uppercase tracking-wide text-text-faint">
            {label}
          </div>
          {txns.map((t) => {
            const cat = budgetCategories.find((c) => c.id === t.categoryId);
            const isTransfer = t.type === "transfer";
            // Filtered to the DESTINATION account specifically — show this
            // transfer as incoming (credit) rather than the default outgoing
            // (debit) view. A transfer genuinely moves money in opposite
            // directions depending on which of its two accounts you're
            // looking at, so "all accounts"/the source account's own list
            // still shows the original outgoing direction unchanged.
            const transferIncoming = isTransfer && selectedAccountId !== null && t.transferAccountId === selectedAccountId;
            const otherAccountName = isTransfer
              ? accounts.find((a) => a.id === (transferIncoming ? t.accountId : t.transferAccountId))?.name
              : undefined;
            const CatIcon = isTransfer ? TransferIcon : cat ? getCategoryIcon(cat.icon) : t.type === "income" ? BankIcon : ShoppingBagIcon;
            const txnSymbol =
              accounts.find((a) => a.id === (transferIncoming ? t.transferAccountId : t.accountId))?.currencySymbol ?? "₴";
            return (
              <button
                key={t.id}
                onClick={() => setEditingTxn(t)}
                className="mb-1.5 flex w-full items-center gap-2.5 rounded-card-sm bg-surface shadow-card p-3 text-left"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] bg-surface-2 text-text-dim">
                  <CatIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium text-text">{t.title}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-text-faint">
                    {formatTimeOfDay(t.time) && <span className="font-mono">{formatTimeOfDay(t.time)}</span>}
                    {isTransfer ? (
                      <span className="rounded-full border border-border px-1.5 py-0.5">
                        Переказ {transferIncoming ? "←" : "→"}
                        {otherAccountName ? ` ${otherAccountName}` : ""}
                      </span>
                    ) : t.type === "income" ? (
                      <span className="rounded-full border border-border px-1.5 py-0.5">Дохід</span>
                    ) : (
                      <span
                        className={`rounded-full border px-1.5 py-0.5 ${
                          cat ? "border-border" : "border-gold text-gold"
                        }`}
                      >
                        {cat?.name ?? "Некатегоризовано"} ✎
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`font-mono text-[12px] font-semibold ${
                    isTransfer ? (transferIncoming ? "text-sage" : "text-text-dim") : t.type === "income" ? "text-sage" : "text-clay"
                  }`}
                >
                  {isTransfer ? (transferIncoming ? "+" : "→ ") : t.type === "income" ? "+" : "-"}
                  {formatCurrency(t.amount, txnSymbol)}
                </div>
              </button>
            );
          })}
        </div>
      ))}

      {editingTxn && (
        <TransactionForm
          categories={budgetCategories}
          accounts={accounts}
          editingTxn={editingTxn}
          onSave={handleSave}
          onClose={closeForm}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

export default function AllTransactionsPage() {
  return (
    <Suspense fallback={null}>
      <AllTransactionsInner />
    </Suspense>
  );
}

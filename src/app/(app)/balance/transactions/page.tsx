"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FinanceSubpageHeader } from "@/components/finance/FinanceSubpageHeader";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { BudgetCategoryForm } from "@/components/finance/BudgetCategoryForm";
import { useFinanceStore, sortTransactionsDesc, getAccountBalance, type BudgetCategory, type Transaction } from "@/lib/finance-store";
import { formatDateKey, formatTimeOfDay } from "@/lib/calendar-utils";
import { SearchIcon, BankIcon, ShoppingBagIcon, TransferIcon } from "@/components/icons";
import { categoryMeta } from "@/lib/finance-categories";
import { formatCurrency } from "@/lib/currency-format";
import { learnMerchantRule, recategorizeUncategorizedTransactions } from "@/lib/recategorize";
import { useFinanceScope } from "@/lib/finance-scope-store";
import { useLongPress } from "@/lib/use-long-press";
import { cn } from "@/lib/cn";

function Chip({
  active,
  gold,
  children,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
}: {
  active: boolean;
  gold?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
  onPointerCancel?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      className={cn(
        "flex-shrink-0 rounded-btn px-3 py-1.5 text-[11px] font-semibold",
        active ? (gold ? "bg-gold-soft text-gold" : "bg-text text-bg") : gold ? "bg-gold-soft text-gold" : "bg-surface text-text-dim"
      )}
    >
      {children}
    </button>
  );
}

function AllTransactionsInner() {
  const searchParams = useSearchParams();
  const { transactions, budgetCategories, accounts, updateTransaction, removeTransaction, updateBudgetCategory, removeBudgetCategory } =
    useFinanceStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>(searchParams.get("category") ?? "all");
  const { selectedAccountId, selectedAccount, setSelectedAccountId } = useFinanceScope();
  // Long-press a category chip to edit it — BudgetCategoryForm's only
  // remaining entry point now that Огляд no longer has a category list of
  // its own (see finance-manual-data-prompt.md's dashboard replacement).
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const categoryLongPress = useLongPress<BudgetCategory>((cat) => setEditingCategory(cat));
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

      <div className="mb-2.5 flex items-center gap-2 rounded-btn bg-surface px-3.5 py-2.5">
        <SearchIcon className="h-4 w-4 text-text-faint" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук..."
          className="flex-1 bg-transparent text-[12px] text-text outline-none placeholder:text-text-faint"
        />
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          Всі
        </Chip>
        {sortedCategories.map((cat) => (
          <Chip
            key={cat.id}
            active={filter === cat.id}
            onClick={() => {
              if (categoryLongPress.wasLongPress()) return;
              setFilter(cat.id);
            }}
            onPointerDown={() => categoryLongPress.start(cat)}
            onPointerUp={categoryLongPress.cancel}
            onPointerLeave={categoryLongPress.cancel}
            onPointerCancel={categoryLongPress.cancel}
          >
            {cat.name}
          </Chip>
        ))}
        <Chip gold active={filter === "uncategorized"} onClick={() => setFilter("uncategorized")}>
          Некатегоризовано ✎
        </Chip>
      </div>

      {accounts.length > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          <Chip active={selectedAccountId === null} onClick={() => setSelectedAccountId(null)}>
            Усі рахунки
          </Chip>
          {accounts.map((acc) => (
            <Chip key={acc.id} active={selectedAccountId === acc.id} onClick={() => setSelectedAccountId(acc.id)}>
              {acc.name}
            </Chip>
          ))}
        </div>
      )}

      {groups.length === 0 && (
        <div className="card-raised rounded-card-sm bg-surface py-8 text-center text-[11.5px] text-text-faint">
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
            const catMeta = cat ? categoryMeta(cat.icon) : null;
            const txnSymbol =
              accounts.find((a) => a.id === (transferIncoming ? t.transferAccountId : t.accountId))?.currencySymbol ?? "₴";
            const rowColor = isTransfer ? "sky" : t.type === "income" ? "sage" : (cat?.color ?? "gold");
            return (
              <button
                key={t.id}
                onClick={() => setEditingTxn(t)}
                className="card-raised mb-1.5 flex w-full items-center gap-2.5 rounded-card-sm bg-surface p-3 text-left"
              >
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-icon"
                  style={{ background: `var(--${rowColor}-soft)`, color: `var(--${rowColor})` }}
                >
                  {isTransfer ? (
                    <TransferIcon className="h-4 w-4" />
                  ) : catMeta ? (
                    <catMeta.Icon className="h-4 w-4" />
                  ) : t.type === "income" ? (
                    <BankIcon className="h-4 w-4" />
                  ) : (
                    <ShoppingBagIcon className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium text-text">{t.title}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-text-faint">
                    {formatTimeOfDay(t.time) && <span className="font-mono">{formatTimeOfDay(t.time)}</span>}
                    {isTransfer ? (
                      <span>
                        Переказ {transferIncoming ? "←" : "→"}
                        {otherAccountName ? ` ${otherAccountName}` : ""}
                      </span>
                    ) : t.type === "income" ? (
                      <span>Дохід</span>
                    ) : (
                      <span className={cat ? undefined : "text-gold"}>{cat?.name ?? "Некатегоризовано"} ✎</span>
                    )}
                  </div>
                </div>
                <div
                  className={cn(
                    "font-mono text-[12px] font-semibold",
                    isTransfer ? (transferIncoming ? "text-sage" : "text-text-dim") : t.type === "income" ? "text-sage" : "text-clay"
                  )}
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

      {editingCategory && (
        <BudgetCategoryForm
          editingCategory={editingCategory}
          accounts={accounts}
          currentAccountId={selectedAccountId}
          onSave={(data) => {
            updateBudgetCategory(editingCategory.id, data);
            setEditingCategory(null);
          }}
          onClose={() => setEditingCategory(null)}
          onDelete={(id) => {
            removeBudgetCategory(id);
            setEditingCategory(null);
          }}
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

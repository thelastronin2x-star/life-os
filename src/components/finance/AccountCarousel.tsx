"use client";

import { type ReactNode, useMemo, useState } from "react";
import type { FinanceAccount, Transaction } from "@/lib/finance-store";
import { computeFinanceScope, type FinanceScopeCalc } from "@/lib/finance-scope";
import { formatCurrency, convertCurrency, currencyIdForSymbol } from "@/lib/currency-format";
import { useNbuRates } from "@/lib/use-nbu-rates";
import { useLongPress } from "@/lib/use-long-press";
import type { Currency } from "@/lib/store";
import { periodStartKey } from "@/lib/finance-periods";
import { WalletIcon, PlusIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/** Shared card body — the balance is a real `<button>` only when the card
 *  is active (that's the only state where tapping it does something of its
 *  own, cycling the display currency); on an inactive card it's plain text,
 *  so the WHOLE card is a single button and any tap on it, including on the
 *  balance, selects the card. Never nests one interactive element inside
 *  another, so focus/keyboard behavior stays exactly what the DOM gives it
 *  for free. */
function CardBody({
  titleContent,
  symbol,
  balance,
  income,
  expense,
  rateHint,
  active,
  onTapBalance,
  dark,
}: {
  titleContent: ReactNode;
  symbol: string;
  balance: number;
  income: number;
  expense: number;
  rateHint: string | null;
  active: boolean;
  onTapBalance: () => void;
  /** The "Усі рахунки" hero card always sits on a fixed dark gradient,
   *  regardless of the active theme (see AGENTS.md "М'які блоки" spec) — its
   *  text needs to stay white/light-on-dark rather than following the
   *  theme's own text tokens, which assume a light-on-surface card. */
  dark?: boolean;
}) {
  return (
    <>
      <div className={cn("mb-1 text-[11px]", dark ? "text-white/70" : "text-text-dim")}>{titleContent}</div>
      {active ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTapBalance();
          }}
          className={cn("inline-block font-mono text-[26px] font-bold", dark ? "text-white" : "text-text")}
        >
          {formatCurrency(balance, symbol)}
        </button>
      ) : (
        <div className={cn("font-mono text-[26px] font-bold", dark ? "text-white" : "text-text")}>
          {formatCurrency(balance, symbol)}
        </div>
      )}
      {rateHint && (
        <div className={cn("mt-0.5 text-[9px]", dark ? "text-white/50" : "text-text-faint")}>{rateHint}</div>
      )}
      <div className="mt-3 flex gap-4">
        <div>
          <div className={cn("text-[11px]", dark ? "text-white/70" : "text-sage")}>↑ Дохід</div>
          <div className={cn("mt-0.5 font-mono text-[13px] font-bold", dark ? "text-white" : "text-text")}>
            +{formatCurrency(income, symbol)}
          </div>
        </div>
        <div>
          <div className={cn("text-[11px]", dark ? "text-white/70" : "text-clay")}>↓ Витрати</div>
          <div className={cn("mt-0.5 font-mono text-[13px] font-bold", dark ? "text-white" : "text-text")}>
            -{formatCurrency(expense, symbol)}
          </div>
        </div>
      </div>
    </>
  );
}

interface CardShellProps {
  bg: string;
  active: boolean;
  onSelect: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  children: ReactNode;
}

/** Inactive: the whole card is one button — any tap, including on the
 *  balance, selects it. Active: a plain (non-interactive) wrapper, since
 *  selecting an already-active card does nothing — the balance inside gets
 *  its own real button for the currency-cycle tap instead. */
function CardShell({ bg, active, onSelect, onPointerDown, onPointerUp, children }: CardShellProps) {
  const className = cn(
    "w-[85%] flex-shrink-0 snap-center rounded-card p-4 text-left shadow-card",
    bg,
    active && "ring-inset ring-[1.5px] ring-sage"
  );

  if (!active) {
    return (
      <button
        onClick={onSelect}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
        className={className}
      >
        {children}
      </button>
    );
  }

  return <div className={className}>{children}</div>;
}

/** Replaces the old single "Загальний баланс" block — a horizontal
 *  swipe/tap carousel with "Усі рахунки" first, then one card per account,
 *  each showing its own balance and month income/expense already converted
 *  into the shared display currency. Selecting a card (swipe or tap the
 *  card itself) switches the finance scope; tapping the balance NUMBER
 *  specifically cycles ₴ → $ → € → ₴ for the whole Фінанси/Аналітика screen,
 *  and only works on the already-active card. Long-press an account card to
 *  edit it — this is now the only place accounts are listed, so it also
 *  owns "+ рахунок" (a trailing card). */
export function AccountCarousel({
  accounts,
  transactions,
  selectedAccountId,
  onSelect,
  onEditAccount,
  onAddAccount,
  displayCurrency,
  displaySymbol,
  cycleDisplayCurrency,
}: {
  accounts: FinanceAccount[];
  transactions: Transaction[];
  selectedAccountId: string | null;
  onSelect: (id: string | null) => void;
  onEditAccount: (acc: FinanceAccount) => void;
  onAddAccount: () => void;
  displayCurrency: Currency;
  displaySymbol: string;
  cycleDisplayCurrency: (ratesAvailable: boolean) => boolean;
}) {
  const { rates } = useNbuRates();
  const [rateUnavailable, setRateUnavailable] = useState(false);
  const longPress = useLongPress<FinanceAccount>((acc) => onEditAccount(acc));

  const monthStart = periodStartKey("Місяць");

  // One full transaction scan per account per render used to happen twice
  // (once here, once in the sibling accounts list this component replaced)
  // and, worse, unmemoized inside this very .map() — with years of bank
  // history that showed up as visible stutter on scroll/long-press. Computed
  // once per render now, and only recomputed when the underlying data
  // actually changes.
  const scopesByAccountId = useMemo(() => {
    const map = new Map<string, FinanceScopeCalc>();
    for (const acc of accounts) {
      map.set(acc.id, computeFinanceScope(acc, accounts, transactions, displayCurrency, displaySymbol, rates));
    }
    return map;
  }, [accounts, transactions, displayCurrency, displaySymbol, rates]);

  const allScope = useMemo(
    () => computeFinanceScope(null, accounts, transactions, displayCurrency, displaySymbol, rates),
    [accounts, transactions, displayCurrency, displaySymbol, rates]
  );

  const monthTxns = useMemo(() => transactions.filter((t) => t.date >= monthStart), [transactions, monthStart]);

  function monthIncomeExpense(includesTxn: (t: Transaction) => boolean, convert: (t: Transaction) => number | null) {
    return monthTxns.filter(includesTxn).reduce(
      (acc, t) => {
        const converted = convert(t);
        if (converted === null) return acc;
        if (t.type === "income") acc.income += converted;
        else if (t.type === "expense") acc.expense += converted;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }

  const allTotals = useMemo(
    () => monthIncomeExpense(allScope.includesTxn, allScope.convert),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- monthIncomeExpense closes over monthTxns, already listed
    [allScope, monthTxns]
  );

  const perAccountTotals = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const acc of accounts) {
      const scope = scopesByAccountId.get(acc.id)!;
      map.set(acc.id, monthIncomeExpense(scope.includesTxn, scope.convert));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- monthIncomeExpense closes over monthTxns, already listed
  }, [accounts, scopesByAccountId, monthTxns]);

  function handleTapBalance() {
    const ok = cycleDisplayCurrency(Boolean(rates));
    setRateUnavailable(!ok);
    if (ok) return;
    setTimeout(() => setRateUnavailable(false), 2500);
  }

  /** "1 $ = 40.50 ₴ · НБУ" — only shown when a real conversion happened, so
   *  it never appears for a card already in its own native currency. */
  function rateHintFor(fromCurrency: Currency, fromSymbol: string): string | null {
    if (fromCurrency === displayCurrency || !rates) return null;
    const rate = convertCurrency(1, fromCurrency, displayCurrency, rates);
    return `1 ${fromSymbol} = ${rate.toFixed(2)} ${displaySymbol} · НБУ`;
  }

  return (
    <div>
      <div className="mb-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
        <CardShell
          bg="bg-[linear-gradient(140deg,#20241f,#31382e)]"
          active={selectedAccountId === null}
          onSelect={() => onSelect(null)}
        >
          <CardBody
            titleContent={
              <span className="flex items-center gap-1.5">
                <WalletIcon className="h-3 w-3" />
                Усі рахунки
              </span>
            }
            symbol={allScope.symbol}
            balance={allScope.balance}
            income={allTotals.income}
            expense={allTotals.expense}
            rateHint={null}
            active={selectedAccountId === null}
            onTapBalance={handleTapBalance}
            dark
          />
        </CardShell>
        {accounts.map((acc) => {
          const scope = scopesByAccountId.get(acc.id)!;
          const totals = perAccountTotals.get(acc.id)!;
          const active = selectedAccountId === acc.id;
          return (
            <CardShell
              key={acc.id}
              bg="bg-gradient-to-br from-surface-2 to-surface"
              active={active}
              onSelect={() => {
                if (longPress.wasLongPress()) return;
                onSelect(acc.id);
              }}
              onPointerDown={() => longPress.start(acc)}
              onPointerUp={longPress.cancel}
            >
              <CardBody
                titleContent={acc.name}
                symbol={scope.symbol}
                balance={scope.balance}
                income={totals.income}
                expense={totals.expense}
                rateHint={rateHintFor(currencyIdForSymbol(acc.currencySymbol), acc.currencySymbol)}
                active={active}
                onTapBalance={handleTapBalance}
              />
            </CardShell>
          );
        })}
        <button
          onClick={onAddAccount}
          className="flex w-[85px] flex-shrink-0 snap-center flex-col items-center justify-center gap-1.5 rounded-card border-[1.5px] border-dashed border-border text-text-faint"
        >
          <PlusIcon className="h-4.5 w-4.5" />
          <span className="text-[10.5px]">Рахунок</span>
        </button>
      </div>
      {rateUnavailable && (
        <div className="mb-3 -mt-1 text-center text-[10.5px] text-clay">
          Курс НБУ ще не завантажився — спробуй за хвилину
        </div>
      )}
    </div>
  );
}

import { getAccountBalance, type Transaction, type FinanceAccount, type BudgetCategory } from "./finance-store";
import { convertCurrency, currencyIdForSymbol } from "./currency-format";
import { startOfWeek } from "./finance-periods";
import { formatDateKey } from "./calendar-utils";
import type { Currency } from "./store";
import type { NbuRates } from "./nbu-rates";

export interface FinanceScopeCalc {
  /** Null for "Усі рахунки". */
  account: FinanceAccount | null;
  /** Currency symbol every sum under this scope is already expressed in —
   *  the user's chosen display currency (see finance-scope-store.ts),
   *  regardless of which account(s) it was originally converted from. */
  symbol: string;
  /** Whether a transaction counts under this scope at all. For "all
   *  accounts": every transaction that still belongs to an existing account
   *  (see belongsToKnownAccount — orphans left behind by a deleted account
   *  are excluded, so the combined totals always equal the sum of the
   *  individual cards). For a single account: the account's
   *  own transactions, plus a transfer landing in it from elsewhere (so it
   *  shows up on the receiving side too). Non-transfer income/expense sums
   *  can filter with this directly — it reduces to a plain accountId match
   *  for every type except transfer, so it never over-includes those. */
  includesTxn: (t: Transaction) => boolean;
  /** A transaction's amount in `symbol`'s currency, converted via the live
   *  NBU rate whenever the transaction's own account isn't already in that
   *  currency. Returns null if that's not possible yet (no rate loaded) —
   *  callers should exclude the transaction from their sum in that case,
   *  rather than mixing unconverted amounts together. */
  convert: (t: Transaction) => number | null;
  /** This scope's current balance, already in `symbol`'s currency. */
  balance: number;
  /** A category's effective limit under this scope, in `symbol`'s currency.
   *  For a single account: that account's own entry, or 0 if unset (callers
   *  should treat 0 as "no limit configured", not "limit of zero" — skip
   *  the progress bar rather than drawing one that reads as pre-exceeded).
   *  For "all accounts": the sum of every account's own limit, converted,
   *  so it's never inconsistent with what each individual card shows. */
  categoryLimit: (cat: BudgetCategory) => number;
}

export function computeFinanceScope(
  account: FinanceAccount | null,
  accounts: FinanceAccount[],
  transactions: Transaction[],
  displayCurrency: Currency,
  displaySymbol: string,
  rates: NbuRates | null
): FinanceScopeCalc {
  function convertAmount(amount: number, fromCurrency: Currency): number | null {
    if (fromCurrency === displayCurrency) return amount;
    if (!rates) return null;
    return convertCurrency(amount, fromCurrency, displayCurrency, rates);
  }

  if (account) {
    const fromCurrency = currencyIdForSymbol(account.currencySymbol);
    return {
      account,
      symbol: displaySymbol,
      includesTxn: (t) => t.accountId === account.id || (t.type === "transfer" && t.transferAccountId === account.id),
      // A transfer landing IN this account from elsewhere has t.accountId
      // pointing at the SOURCE account, not this one — its amount is
      // recorded in the source account's own currency, not necessarily this
      // account's. Using this account's currency unconditionally here used
      // to silently mislabel (and mis-convert) every incoming transfer from
      // a foreign-currency account.
      convert: (t) => {
        const txnCurrency = currencyIdForSymbol(accounts.find((a) => a.id === t.accountId)?.currencySymbol ?? account.currencySymbol);
        return convertAmount(t.amount, txnCurrency);
      },
      balance: convertAmount(getAccountBalance(account, transactions), fromCurrency) ?? 0,
      categoryLimit: (cat) => convertAmount(cat.limitsByAccount[account.id] ?? 0, fromCurrency) ?? 0,
    };
  }

  // Transactions whose account no longer exists (removeAccount deletes the
  // account but deliberately keeps its transactions, so nothing is silently
  // destroyed) must not be counted here. Left in, they showed up in "Усі
  // рахунки" totals while appearing on no individual card at all — so the
  // combined income/expense never matched the sum of the cards — and were
  // converted as if they were UAH regardless of the currency they were
  // actually recorded in.
  const knownAccountIds = new Set(accounts.map((a) => a.id));

  function belongsToKnownAccount(t: Transaction): boolean {
    if (knownAccountIds.has(t.accountId)) return true;
    // A transfer is a single record owned by the source account; if only the
    // destination still exists, the money did still land somewhere real.
    return t.type === "transfer" && t.transferAccountId !== undefined && knownAccountIds.has(t.transferAccountId);
  }

  function toDisplayCurrency(t: Transaction): number | null {
    const fromCurrency = currencyIdForSymbol(accounts.find((a) => a.id === t.accountId)?.currencySymbol ?? "₴");
    return convertAmount(t.amount, fromCurrency);
  }

  const balance = accounts.reduce((sum, a) => {
    const bal = getAccountBalance(a, transactions);
    const converted = convertAmount(bal, currencyIdForSymbol(a.currencySymbol));
    return converted === null ? sum : sum + converted;
  }, 0);

  function categoryLimit(cat: BudgetCategory): number {
    return accounts.reduce((sum, a) => {
      const raw = cat.limitsByAccount[a.id];
      if (!raw) return sum;
      const converted = convertAmount(raw, currencyIdForSymbol(a.currencySymbol));
      return converted === null ? sum : sum + converted;
    }, 0);
  }

  return {
    account: null,
    symbol: displaySymbol,
    includesTxn: belongsToKnownAccount,
    convert: toDisplayCurrency,
    balance,
    categoryLimit,
  };
}

/** Total expenses in the current calendar week (Monday–Sunday), converted
 *  into `scope`'s currency exactly like every other sum under that scope —
 *  the one shared definition of "weekly expenses", so the Головна summary
 *  card and any other caller can never silently disagree with each other or
 *  with Фінанси/Аналітика about what "this week" means or what currency it's
 *  expressed in. */
export function getWeekExpenseTotal(transactions: Transaction[], scope: FinanceScopeCalc): number {
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const startKey = formatDateKey(weekStart);
  const endKey = formatDateKey(weekEnd);

  return transactions
    .filter((t) => t.type === "expense" && t.date >= startKey && t.date <= endKey && scope.includesTxn(t))
    .reduce((sum, t) => {
      const converted = scope.convert(t);
      return converted === null ? sum : sum + converted;
    }, 0);
}

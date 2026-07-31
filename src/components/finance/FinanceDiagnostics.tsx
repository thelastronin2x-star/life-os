"use client";

import { useMemo } from "react";
import { useFinanceStore } from "@/lib/finance-store";
import { useMonobankLinkStore } from "@/lib/monobank-store";
import { useNbuRates } from "@/lib/use-nbu-rates";

/** A plain read-only dump of what the app actually holds locally.
 *
 *  Exists because "categories are empty" has at least four completely
 *  different causes that look identical on the main screen — no transactions
 *  imported at all, transactions imported onto a different account than the
 *  one currently selected, transactions present but uncategorized, or sums
 *  silently collapsing to zero because no exchange rate loaded. Guessing
 *  between them from the code alone doesn't converge; this shows which one it
 *  is in one glance.
 *
 *  Reads nothing, writes nothing, changes nothing. */
export function FinanceDiagnostics() {
  const { accounts, transactions, budgetCategories } = useFinanceStore();
  const links = useMonobankLinkStore((s) => s.links);
  const { status: ratesStatus } = useNbuRates();

  const perAccount = useMemo(() => {
    return accounts.map((acc) => {
      const own = transactions.filter((t) => t.accountId === acc.id);
      const dates = own.map((t) => t.date).sort();
      const uncategorized = own.filter((t) => t.type === "expense" && t.categoryId === null).length;
      const expenses = own.filter((t) => t.type === "expense").length;
      return {
        id: acc.id,
        name: acc.name,
        symbol: acc.currencySymbol,
        total: own.length,
        expenses,
        uncategorized,
        first: dates[0] ?? null,
        last: dates[dates.length - 1] ?? null,
        linked: links.some((l) => l.localAccountId === acc.id),
      };
    });
  }, [accounts, transactions, links]);

  const orphans = useMemo(() => {
    const ids = new Set(accounts.map((a) => a.id));
    return transactions.filter((t) => !ids.has(t.accountId)).length;
  }, [accounts, transactions]);

  return (
    <div className="mb-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">Діагностика</div>
      <div className="rounded-card-sm bg-surface shadow-card p-3 text-[11px] leading-relaxed text-text-dim">
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
          <span>Транзакцій: <b className="font-mono text-text">{transactions.length}</b></span>
          <span>Категорій: <b className="font-mono text-text">{budgetCategories.length}</b></span>
          <span>Прив&apos;язок: <b className="font-mono text-text">{links.length}</b></span>
          <span>
            Курс НБУ:{" "}
            <b className={`font-mono ${ratesStatus === "ready" ? "text-sage" : "text-clay"}`}>{ratesStatus}</b>
          </span>
        </div>

        {orphans > 0 && (
          <div className="mb-2 text-clay">
            Транзакцій без рахунку: <b className="font-mono">{orphans}</b> — лишились від видаленого рахунку
          </div>
        )}

        {perAccount.length === 0 ? (
          <div className="text-text-faint">Рахунків ще немає</div>
        ) : (
          perAccount.map((a) => (
            <div key={a.id} className="border-t border-border pt-2 mt-2 first:border-t-0 first:pt-0 first:mt-0">
              <div className="font-medium text-text">
                {a.name} <span className="font-mono text-text-faint">{a.symbol}</span>
                {!a.linked && <span className="ml-1 text-text-faint">· не прив&apos;язаний</span>}
              </div>
              <div className="font-mono">
                {a.total} транз. · {a.expenses} витрат · {a.uncategorized} без категорії
              </div>
              <div className="font-mono text-text-faint">{a.first ? `${a.first} → ${a.last}` : "порожньо"}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

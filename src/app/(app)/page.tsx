"use client";

import Link from "next/link";
import { PROFILES, useAppStore } from "@/lib/store";
import { useCalendarStore } from "@/lib/calendar-store";
import { useFinanceStore } from "@/lib/finance-store";
import { useFinanceScope } from "@/lib/finance-scope-store";
import { computeFinanceScope, getWeekExpenseTotal } from "@/lib/finance-scope";
import { useNbuRates } from "@/lib/use-nbu-rates";
import { useJournalStore } from "@/lib/journal-store";
import { useJournalConfigStore } from "@/lib/journal-config-store";
import { computeTradePnL } from "@/lib/trade-calculations";
import { formatAgendaDate, formatDateKey } from "@/lib/calendar-utils";
import { getTimeGreeting } from "@/lib/greeting";
import { formatAmount } from "@/lib/currency-format";
import { HomeInsightCard } from "@/components/ui/HomeInsightCard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatCard } from "@/components/ui/StatCard";
import { ModuleCard } from "@/components/ui/ModuleCard";
import { ProfileChip } from "@/components/ui/ProfileChip";
import { EquityChart } from "@/components/work/EquityChart";
import { WalletIcon, NotebookIcon, ConstructionIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const CATEGORY_COLOR: Record<"personal" | "work", string> = {
  personal: "var(--sky)",
  work: "var(--gold)",
};

const CATEGORY_LABEL: Record<"personal" | "work", string> = {
  personal: "Особисте",
  work: "Робота",
};

export default function HomePage() {
  const profile = useAppStore((s) => s.profile);
  const profileName = PROFILES.find((p) => p.id === profile)!.name;

  const calendarItems = useCalendarStore((s) => s.items);
  const now = new Date();
  const todayKey = formatDateKey(now);
  const todayEvents = calendarItems
    .filter((i) => i.date === todayKey && i.kind === "event")
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  // Same scope ("Усі рахунки") and display-currency preference as Фінанси/
  // Аналітика/Транзакції — this card must never disagree with those screens
  // about either the number or the currency it's shown in.
  const accounts = useFinanceStore((s) => s.accounts);
  const { transactions } = useFinanceStore();
  const { displayCurrency, displaySymbol } = useFinanceScope();
  const { rates } = useNbuRates();
  const financeScope = computeFinanceScope(null, accounts, transactions, displayCurrency, displaySymbol, rates);
  const weekExpense = getWeekExpenseTotal(transactions, financeScope);
  const currencySymbol = financeScope.symbol;

  const trades = useJournalStore((s) => s.trades);
  const instruments = useJournalConfigStore((s) => s.instruments);

  const tradesWithPnl = trades
    .map((t) => ({ trade: t, net: computeTradePnL(t, instruments.find((i) => i.id === t.instrumentId)).net }))
    .filter((x) => x.net !== null);
  const winRate =
    tradesWithPnl.length > 0
      ? Math.round((tradesWithPnl.filter((x) => (x.net ?? 0) > 0).length / tradesWithPnl.length) * 100)
      : null;

  const equityDeltas = [...tradesWithPnl]
    .sort((a, b) => `${a.trade.date}${a.trade.time}`.localeCompare(`${b.trade.date}${b.trade.time}`))
    .map((x) => x.net ?? 0);
  const equityNet = equityDeltas.reduce((sum, v) => sum + v, 0);

  return (
    <div>
      <div className="flex items-center justify-between pb-3.5 pt-2">
        <div>
          <div className="font-heading text-lg font-semibold text-text">
            {getTimeGreeting(now)}
          </div>
          <div className="mt-0.5 font-mono text-[11.5px] text-text-faint">
            {formatAgendaDate(now)}
          </div>
        </div>
        <ProfileChip name={profileName} />
      </div>

      <HomeInsightCard />

      <SectionTitle action="календар">Сьогодні</SectionTitle>
      {todayEvents.length === 0 && (
        <Link
          href="/calendar"
          className="mb-1.5 block rounded-card-sm bg-surface shadow-card p-3 text-center text-[11.5px] text-text-faint"
        >
          На сьогодні нічого не заплановано
        </Link>
      )}
      {todayEvents.map((item) => (
        <Link
          key={item.id}
          href="/calendar"
          className="mb-1.5 flex items-center gap-2.5 rounded-card-sm bg-surface shadow-card p-2.5"
        >
          <div className="w-10 flex-shrink-0 font-mono text-xs font-semibold text-text">
            {item.time}
          </div>
          <div
            className="h-6 w-[3px] flex-shrink-0 rounded"
            style={{ background: CATEGORY_COLOR[item.category] }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-text">{item.title}</div>
            <div className="mt-0.5 text-[10.5px] text-text-faint">{CATEGORY_LABEL[item.category]}</div>
          </div>
        </Link>
      ))}

      <SectionTitle>Баланс тижня</SectionTitle>
      <StatCard
        icon={<WalletIcon className="h-3.5 w-3.5" />}
        label="Фінанси"
        value={`-${formatAmount(weekExpense)}`}
        unit={currencySymbol}
        footer="Витрати за тиждень"
        valueClassName="text-clay"
        href="/balance?segment=finance"
      />

      <SectionTitle>Робота ({profileName})</SectionTitle>
      {profile === "trader" ? (
        <>
          <div className="mb-2.5 rounded-card-sm bg-surface shadow-card p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="text-[10.5px] text-text-dim">Equity curve</div>
              <div className={cn("font-mono text-[15px] font-bold", equityNet >= 0 ? "text-sage" : "text-rose")}>
                {equityNet >= 0 ? "+" : ""}
                {equityNet.toFixed(0)} {currencySymbol}
              </div>
            </div>
            <EquityChart type="line" deltas={equityDeltas} />
          </div>
          <ModuleCard
            icon={<NotebookIcon className="h-4 w-4" />}
            iconBg="rgba(143,191,159,0.15)"
            iconColor="var(--sage)"
            title="Журнал угод"
            subtitle={
              trades.length === 0
                ? "Ще немає угод — додай першу"
                : `${trades.length} угод${winRate !== null ? ` · win rate ${winRate}%` : ""}`
            }
            href="/work/journal"
          />
        </>
      ) : (
        <ModuleCard
          icon={<ConstructionIcon className="h-4 w-4" />}
          iconBg="rgba(111,165,194,0.15)"
          iconColor="var(--sky)"
          title="IT-профіль"
          subtitle="Функціонал ще в розробці"
          href="/work"
        />
      )}
    </div>
  );
}

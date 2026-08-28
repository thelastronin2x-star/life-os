"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { PROFILES, useAppStore, type HomeWidgetId } from "@/lib/store";
import { useCalendarStore } from "@/lib/calendar-store";
import { useFinanceStore } from "@/lib/finance-store";
import { useFinanceScope } from "@/lib/finance-scope-store";
import { computeFinanceScope, getWeekExpenseTotal } from "@/lib/finance-scope";
import { useNbuRates } from "@/lib/use-nbu-rates";
import { useJournalStore } from "@/lib/journal-store";
import { useJournalConfigStore } from "@/lib/journal-config-store";
import { computeTradePnL } from "@/lib/trade-calculations";
import { useTradingAccounts } from "@/lib/trading-accounts";
import { summarizeWeekTrades } from "@/lib/week-trading";
import { formatAgendaDate, formatDateKey } from "@/lib/calendar-utils";
import { getTimeGreeting } from "@/lib/greeting";
import { HomeInsightCard } from "@/components/ui/HomeInsightCard";
import { ModuleCard } from "@/components/ui/ModuleCard";
import { getAvatarIcon } from "@/components/icons/avatars";
import { EditableWidgetBlock } from "@/components/ui/EditableWidgetBlock";
import { EquityChart } from "@/components/work/EquityChart";
import { WeatherWidget } from "@/components/home/WeatherWidget";
import { WeekBalance } from "@/components/home/WeekBalance";
import {
  NotebookIcon,
  ConstructionIcon,
  ClockIcon,
  BriefcaseIcon,
  PlusIcon,
} from "@/components/icons";
import type { ReactElement, ReactNode } from "react";

/** Home's own section caption. Deliberately not SectionTitle: that one is
 *  uppercase, letter-spaced and used across every other screen, and Home in
 *  this design wants a quieter sentence-case label sitting directly on the
 *  canvas above its card. Changing SectionTitle itself would restyle screens
 *  this pass isn't touching. */
function HomeLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    // 18px above, 7px below: the gap over a label has to be clearly larger
    // than the gap under it, or the label floats between two widgets instead
    // of belonging to the one beneath it. Both used to be bigger, which is
    // most of why Home scrolled so far for so little content.
    <div className="mb-2 mt-[18px] flex items-baseline justify-between px-0.5">
      {/* text-dim, not text-faint: at bold weight the old faint grey looked
          like a disabled control rather than a quiet heading. */}
      <span className="text-[12.5px] font-bold tracking-[-0.01em] text-text-dim">{children}</span>
      {action && <span className="text-[11.5px] font-semibold text-accent">{action}</span>}
    </div>
  );
}

const CATEGORY_COLOR: Record<"personal" | "work", string> = {
  personal: "var(--sky)",
  work: "var(--gold)",
};

const CATEGORY_LABEL: Record<"personal" | "work", string> = {
  personal: "Особисте",
  work: "Робота",
};

const CATEGORY_ICON: Record<"personal" | "work", ReactElement> = {
  personal: <ClockIcon className="h-4 w-4" />,
  work: <BriefcaseIcon className="h-4 w-4" />,
};

export default function HomePage() {
  const profile = useAppStore((s) => s.profile);
  const profileName = PROFILES.find((p) => p.id === profile)!.name;
  const nickname = useAppStore((s) => s.nickname);
  const avatarId = useAppStore((s) => s.avatarId);
  const avatarIcon = useMemo(() => getAvatarIcon(avatarId)({ className: "h-5 w-5" }), [avatarId]);
  const homeWidgets = useAppStore((s) => s.homeWidgets);
  const toggleHomeWidget = useAppStore((s) => s.toggleHomeWidget);
  const [editMode, setEditMode] = useState(false);

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
  const previousWeekExpense = getWeekExpenseTotal(transactions, financeScope, -1);
  const currencySymbol = financeScope.symbol;

  const trades = useJournalStore((s) => s.trades);
  const instruments = useJournalConfigStore((s) => s.instruments);
  const tradingAccounts = useTradingAccounts();

  // The week block prints trading money in the account's own currency, so it
  // needs the account library, not just the journal.
  const weekTrading = useMemo(() => {
    const instrumentById = new Map(instruments.map((i) => [i.id, i]));
    const symbolByAccount = new Map(tradingAccounts.map((a) => [a.id, a.currencySymbol]));
    return summarizeWeekTrades(trades, instrumentById, (id) => (id ? symbolByAccount.get(id) ?? "$" : "$"));
  }, [trades, instruments, tradingAccounts]);

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

  function widgetOrder(id: HomeWidgetId): number {
    return homeWidgets.find((w) => w.id === id)?.order ?? 0;
  }
  function isWidgetVisible(id: HomeWidgetId): boolean {
    return homeWidgets.find((w) => w.id === id)?.visible ?? true;
  }
  function block(id: HomeWidgetId, children: ReactElement) {
    return (
      <EditableWidgetBlock editMode={editMode} onEnterEditMode={() => setEditMode(true)} onRemove={() => toggleHomeWidget(id)}>
        {children}
      </EditableWidgetBlock>
    );
  }

  // Home renders strictly by each widget's `order` — "Робота" is one shared
  // header over up to two profile-scoped members (equity-curve + journal-link
  // for a trader, just it-work for IT), so it's slotted in as a single virtual
  // entry positioned at its earliest member's order, rather than each member
  // fighting to print its own copy of the header.
  const items: { id: string; order: number; node: ReactElement }[] = [];

  if (isWidgetVisible("ai-card")) {
    items.push({ id: "ai-card", order: widgetOrder("ai-card"), node: block("ai-card", <HomeInsightCard />) });
  }

  if (isWidgetVisible("today")) {
    items.push({
      id: "today",
      order: widgetOrder("today"),
      node: block(
        "today",
        <>
          <HomeLabel action={<Link href="/calendar">календар →</Link>}>Сьогодні</HomeLabel>
          {/* One card holding hairline-separated rows, not a stack of cards.
              A card per event gave every line its own shadow and gap, so three
              events read as three unrelated things instead of one list — and
              the gaps grew the block far past what the same content needs. */}
          {/* Left white: it's the only widget made of several lines of text,
              and a tint plus a watermark behind a list is where this treatment
              stops helping and starts competing with the words. */}
          <div className="card-raised rounded-card bg-surface px-3.5">
            {todayEvents.length === 0 ? (
              <Link href="/calendar" className="block py-3.5 text-center text-[11.5px] font-semibold text-text-faint">
                На сьогодні нічого не заплановано
              </Link>
            ) : (
              todayEvents.map((item) => (
                <Link
                  key={item.id}
                  href="/calendar"
                  className="flex items-center gap-2.5 border-b border-border py-2.5 last:border-b-0"
                >
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-icon"
                    style={{
                      background: `color-mix(in srgb, ${CATEGORY_COLOR[item.category]} 16%, var(--surface))`,
                      color: CATEGORY_COLOR[item.category],
                    }}
                  >
                    {CATEGORY_ICON[item.category]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold tracking-[-0.015em] text-text">{item.title}</div>
                    <div className="mt-0.5 text-[11.5px] font-semibold text-text-faint">
                      {item.time} · {CATEGORY_LABEL[item.category]}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </>
      ),
    });
  }

  if (isWidgetVisible("week-balance")) {
    items.push({
      id: "week-balance",
      order: widgetOrder("week-balance"),
      node: block(
        "week-balance",
        <>
          <HomeLabel>Баланс тижня</HomeLabel>
          <WeekBalance
            expense={weekExpense}
            previousExpense={previousWeekExpense}
            currencySymbol={currencySymbol}
            trading={profile === "trader" ? weekTrading : null}
          />
        </>
      ),
    });
  }

  if (isWidgetVisible("weather")) {
    items.push({
      id: "weather",
      order: widgetOrder("weather"),
      node: block(
        "weather",
        <>
          <HomeLabel>Погода</HomeLabel>
          <WeatherWidget />
        </>
      ),
    });
  }

  const workMembers: { id: HomeWidgetId; order: number; node: ReactElement }[] = [];
  if (profile === "trader" && isWidgetVisible("equity-curve")) {
    workMembers.push({
      id: "equity-curve",
      order: widgetOrder("equity-curve"),
      node: block(
        "equity-curve",
        // White like every other widget; only the figure and the curve carry
        // the result's colour. Tinting the whole card green on a good week
        // and red on a bad one turned Home's mood into a P&L readout.
        <div className="card-raised relative mb-2 rounded-card bg-surface px-4 pb-2.5 pt-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-bold text-text-dim">Крива капіталу</div>
            <div
              className="font-display text-[19px] font-medium tracking-[-0.045em]"
              style={{ color: equityNet >= 0 ? "var(--sage)" : "var(--clay)" }}
            >
              {equityNet >= 0 ? "+" : ""}
              {equityNet.toFixed(0)} {currencySymbol}
            </div>
          </div>
          <div className="mt-2">
            <EquityChart type="line" deltas={equityDeltas} tone={equityNet >= 0 ? "positive" : "negative"} />
          </div>
        </div>
      ),
    });
  }
  if (profile === "trader" && isWidgetVisible("journal-link")) {
    workMembers.push({
      id: "journal-link",
      order: widgetOrder("journal-link"),
      node: block(
        "journal-link",
        <ModuleCard
          icon={<NotebookIcon className="h-16 w-16" />}
          tone="sage"
          title="Журнал угод"
          subtitle={
            trades.length === 0
              ? "Ще немає угод — додай першу"
              : `${trades.length} угод${winRate !== null ? ` · win rate ${winRate}%` : ""}`
          }
          href="/work/journal"
        />
      ),
    });
  }
  if (profile === "it" && isWidgetVisible("it-work")) {
    workMembers.push({
      id: "it-work",
      order: widgetOrder("it-work"),
      node: block(
        "it-work",
        <ModuleCard
          icon={<ConstructionIcon className="h-16 w-16" />}
          tone="sky"
          title="IT-профіль"
          subtitle="Функціонал ще в розробці"
          href="/work"
        />
      ),
    });
  }

  if (workMembers.length > 0) {
    workMembers.sort((a, b) => a.order - b.order);
    items.push({
      id: "work-section",
      order: Math.min(...workMembers.map((w) => w.order)),
      node: (
        <>
          <HomeLabel>Робота · {profileName}</HomeLabel>
          {workMembers.map((w) => (
            <Fragment key={w.id}>{w.node}</Fragment>
          ))}
        </>
      ),
    });
  }

  items.sort((a, b) => a.order - b.order);

  // Only the widgets relevant to the current profile count toward "is there
  // anything left to add" — a trader should never see the add-widget tile
  // just because the IT-only block happens to be hidden (and vice versa).
  // Weather belongs to both profiles — it's the one widget unrelated to the
  // profession the user picked. Leaving it out here meant the "add widget"
  // tile stayed hidden even when weather was the only thing left to add.
  const relevantIds: HomeWidgetId[] =
    profile === "trader"
      ? ["ai-card", "today", "week-balance", "weather", "equity-curve", "journal-link"]
      : ["ai-card", "today", "week-balance", "weather", "it-work"];
  const hasHiddenWidgets = homeWidgets.some((w) => relevantIds.includes(w.id) && !w.visible);

  return (
    <div>
      {/* Greeting by name, with the time-of-day phrase as the fallback until
          the user has set one — a screen that opens with "Привіт, Богдане"
          reads as personal, "Доброго ранку 👋" reads as a template. */}
      <div className="flex items-center justify-between pb-1 pt-1">
        <div className="min-w-0">
          <h1 className="truncate text-[23px] font-bold tracking-[-0.03em] text-text">
            {nickname.trim() ? `Привіт, ${nickname.trim()}` : getTimeGreeting(now)}
          </h1>
          <div className="mt-1 text-[11.5px] font-semibold text-text-faint">{formatAgendaDate(now)}</div>
        </div>
        {editMode ? (
          <button
            onClick={() => setEditMode(false)}
            className="flex-shrink-0 rounded-btn bg-text px-4 py-2 text-[12px] font-extrabold text-bg"
          >
            Готово
          </button>
        ) : (
          // Replaces the profile chip: an avatar tile is both a clearer tap
          // target for "this is me" and the same shape as every other icon
          // block on the screen, so the header stops looking like a different
          // design language from the widgets under it.
          <Link
            href="/profile"
            className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-dim shadow-card"
            aria-label={`Профіль · ${profileName}`}
          >
            {avatarIcon}
          </Link>
        )}
      </div>

      {items.map((item) => (
        <Fragment key={item.id}>{item.node}</Fragment>
      ))}

      {hasHiddenWidgets && (
        <Link
          href="/home-add-widget"
          className="mt-4 flex items-center justify-center gap-2 rounded-card border border-dashed border-border py-3"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-text-dim">
            <PlusIcon className="h-3.5 w-3.5" />
          </span>
          <span className="text-[12.5px] font-bold text-text-dim">Додати віджет</span>
        </Link>
      )}
    </div>
  );
}

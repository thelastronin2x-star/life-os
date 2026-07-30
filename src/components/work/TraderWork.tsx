import Link from "next/link";
import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ModuleCard } from "@/components/ui/ModuleCard";
import { CURRENCIES, useAppStore } from "@/lib/store";
import { useJournalStore } from "@/lib/journal-store";
import { useJournalConfigStore } from "@/lib/journal-config-store";
import { computeTradePnL } from "@/lib/trade-calculations";
import { usePropAccountsStore } from "@/lib/prop-accounts-store";
import { useEconomicCalendar } from "@/lib/use-economic-calendar";
import { formatDateKey } from "@/lib/calendar-utils";
import { HourglassIcon, TrendingUpIcon, TrendingDownIcon, PackageIcon, NewspaperIcon, CalculatorIcon } from "@/components/icons";

export function TraderWork() {
  const currencyId = useAppStore((s) => s.settings.currency);
  const currencySymbol = CURRENCIES.find((c) => c.id === currencyId)?.symbol ?? "₴";

  const trades = useJournalStore((s) => s.trades);
  const instruments = useJournalConfigStore((s) => s.instruments);
  const instrumentById = useMemo(() => new Map(instruments.map((i) => [i.id, i])), [instruments]);

  const enrichedRecent = useMemo(
    () =>
      trades.slice(0, 2).map((t) => ({
        trade: t,
        instrument: instrumentById.get(t.instrumentId),
        pnl: computeTradePnL(t, instrumentById.get(t.instrumentId)),
      })),
    [trades, instrumentById]
  );

  const closed = trades
    .map((t) => computeTradePnL(t, instrumentById.get(t.instrumentId)))
    .filter((p) => p.net !== null);
  const wins = closed.filter((p) => (p.net ?? 0) > 0).length;
  const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;

  const accounts = usePropAccountsStore((s) => s.accounts);
  const mainAccount = accounts[0];

  const { events: economicEvents, status: economicStatus } = useEconomicCalendar();
  const todayKey = formatDateKey(new Date());
  const nextHighImpact = economicEvents
    .filter((e) => e.impact === 3 && e.date >= todayKey)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];

  const calendarPreviewText =
    economicStatus === "no-credits"
      ? "На рахунку JBlanked закінчились кредити"
      : economicStatus === "error"
        ? "Не вдалося завантажити календар"
        : economicStatus === "not-configured"
          ? "Дані очікують підключення API"
          : nextHighImpact
            ? `${nextHighImpact.date} · ${nextHighImpact.time} · high impact`
            : "Немає найближчих релізів";

  return (
    <div>
      <Card className="mb-2.5">
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-[13px] font-semibold text-text">Статистика вінрейту</div>
          <div className="font-mono text-[11px] text-text-faint">{trades.length} угод</div>
        </div>
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-sage" style={{ width: `${winRate}%` }} />
        </div>
        <div className="flex justify-between text-[10.5px] text-text-faint">
          <span>Win rate {winRate}%</span>
          <span>
            {wins} прибуткових · {trades.length - wins} збиткових
          </span>
        </div>
      </Card>

      <SectionTitle
        action={
          <Link href="/work/journal" className="text-accent">
            все →
          </Link>
        }
      >
        Журнал угод
      </SectionTitle>
      {enrichedRecent.length === 0 && (
        <div className="mb-1.5 rounded-card-sm bg-surface shadow-card p-3 text-center text-[11.5px] text-text-faint">
          Ще немає угод
        </div>
      )}
      {enrichedRecent.map(({ trade: t, instrument, pnl }) => (
        <ModuleCard
          key={t.id}
          icon={
            t.status === "open" ? (
              <HourglassIcon className="h-4 w-4" />
            ) : (pnl.net ?? 0) > 0 ? (
              <TrendingUpIcon className="h-4 w-4" />
            ) : (
              <TrendingDownIcon className="h-4 w-4" />
            )
          }
          iconBg={t.status === "open" ? "rgba(111,165,194,0.15)" : (pnl.net ?? 0) > 0 ? "rgba(143,191,159,0.15)" : "rgba(217,143,163,0.15)"}
          iconColor={t.status === "open" ? "var(--sky)" : (pnl.net ?? 0) > 0 ? "var(--sage)" : "var(--rose)"}
          title={`${instrument?.symbol ?? "—"} · ${t.direction === "LONG" ? "Long" : "Short"}`}
          subtitle={
            t.status === "open"
              ? `відкрита · R:R план ${pnl.rrPlanned}`
              : `${(pnl.net ?? 0) > 0 ? "+" : ""}${(pnl.net ?? 0).toFixed(2)}${currencySymbol} · R:R ${pnl.rrActual ?? pnl.rrPlanned}`
          }
          href="/work/journal"
        />
      ))}

      <SectionTitle
        action={
          <Link href="/work/prop-accounts" className="text-accent">
            все →
          </Link>
        }
      >
        Prop-акаунти
      </SectionTitle>
      {mainAccount ? (
        <ModuleCard
          icon={<PackageIcon className="h-4 w-4" />}
          iconBg="rgba(217,168,103,0.15)"
          iconColor="var(--gold)"
          title={`${mainAccount.firm} · ${mainAccount.phase}`}
          subtitle={`Profit ${mainAccount.profitPct}% / ${mainAccount.profitTarget}%`}
          href="/work/prop-accounts"
        />
      ) : (
        <ModuleCard
          icon={<PackageIcon className="h-4 w-4" />}
          iconBg="rgba(217,168,103,0.15)"
          iconColor="var(--gold)"
          title="Немає акаунтів"
          subtitle="Додай свій перший prop-акаунт"
          href="/work/prop-accounts"
        />
      )}

      <SectionTitle>Економічний календар</SectionTitle>
      <ModuleCard
        icon={<NewspaperIcon className="h-4 w-4" />}
        iconBg="rgba(201,141,122,0.15)"
        iconColor="var(--clay)"
        title={economicStatus === "ready" && nextHighImpact ? nextHighImpact.name : "Немає найближчих релізів"}
        subtitle={calendarPreviewText}
        href="/work/economic-calendar"
      />

      <SectionTitle>Інструменти</SectionTitle>
      <ModuleCard
        icon={<CalculatorIcon className="h-4 w-4" />}
        iconBg="rgba(111,165,194,0.15)"
        iconColor="var(--sky)"
        title="Ризик-калькулятор"
        subtitle="Розмір лота під risk%"
        href="/work/calculator"
      />
    </div>
  );
}

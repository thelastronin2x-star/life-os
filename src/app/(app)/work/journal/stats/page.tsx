"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CURRENCIES, useAppStore } from "@/lib/store";
import { useJournalStore, type Trade } from "@/lib/journal-store";
import { useJournalConfigStore } from "@/lib/journal-config-store";
import { useTradingAccounts } from "@/lib/trading-accounts";
import { computeTradePnL } from "@/lib/trade-calculations";
import { useTraderOnlyGuard } from "@/lib/use-trader-guard";
import {
  closedTradesWithNet,
  computeHourlyPerformanceCurve,
  computeLateHourCorrelation,
  computePlanCorrelation,
  computePostLossPauseCorrelation,
  computeTagCombinations,
  detectRevengeTrading,
  type BinaryCorrelation,
} from "@/lib/trade-insights";
import { tradesInPeriod, type AnalyticsPeriod } from "@/lib/assistant-context-work-analytics";
import { useWorkAnalyticsInsightSync } from "@/lib/use-work-analytics-insight-sync";
import {
  extractRMultiples,
  estimateAverageRiskPercent,
  computeKellyCriterion,
  tradesNeededForKelly,
  computeRiskOfRuin,
  computeMonteCarloProjection,
  computeSetupEdge,
} from "@/lib/trade-risk-analytics";
import { smoothPath } from "@/lib/smooth-path";
import { useContinuousChartTooltip, useDiscreteChartTooltip, ChartTooltipBubble } from "@/components/ui/ChartTooltip";
import { cn } from "@/lib/cn";
import { SparkleIcon, AlertTriangleIcon, TrendingUpIcon, TrendingDownIcon } from "@/components/icons";

interface GroupStat {
  key: string;
  label: string;
  count: number;
  wins: number;
  net: number;
}

function buildGroups(
  trades: { trade: Trade; net: number | null }[],
  keyFn: (t: Trade) => string[],
  labelFn: (key: string) => string
): GroupStat[] {
  const map = new Map<string, GroupStat>();
  for (const { trade, net } of trades) {
    if (net === null) continue;
    for (const key of keyFn(trade)) {
      const existing = map.get(key) ?? { key, label: labelFn(key), count: 0, wins: 0, net: 0 };
      existing.count += 1;
      existing.net += net;
      if (net > 0) existing.wins += 1;
      map.set(key, existing);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.net - a.net);
}

function GroupTable({ title, groups, currencySymbol }: { title: string; groups: GroupStat[]; currencySymbol: string }) {
  if (groups.length === 0) return null;
  return (
    <div className="mb-3 rounded-card-sm bg-surface shadow-card p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">{title}</div>
      <div className="space-y-1.5">
        {groups.map((g) => {
          const winRate = g.count > 0 ? Math.round((g.wins / g.count) * 100) : 0;
          return (
            <div key={g.key} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
              <div>
                <div className="text-[12px] font-medium text-text">{g.label}</div>
                <div className="text-[10px] text-text-faint">
                  {g.count} угод · win rate {winRate}%
                </div>
              </div>
              <span className={cn("font-mono text-[13px] font-bold", g.net >= 0 ? "text-sage" : "text-rose")}>
                {g.net >= 0 ? "+" : ""}
                {g.net.toFixed(0)} {currencySymbol}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PERIOD_TABS: { id: AnalyticsPeriod; label: string }[] = [
  { id: "week", label: "Тиждень" },
  { id: "month", label: "Місяць" },
  { id: "quarter", label: "Квартал" },
];

function CorrelationCard({ title, correlation }: { title: string; correlation: BinaryCorrelation }) {
  // The healthier side is whichever one the trader can choose to be on more
  // often — "за планом" / "решта дня" / "довша пауза" — so it's always `a`
  // here by construction of the trade-insights.ts functions, not something
  // this component has to infer from the numbers.
  const diff = correlation.aWinRate - correlation.bWinRate;
  const positive = diff >= 0;
  return (
    <div className="mb-2 flex items-start gap-3 rounded-card border border-border bg-surface p-3.5 shadow-card">
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm",
          positive ? "bg-sage-soft text-sage" : "bg-clay-soft text-clay"
        )}
      >
        {positive ? <TrendingUpIcon className="h-4 w-4" /> : <TrendingDownIcon className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[15px] text-text">
          {correlation.aLabel}{" "}
          <b className={positive ? "text-sage" : "text-clay"}>{correlation.aWinRate}%</b> проти {correlation.bLabel}{" "}
          <b className={positive ? "text-clay" : "text-sage"}>{correlation.bWinRate}%</b>
        </div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-text-faint">{title}</div>
      </div>
    </div>
  );
}

const RUIN_ARC_LENGTH = 204; // matches the path's own geometry below (radius 65 semicircle)

function ruinColor(pct: number): string {
  if (pct < 15) return "var(--sage)";
  if (pct < 40) return "var(--gold)";
  return "var(--clay)";
}

function RiskOfRuinGauge({ result }: { result: NonNullable<ReturnType<typeof computeRiskOfRuin>> }) {
  const offset = RUIN_ARC_LENGTH * (1 - Math.min(100, result.ruinProbabilityPercent) / 100);
  const color = ruinColor(result.ruinProbabilityPercent);
  return (
    <div className="mb-3 rounded-card border border-border bg-surface p-3.5 shadow-card">
      <div className="text-[12px] font-semibold text-text">Ризик розорення</div>
      <div className="mt-0.5 text-[10.5px] text-text-faint">Ймовірність втратити 50%+ депозиту при поточній стратегії ризику</div>
      <div className="relative mx-auto mb-1.5 mt-3 h-[80px] w-[150px]">
        <svg width="150" height="80" viewBox="0 0 150 80">
          <path d="M10,75 A65,65 0 0,1 140,75" fill="none" stroke="var(--surface-2)" strokeWidth="12" strokeLinecap="round" />
          <path
            d="M10,75 A65,65 0 0,1 140,75"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${RUIN_ARC_LENGTH} ${RUIN_ARC_LENGTH}`}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="font-display absolute inset-x-0 bottom-0 text-center text-[24px]" style={{ color }}>
          {result.ruinProbabilityPercent}%
        </div>
      </div>
      <div className="mt-1.5 text-center text-[10.5px] leading-relaxed text-text-faint">
        При ризику <b className="text-text">{result.currentRiskPercent.toFixed(1)}% на угоду</b> — {result.ruinProbabilityPercent < 15 ? "низький" : result.ruinProbabilityPercent < 40 ? "помітний" : "високий"} ризик. При збільшенні до{" "}
        <b className="text-text">{result.higherRiskPercent.toFixed(1)}%</b> ризик зростає до{" "}
        <b style={{ color: ruinColor(result.ruinProbabilityAtHigherRisk) }}>{result.ruinProbabilityAtHigherRisk}%</b>.
      </div>
      <div className="mt-2 text-center text-[9.5px] text-text-faint">
        Оцінка ризику приблизна — розрахована з R-множників угод, окремого поля &quot;ризик %&quot; в журналі немає
      </div>
    </div>
  );
}

function KellyCriterionCard({
  kelly,
  currentRiskPercent,
  neededTrades,
}: {
  kelly: NonNullable<ReturnType<typeof computeKellyCriterion>> | null;
  currentRiskPercent: number | null;
  neededTrades: number;
}) {
  return (
    <div className="mb-3 rounded-card border border-border bg-surface p-3.5 shadow-card">
      <div className="text-[12px] font-semibold text-text">Kelly Criterion — оптимальний ризик</div>
      <div className="mt-0.5 mb-3 text-[10.5px] text-text-faint">Розраховано з твоєї реальної статистики</div>
      {kelly && currentRiskPercent !== null ? (
        <>
          <div className="flex gap-2.5">
            <div className="flex-1 rounded-card-sm bg-surface-2 p-3 text-center">
              <div className="text-[8.5px] font-bold uppercase text-text-faint">Ти ризикуєш</div>
              <div className="font-display mt-1.5 text-[17px] text-text">{currentRiskPercent.toFixed(1)}%</div>
            </div>
            <div className="flex-1 rounded-card-sm bg-sage-soft p-3 text-center">
              <div className="text-[8.5px] font-bold uppercase text-text-faint">Оптимально (Kelly/2)</div>
              <div className="font-display mt-1.5 text-[17px] text-sage">{(kelly.halfKelly * 100).toFixed(1)}%</div>
            </div>
          </div>
          <div className="mt-2.5 text-[10.5px] leading-relaxed text-text-faint">
            {kelly.halfKelly * 100 > currentRiskPercent
              ? "Твій edge дозволяє трохи більший ризик без шкоди довгостроковому результату — але підвищувати варто поступово."
              : "Твій поточний ризик уже вищий за консервативну Kelly-оцінку — варто розглянути зменшення."}
          </div>
        </>
      ) : (
        <div className="rounded-card-sm bg-surface-2 py-6 text-center text-[11.5px] text-text-faint">
          Потрібно ще {neededTrades} угод для розрахунку Kelly Criterion
        </div>
      )}
    </div>
  );
}

function MonteCarloCard({ projection, currencySymbol }: { projection: NonNullable<ReturnType<typeof computeMonteCarloProjection>>; currencySymbol: string }) {
  const width = 320;
  const height = 90;
  const allValues = projection.flatMap((p) => [p.low, p.high]);
  const min = Math.min(0, ...allValues);
  const max = Math.max(0, ...allValues);
  const range = max - min || 1;

  const toY = (v: number) => height - ((v - min) / range) * height;
  const toX = (i: number) => (i / (projection.length - 1 || 1)) * width;

  const highPoints = projection.map((p, i) => ({ x: toX(i), y: toY(p.high) }));
  const lowPoints = projection.map((p, i) => ({ x: toX(i), y: toY(p.low) }));
  const bandPath = `${smoothPath(highPoints)} ${smoothPath([...lowPoints].reverse()).replace(/^M/, "L")} Z`;

  const tooltipValues = projection.map(
    (p) => `${p.low >= 0 ? "+" : ""}${p.low.toFixed(0)}${currencySymbol} – ${p.high >= 0 ? "+" : ""}${p.high.toFixed(0)}${currencySymbol}`
  );
  const { containerRef, tooltip, handlers } = useContinuousChartTooltip(tooltipValues);

  return (
    <div className="mb-3 rounded-card border border-border bg-surface p-3.5 shadow-card">
      <div className="text-[12px] font-semibold text-text">Monte Carlo · 1000 симуляцій наступного місяця</div>
      <div className="mt-0.5 mb-3 text-[10.5px] text-text-faint">Тримай палець на області, щоб побачити ймовірний діапазон</div>
      <div ref={containerRef} className="relative" {...handlers}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <path d={bandPath} fill="var(--sage)" fillOpacity="0.16" />
          <path d={smoothPath(highPoints)} fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" />
          <path d={smoothPath(lowPoints)} fill="none" stroke="var(--sage)" strokeWidth="1.2" strokeOpacity="0.5" strokeLinecap="round" />
        </svg>
        <ChartTooltipBubble tooltip={tooltip} />
      </div>
      <div className="mt-1.5 flex justify-between text-[8.5px] font-semibold text-text-faint">
        {projection.map((p) => (
          <span key={p.week}>Тиждень {p.week}</span>
        ))}
      </div>
      <div className="mt-2 text-center text-[9.5px] text-text-faint">Діапазон імовірних результатів, не прогноз одного числа</div>
    </div>
  );
}

function SetupEdgeCard({ edges }: { edges: NonNullable<ReturnType<typeof computeSetupEdge>> }) {
  const maxWinRate = Math.max(1, ...edges.map((e) => e.winRate));
  const { containerRef, tooltip, bind } = useDiscreteChartTooltip();
  const lowSampleEdge = edges.find((e) => e.lowSample);

  return (
    <div className="mb-3 rounded-card border border-border bg-surface p-3.5 shadow-card">
      <div className="text-[12px] font-semibold text-text">Аналіз переваги сетапу</div>
      <div className="mt-0.5 mb-3 text-[10.5px] text-text-faint">Win rate по тегах — тримай палець на стовпчику</div>
      <div ref={containerRef} className="relative flex h-[80px] items-end gap-1.5">
        {edges.map((e) => (
          <div
            key={e.tagName}
            {...bind(`${e.tagName}: ${e.winRate}%`)}
            className="flex-1 rounded-t-[5px]"
            style={{ height: `${Math.max(6, (e.winRate / maxWinRate) * 100)}%`, background: e.lowSample ? "var(--gold)" : "var(--sage)" }}
          />
        ))}
        <ChartTooltipBubble tooltip={tooltip} />
      </div>
      {lowSampleEdge && (
        <div className="mt-2.5 rounded-card-sm bg-gold-soft p-2.5 text-[10.5px] font-semibold text-text-dim">
          «{lowSampleEdge.tagName}» має лише {lowSampleEdge.count} угод — замало для впевненого висновку. Потрібно ще ~
          {Math.max(1, 20 - lowSampleEdge.count)}.
        </div>
      )}
    </div>
  );
}

export default function JournalStatsPage() {
  const isTrader = useTraderOnlyGuard();
  const currencyId = useAppStore((s) => s.settings.currency);
  const appCurrencySymbol = CURRENCIES.find((c) => c.id === currencyId)?.symbol ?? "₴";

  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId");
  const accounts = useTradingAccounts();
  const account = accounts.find((a) => a.id === accountId) ?? null;
  const currencySymbol = account?.currencySymbol ?? appCurrencySymbol;

  const [period, setPeriod] = useState<AnalyticsPeriod>("month");
  const { containerRef: curveContainerRef, tooltip: curveTooltipState, bind: curveBind } = useDiscreteChartTooltip();

  const { trades: allTrades } = useJournalStore();
  const accountTrades = useMemo(
    () => (accountId ? allTrades.filter((t) => t.accountId === accountId) : allTrades),
    [allTrades, accountId]
  );
  const trades = useMemo(() => tradesInPeriod(accountTrades, period), [accountTrades, period]);
  const { instruments, tags, sessions } = useJournalConfigStore();

  const instrumentById = useMemo(() => new Map(instruments.map((i) => [i.id, i])), [instruments]);
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  const narrative = useWorkAnalyticsInsightSync(period);
  const narrativeText = narrative.streamingText ?? narrative.cached?.text ?? "";

  const closed = closedTradesWithNet(trades, instrumentById);
  const winRate = closed.length > 0 ? Math.round((closed.filter((x) => x.net > 0).length / closed.length) * 100) : 0;
  const avgWin =
    closed.filter((x) => x.net > 0).length > 0
      ? closed.filter((x) => x.net > 0).reduce((s, x) => s + x.net, 0) / closed.filter((x) => x.net > 0).length
      : 0;
  const avgLoss =
    closed.filter((x) => x.net <= 0).length > 0
      ? closed.filter((x) => x.net <= 0).reduce((s, x) => s + x.net, 0) / closed.filter((x) => x.net <= 0).length
      : 0;
  const grossWin = closed.filter((x) => x.net > 0).reduce((s, x) => s + x.net, 0);
  const grossLoss = Math.abs(closed.filter((x) => x.net <= 0).reduce((s, x) => s + x.net, 0));
  const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : grossWin > 0 ? "∞" : "—";
  const totalCommission = trades.reduce((s, t) => s + t.commission, 0);
  const totalSwap = trades.reduce((s, t) => s + t.swap, 0);

  const planCorrelation = computePlanCorrelation(trades, instrumentById);
  const lateHourCorrelation = computeLateHourCorrelation(trades, instrumentById);
  const pauseCorrelation = computePostLossPauseCorrelation(trades, instrumentById);
  const correlations = [
    planCorrelation && { title: "Дотримання плану/чек-листа перед входом", correlation: planCorrelation },
    lateHourCorrelation && { title: "Пізні угоди проти решти дня", correlation: lateHourCorrelation },
    pauseCorrelation && { title: "Пауза після збиткової угоди перед наступною", correlation: pauseCorrelation },
  ].filter((x): x is { title: string; correlation: BinaryCorrelation } => !!x);

  const curve = computeHourlyPerformanceCurve(trades, instrumentById);
  const maxCurveWinRate = Math.max(1, ...curve.map((c) => c.winRate ?? 0));

  const tagCombos = computeTagCombinations(trades, instrumentById, tagById, 2);

  // Risk of Ruin / Kelly / Monte Carlo all need a capital figure to turn
  // R-multiples into a risk %, so they're scoped to a single selected
  // account (accountId present) rather than an "all accounts" mix of
  // different sizes, where a % would mean nothing. For a prop account
  // there's no simple "balance" (see PropAccountView) — maxDrawdown (the
  // challenge's actual capital-at-risk ceiling) is the more meaningful
  // denominator there than any notional account size would be.
  const riskCapitalBase = account ? (account.kind === "personal" ? account.balance : account.maxDrawdown) : null;
  const rMultiples = extractRMultiples(accountTrades, instrumentById);
  const currentRiskPercent = riskCapitalBase ? estimateAverageRiskPercent(accountTrades, instrumentById, riskCapitalBase) : null;
  const kelly = computeKellyCriterion(rMultiples);
  const kellyNeeded = tradesNeededForKelly(rMultiples);
  const riskOfRuin = currentRiskPercent !== null ? computeRiskOfRuin(rMultiples, currentRiskPercent) : null;

  const PERIOD_WEEKS: Record<AnalyticsPeriod, number> = { week: 1, month: 4.345, quarter: 13.04 };
  const tradesPerWeek = closed.length / PERIOD_WEEKS[period];
  const riskAmountPerTrade = riskCapitalBase && currentRiskPercent !== null ? (riskCapitalBase * currentRiskPercent) / 100 : 0;
  const monteCarlo = computeMonteCarloProjection(rMultiples, riskAmountPerTrade, tradesPerWeek);

  const setupEdges = computeSetupEdge(trades, instrumentById, tagById);

  // Revenge-trading pattern is checked over the account's whole history, not
  // just the selected period — see detectRevengeTrading's own note.
  const revenge = detectRevengeTrading(accountTrades, instrumentById);

  const byInstrument = buildGroups(
    trades.map((t) => ({ trade: t, net: computeTradePnL(t, instrumentById.get(t.instrumentId)).net })),
    (t) => [t.instrumentId],
    (key) => instrumentById.get(key)?.symbol ?? key
  );
  const byTag = buildGroups(
    trades.map((t) => ({ trade: t, net: computeTradePnL(t, instrumentById.get(t.instrumentId)).net })),
    (t) => t.tagIds,
    (key) => tagById.get(key)?.name ?? key
  );
  const bySession = buildGroups(
    trades.map((t) => ({ trade: t, net: computeTradePnL(t, instrumentById.get(t.instrumentId)).net })),
    (t) => (t.sessionId ? [t.sessionId] : []),
    (key) => sessionById.get(key)?.name ?? key
  );

  if (!isTrader) return null;

  return (
    <div>
      <div className="pb-3.5 pt-2">
        <Link
          href={accountId ? `/work/journal` : "/work/journal"}
          className="mb-2 flex items-center gap-2 text-[12.5px] text-text-dim"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">
            ‹
          </span>
          Журнал
        </Link>
        <div className="font-heading text-lg font-semibold text-text">AI Аналітика</div>
        <div className="mt-0.5 text-[11.5px] text-text-faint">
          {account ? `${account.name} · ` : ""}Глибокий розбір, не тільки цифри
        </div>
      </div>

      <div className="mb-3.5 flex rounded-btn bg-surface-2 p-[3px]">
        {PERIOD_TABS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={cn(
              "flex-1 rounded-btn py-2 text-center text-[12px] font-semibold",
              period === p.id ? "bg-bg text-text shadow-card" : "text-text-faint"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-card p-4 text-white" style={{ background: "linear-gradient(135deg, #2a2620, #1f2018)" }}>
        <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/60">
          <SparkleIcon className="h-3.5 w-3.5" /> Розбір періоду
        </div>
        {narrativeText ? (
          <p className="text-[13.5px] font-medium leading-relaxed text-white/95">{narrativeText}</p>
        ) : (
          <p className="text-[13.5px] font-medium leading-relaxed text-white/50">
            {narrative.isFetching ? "Аналізую угоди…" : "Ще немає закритих угод за цей період для розбору."}
          </p>
        )}
        {closed.length > 0 && (
          <div className="mt-3.5 border-t border-white/10 pt-2.5 text-[10.5px] font-semibold text-white/45">
            Згенеровано на основі {closed.length} угод за обраний період
          </div>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-card-sm bg-surface shadow-card p-2.5 text-center">
          <div className="text-[8px] uppercase text-text-faint">Win rate</div>
          <div className="font-mono text-[15px] font-bold text-text">{winRate}%</div>
        </div>
        <div className="rounded-card-sm bg-surface shadow-card p-2.5 text-center">
          <div className="text-[8px] uppercase text-text-faint">Profit Factor</div>
          <div className="font-mono text-[15px] font-bold text-gold">{profitFactor}</div>
        </div>
        <div className="rounded-card-sm bg-surface shadow-card p-2.5 text-center">
          <div className="text-[8px] uppercase text-text-faint">Сер. виграш</div>
          <div className="font-mono text-[15px] font-bold text-sage">
            +{avgWin.toFixed(0)} {currencySymbol}
          </div>
        </div>
        <div className="rounded-card-sm bg-surface shadow-card p-2.5 text-center">
          <div className="text-[8px] uppercase text-text-faint">Сер. програш</div>
          <div className="font-mono text-[15px] font-bold text-rose">
            {avgLoss.toFixed(0)} {currencySymbol}
          </div>
        </div>
      </div>

      {correlations.length > 0 && (
        <>
          <div className="mb-2 mt-1 text-[11px] font-bold uppercase tracking-wide text-text-faint">
            Поведінкові кореляції
          </div>
          {correlations.map((c) => (
            <CorrelationCard key={c.title} title={c.title} correlation={c.correlation} />
          ))}
        </>
      )}

      {curve.length > 1 && (
        <div className="mb-3 rounded-card border border-border bg-surface p-3.5 shadow-card">
          <div className="text-[12px] font-semibold text-text">Win rate протягом торгового дня</div>
          <div className="mt-0.5 text-[10.5px] text-text-faint">За часом входу в позицію, тримай палець на стовпчику</div>
          <div ref={curveContainerRef} className="relative mt-3 flex h-[70px] items-end gap-1">
            {curve.map((c) => (
              <div key={c.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div
                  {...curveBind(c.winRate !== null ? `${c.hour}:00 — ${c.winRate}% win rate` : `${c.hour}:00 — немає угод`)}
                  className="w-full rounded-t-[3px]"
                  style={{
                    height: c.winRate !== null ? `${Math.max(6, (c.winRate / maxCurveWinRate) * 100)}%` : "2%",
                    background: c.winRate === null ? "var(--surface-2)" : "var(--sky)",
                  }}
                />
              </div>
            ))}
            <ChartTooltipBubble tooltip={curveTooltipState} />
          </div>
          <div className="mt-1.5 flex justify-between text-[8.5px] font-semibold text-text-faint">
            <span>{curve[0].hour}:00</span>
            <span>{curve[curve.length - 1].hour}:00</span>
          </div>
        </div>
      )}

      {riskOfRuin && <RiskOfRuinGauge result={riskOfRuin} />}

      {account && <KellyCriterionCard kelly={kelly} currentRiskPercent={currentRiskPercent} neededTrades={kellyNeeded} />}

      {monteCarlo && <MonteCarloCard projection={monteCarlo} currencySymbol={currencySymbol} />}

      {setupEdges.length > 0 && <SetupEdgeCard edges={setupEdges} />}

      {tagCombos.length > 0 && (
        <div className="mb-3 rounded-card border border-border bg-surface p-3.5 shadow-card">
          <div className="mb-2.5 text-[12px] font-semibold text-text">Найефективніші комбінації тегів</div>
          {tagCombos.map((combo, i) => (
            <div
              key={combo.tagNames.join("+")}
              className="flex items-center gap-2.5 border-b border-border py-2 last:border-b-0"
            >
              <span className="w-4 flex-shrink-0 font-mono text-[12px] text-text-faint">{i + 1}</span>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {combo.tagNames.map((name) => (
                  <span key={name} className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-bold text-text-dim">
                    {name}
                  </span>
                ))}
              </div>
              <span className="flex-shrink-0 font-mono text-[12.5px] font-bold text-sage">{combo.winRate}% WR</span>
            </div>
          ))}
        </div>
      )}

      {revenge.count > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-card border border-clay/25 bg-clay-soft p-3.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface text-clay">
            <AlertTriangleIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-bold text-clay">Патерн помстливого трейдингу</div>
            <div className="mt-1 text-[11px] leading-relaxed text-text-dim">
              {revenge.count} раз{revenge.count === 1 ? "" : "и"} за весь час обсяг наступної угоди після збитку був
              помітно більшим за звичайний — схоже на спробу «відіграватися». Варто заздалегідь зафіксувати ліміт
              розміру позиції на день.
            </div>
          </div>
        </div>
      )}

      <div className="mb-3 rounded-card-sm bg-surface shadow-card p-3">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
          Витрати брокера (за період)
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[12px] text-text-dim">Комісія</span>
          <span className="font-mono text-[13px] font-semibold text-clay">-{totalCommission.toFixed(2)} {currencySymbol}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[12px] text-text-dim">Своп</span>
          <span className={cn("font-mono text-[13px] font-semibold", totalSwap >= 0 ? "text-sage" : "text-clay")}>
            {totalSwap >= 0 ? "+" : ""}
            {totalSwap.toFixed(2)} {currencySymbol}
          </span>
        </div>
      </div>

      <div className="mb-2 mt-1 text-[11px] font-bold uppercase tracking-wide text-text-faint">Детальна розбивка</div>
      <GroupTable title="По інструменту" groups={byInstrument} currencySymbol={currencySymbol} />
      <GroupTable title="По тегу / сетапу" groups={byTag} currencySymbol={currencySymbol} />
      <GroupTable title="По сесії" groups={bySession} currencySymbol={currencySymbol} />

      {closed.length === 0 && (
        <div className="rounded-card-sm bg-surface shadow-card py-8 text-center text-[11.5px] text-text-faint">
          Ще немає закритих угод за цей період
        </div>
      )}
    </div>
  );
}

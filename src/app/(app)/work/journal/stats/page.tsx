"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CURRENCIES, useAppStore } from "@/lib/store";
import { useJournalStore } from "@/lib/journal-store";
import { useJournalConfigStore } from "@/lib/journal-config-store";
import { useTradingAccounts } from "@/lib/trading-accounts";
import { useTraderOnlyGuard } from "@/lib/use-trader-guard";
import {
  closedTradesWithNet,
  computeHourlyPerformanceCurve,
  computeLateHourCorrelation,
  computePlanCorrelation,
  computePostLossPauseCorrelation,
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
} from "@/lib/trade-risk-analytics";
import { smoothPath, smoothArea } from "@/lib/smooth-path";
import { useContinuousChartTooltip, ChartTooltipBubble } from "@/components/ui/ChartTooltip";
import { MetricInfoSheet, InfoBadge, METRIC_INFO_ROW_ICONS } from "@/components/ui/MetricInfoSheet";
import { cn } from "@/lib/cn";
import { SparkleIcon, AlertTriangleIcon, TrendingUpIcon, TrendingDownIcon, TargetIcon, BarChartIcon } from "@/components/icons";

const PERIOD_TABS: { id: AnalyticsPeriod; label: string }[] = [
  { id: "week", label: "Тиждень" },
  { id: "month", label: "Місяць" },
  { id: "quarter", label: "Квартал" },
];

const PERIOD_LABEL_GENITIVE: Record<AnalyticsPeriod, string> = {
  week: "тижня",
  month: "місяця",
  quarter: "кварталу",
};

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = { week: 7, month: 30, quarter: 90 };

/** Shared small-caps section heading used above every analytics card on
 *  this screen — same style repeated before each section per the reference
 *  design, not a one-off. `info` renders an InfoBadge flush right, for the
 *  three sections complex enough to need a "what is this" explainer. */
function SectionLabel({ children, info }: { children: React.ReactNode; info?: React.ReactNode }) {
  return (
    <div className="mb-[10px] mt-[18px] flex items-center justify-between">
      <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">{children}</div>
      {info}
    </div>
  );
}

function CorrelationCard({ title, correlation }: { title: string; correlation: BinaryCorrelation }) {
  // The healthier side is whichever one the trader can choose to be on more
  // often — "за планом" / "решта дня" / "довша пауза" — so it's always `a`
  // here by construction of the trade-insights.ts functions, not something
  // this component has to infer from the numbers.
  const diff = correlation.aWinRate - correlation.bWinRate;
  const positive = diff >= 0;
  return (
    <div className="card-raised mb-2 flex items-start gap-3 rounded-card bg-surface p-3.5">
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
    <div className="card-raised mb-3 rounded-card bg-surface p-3.5">
      <div className="text-[10.5px] text-text-faint">Ймовірність втратити 50%+ депозиту при поточній стратегії ризику</div>
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
  sampleSize,
}: {
  kelly: NonNullable<ReturnType<typeof computeKellyCriterion>> | null;
  currentRiskPercent: number | null;
  neededTrades: number;
  sampleSize: number;
}) {
  return (
    <div className="card-raised mb-3 rounded-card bg-surface p-3.5">
      <div className="mb-3 text-[10.5px] text-text-faint">
        Розраховано з твоєї реальної статистики за {sampleSize} угод
      </div>
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
    <div className="card-raised mb-3 rounded-card bg-surface p-3.5">
      <div className="mb-3 text-[10.5px] text-text-faint">Тримай палець на області, щоб побачити ймовірний діапазон</div>
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

/** Win rate over the trading day — a real line+area chart (not bars): the
 *  reference design calls for a continuous curve you can drag a finger
 *  along, matching the same interaction as the Monte Carlo band below.
 *  Hours with no trades break the line rather than forcing a fake zero. */
function HourlyCurveCard({ curve }: { curve: { hour: number; winRate: number | null; count: number }[] }) {
  const width = 320;
  const height = 60;
  const known = curve.map((c, i) => ({ i, c })).filter((x) => x.c.winRate !== null);
  const min = Math.min(0, ...known.map((x) => x.c.winRate as number));
  const max = Math.max(100, ...known.map((x) => x.c.winRate as number));
  const range = max - min || 1;

  const toX = (i: number) => (i / (curve.length - 1 || 1)) * width;
  const toY = (v: number) => height - ((v - min) / range) * height;

  const points = known.map((x) => ({ x: toX(x.i), y: toY(x.c.winRate as number) }));
  const linePath = smoothPath(points);
  const areaPath = smoothArea(points, height);

  const tooltipValues = curve.map((c) => (c.winRate !== null ? `${c.hour}:00 — ${c.winRate}% WR` : `${c.hour}:00 — немає угод`));
  const { containerRef, tooltip, handlers } = useContinuousChartTooltip(tooltipValues);

  return (
    <div className="card-raised mb-3 rounded-card bg-surface p-3.5">
      <div className="text-[12px] font-semibold text-text">Win rate протягом торгового дня</div>
      <div className="mt-0.5 text-[10.5px] text-text-faint">За часом входу в позицію, тримай палець на графіку</div>
      <div ref={containerRef} className="relative mt-3" {...handlers}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <path d={areaPath} fill="var(--sky)" fillOpacity="0.16" />
          <path d={linePath} fill="none" stroke="var(--sky)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <ChartTooltipBubble tooltip={tooltip} />
      </div>
      <div className="mt-1.5 flex justify-between text-[8.5px] font-semibold text-text-faint">
        <span>{curve[0].hour}:00</span>
        <span>{curve[curve.length - 1].hour}:00</span>
      </div>
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
  const [openInfo, setOpenInfo] = useState<"ruin" | "kelly" | "mc" | null>(null);

  const { trades: allTrades } = useJournalStore();
  const accountTrades = useMemo(
    () => (accountId ? allTrades.filter((t) => t.accountId === accountId) : allTrades),
    [allTrades, accountId]
  );
  const trades = useMemo(() => tradesInPeriod(accountTrades, period), [accountTrades, period]);
  const { instruments } = useJournalConfigStore();

  const instrumentById = useMemo(() => new Map(instruments.map((i) => [i.id, i])), [instruments]);

  const narrative = useWorkAnalyticsInsightSync(period);
  const narrativeText = narrative.streamingText ?? narrative.cached?.text ?? "";

  const closed = closedTradesWithNet(trades, instrumentById);

  const planCorrelation = computePlanCorrelation(trades, instrumentById);
  const lateHourCorrelation = computeLateHourCorrelation(trades, instrumentById);
  const pauseCorrelation = computePostLossPauseCorrelation(trades, instrumentById);
  const correlations = [
    planCorrelation && { title: "Дотримання плану/чек-листа перед входом", correlation: planCorrelation },
    lateHourCorrelation && { title: "Пізні угоди проти решти дня", correlation: lateHourCorrelation },
    pauseCorrelation && { title: "Пауза після збиткової угоди перед наступною", correlation: pauseCorrelation },
  ].filter((x): x is { title: string; correlation: BinaryCorrelation } => !!x);

  const curve = computeHourlyPerformanceCurve(trades, instrumentById);

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

  // Revenge-trading pattern is checked over the account's whole history, not
  // just the selected period — see detectRevengeTrading's own note.
  const revenge = detectRevengeTrading(accountTrades, instrumentById);

  if (!isTrader) return null;

  return (
    <div>
      <div className="pb-3.5 pt-2">
        <Link href="/work" className="mb-2 flex items-center gap-2 text-[12.5px] text-text-dim">
          <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">
            ‹
          </span>
          Робота
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
          <SparkleIcon className="h-3.5 w-3.5" /> Розбір {PERIOD_LABEL_GENITIVE[period]}
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
            Згенеровано на основі {closed.length} угод за останні {PERIOD_DAYS[period]} днів
          </div>
        )}
      </div>

      {correlations.length > 0 && (
        <>
          <SectionLabel>Поведінкові кореляції</SectionLabel>
          {correlations.map((c) => (
            <CorrelationCard key={c.title} title={c.title} correlation={c.correlation} />
          ))}
        </>
      )}

      {curve.length > 1 && (
        <>
          <SectionLabel>Крива результативності за часом сесії</SectionLabel>
          <HourlyCurveCard curve={curve} />
        </>
      )}

      {riskOfRuin && (
        <>
          <SectionLabel info={<InfoBadge label="Ризик розорення" onClick={() => setOpenInfo("ruin")} />}>
            Ризик розорення
          </SectionLabel>
          <RiskOfRuinGauge result={riskOfRuin} />
        </>
      )}

      {account && (
        <>
          <SectionLabel info={<InfoBadge label="Kelly Criterion" onClick={() => setOpenInfo("kelly")} />}>
            Kelly Criterion — оптимальний ризик
          </SectionLabel>
          <KellyCriterionCard
            kelly={kelly}
            currentRiskPercent={currentRiskPercent}
            neededTrades={kellyNeeded}
            sampleSize={rMultiples.length}
          />
        </>
      )}

      {monteCarlo && (
        <>
          <SectionLabel info={<InfoBadge label="Monte Carlo" onClick={() => setOpenInfo("mc")} />}>
            Monte Carlo · 1000 симуляцій
          </SectionLabel>
          <MonteCarloCard projection={monteCarlo} currencySymbol={currencySymbol} />
        </>
      )}

      {revenge.count > 0 && (
        <>
          <SectionLabel>Попередження</SectionLabel>
          <div className="card-raised mb-4 flex items-start gap-3 rounded-card border border-clay/25 bg-clay-soft p-3.5">
            <div className="well-pressed flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface text-clay">
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
        </>
      )}

      {closed.length === 0 && (
        <div className="card-raised rounded-card-sm bg-surface py-8 text-center text-[11.5px] text-text-faint">
          Ще немає закритих угод за цей період
        </div>
      )}

      {openInfo === "ruin" && (
        <MetricInfoSheet
          icon={<TrendingDownIcon className="h-4 w-4" />}
          title="Ризик розорення"
          onClose={() => setOpenInfo(null)}
          rows={[
            {
              icon: METRIC_INFO_ROW_ICONS.what,
              label: "Що це",
              text: "Ймовірність, що серія збиткових угод підряд знищить половину депозиту при поточному розмірі ризику.",
            },
            {
              icon: METRIC_INFO_ROW_ICONS.read,
              label: "Як читати",
              text: "Нижче число — безпечніше. До 10% вважається прийнятним ризиком, вище 25% — сигнал зменшити розмір позиції.",
            },
            {
              icon: METRIC_INFO_ROW_ICONS.calc,
              label: "Як рахується",
              text: "Формула ризику розорення на основі твого win rate, середнього R:R і поточного % ризику на угоду — стандартна модель для серії ставок із фіксованим ризиком.",
            },
          ]}
        />
      )}

      {openInfo === "kelly" && (
        <MetricInfoSheet
          icon={<TargetIcon className="h-4 w-4" />}
          title="Kelly Criterion"
          onClose={() => setOpenInfo(null)}
          rows={[
            {
              icon: METRIC_INFO_ROW_ICONS.what,
              label: "Що це",
              text: "Математично виведений оптимальний розмір ризику на угоду, що максимізує довгостроковий ріст депозиту при твоїй реальній результативності.",
            },
            {
              icon: METRIC_INFO_ROW_ICONS.read,
              label: "Як читати",
              text: "«Оптимально» — це половина повного значення Kelly (Kelly/2) — консервативніша версія, повний Kelly вважається занадто агресивним для практичного використання.",
            },
            {
              icon: METRIC_INFO_ROW_ICONS.calc,
              label: "Як рахується",
              text: "Формула Келлі на основі твого win rate і середнього співвідношення виграшу до програшу за останні угоди — що вищий і стабільніший edge, то вищий рекомендований ризик.",
            },
          ]}
        />
      )}

      {openInfo === "mc" && (
        <MetricInfoSheet
          icon={<BarChartIcon className="h-4 w-4" />}
          title="Monte Carlo"
          onClose={() => setOpenInfo(null)}
          rows={[
            {
              icon: METRIC_INFO_ROW_ICONS.what,
              label: "Що це",
              text: "1000 випадкових прогонів твоєї торгової стратегії в майбутнє — показує не одне число-прогноз, а реалістичний діапазон можливих результатів.",
            },
            {
              icon: METRIC_INFO_ROW_ICONS.read,
              label: "Як читати",
              text: "Область на графіку — це коридор між песимістичним і оптимістичним сценарієм, лінія посередині — типовий/медіанний результат.",
            },
            {
              icon: METRIC_INFO_ROW_ICONS.calc,
              label: "Як рахується",
              text: "Bootstrap-семплювання — випадковим чином перемішуються реальні R-множники твоїх минулих угод у нові послідовності, для кожної рахується кумулятивний результат, з усіх 1000 прогонів будується діапазон.",
            },
          ]}
        />
      )}
    </div>
  );
}

import type { Trade } from "./journal-store";
import type { JournalInstrument, JournalSession, JournalTag } from "./journal-config-store";
import { computeTradePnL } from "./trade-calculations";

export const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/** Monday-first weekday index (0=Пн..6=Нд) for a trade's "YYYY-MM-DD" date —
 *  matches the Mon-Sun convention `startOfWeek` already uses on the finance
 *  side, so the heatmap's columns read the same way the rest of the app
 *  already defines a week. */
function weekdayIndex(dateKey: string): number {
  const d = new Date(`${dateKey}T00:00:00`);
  return (d.getDay() + 6) % 7;
}

/** Consecutive TRADING days (walking backwards from the most recent one),
 *  where every trade logged that day has `followedPlan === true`. Days with
 *  no trades are simply skipped, not treated as breaking the streak — a
 *  weekend or a day off isn't a discipline lapse. The first day that
 *  contains even one trade marked `false` or left unanswered stops the
 *  count, since an unanswered trade isn't evidence the plan was followed. */
export function computeDisciplineStreak(trades: Trade[]): number {
  const byDate = new Map<string, Trade[]>();
  for (const t of trades) {
    const bucket = byDate.get(t.date);
    if (bucket) bucket.push(t);
    else byDate.set(t.date, [t]);
  }

  const tradingDaysDesc = [...byDate.keys()].sort().reverse();
  let streak = 0;
  for (const day of tradingDaysDesc) {
    const allFollowed = byDate.get(day)!.every((t) => t.followedPlan === true);
    if (!allFollowed) break;
    streak++;
  }
  return streak;
}

export interface HeatmapCell {
  weekday: number; // 0=Пн..6=Нд
  count: number;
  avgPnl: number | null; // null when this session+weekday has no closed trades yet
  trades: Trade[];
}

export interface SessionHeatmapRow {
  sessionId: string;
  sessionName: string;
  cells: HeatmapCell[]; // always length 7, index === weekday
}

// The seeded sessions are the spec's own row order (Азія/Лондон/Нью-Йорк);
// any session the user added beyond those three is appended after, in
// whatever order the store already has them — real data always wins over a
// fixed list, this just keeps the three well-known ones predictable.
const PREFERRED_SESSION_ORDER = ["sess-asia", "sess-london", "sess-ny"];

/** Average net P&L per (session × weekday) cell, built only from closed
 *  trades that actually have a session assigned. */
export function computeSessionHeatmap(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>,
  sessions: JournalSession[]
): SessionHeatmapRow[] {
  const closed = trades.filter((t) => t.status === "closed" && t.sessionId);

  const orderedSessions = [...sessions].sort((a, b) => {
    const ai = PREFERRED_SESSION_ORDER.indexOf(a.id);
    const bi = PREFERRED_SESSION_ORDER.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return orderedSessions.map((session) => {
    const cells: HeatmapCell[] = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      count: 0,
      avgPnl: null,
      trades: [],
    }));

    for (const t of closed) {
      if (t.sessionId !== session.id) continue;
      const net = computeTradePnL(t, instrumentById.get(t.instrumentId)).net;
      if (net === null) continue;
      cells[weekdayIndex(t.date)].trades.push(t);
    }

    for (const cell of cells) {
      if (cell.trades.length === 0) continue;
      const sum = cell.trades.reduce(
        (s, t) => s + (computeTradePnL(t, instrumentById.get(t.instrumentId)).net ?? 0),
        0
      );
      cell.count = cell.trades.length;
      cell.avgPnl = sum / cell.trades.length;
    }

    return { sessionId: session.id, sessionName: session.name, cells };
  });
}

export interface RBucket {
  label: string;
  count: number;
}

const R_BUCKET_ROUNDED = [-2, -1, 0, 1, 2, 3];

/** Closed trades bucketed by their rounded R-multiple, clamped into the two
 *  extreme buckets rather than dropped — an outlier trade should still show
 *  up somewhere on the histogram, not silently vanish from the count. */
export function computeRMultipleBuckets(trades: Trade[], instrumentById: Map<string, JournalInstrument>): RBucket[] {
  const counts = new Map<number, number>(R_BUCKET_ROUNDED.map((r) => [r, 0]));
  for (const t of trades) {
    if (t.status !== "closed") continue;
    const r = computeTradePnL(t, instrumentById.get(t.instrumentId)).rMultiple;
    if (r === null) continue;
    const rounded = Math.max(-2, Math.min(3, Math.round(r)));
    counts.set(rounded, (counts.get(rounded) ?? 0) + 1);
  }
  return R_BUCKET_ROUNDED.map((r) => ({ label: r > 0 ? `+${r}R` : `${r}R`, count: counts.get(r) ?? 0 }));
}

/** True when the last `n` closed trades (by entry date+time, most recent
 *  first — the closest proxy to close order this data model has) all lost
 *  money — the "take a pause" trigger, checked before generating a normal
 *  insight. */
export function hasConsecutiveLosses(trades: Trade[], instrumentById: Map<string, JournalInstrument>, n = 2): boolean {
  const closed = trades
    .filter((t) => t.status === "closed")
    .map((t) => ({ t, net: computeTradePnL(t, instrumentById.get(t.instrumentId)).net }))
    .filter((x): x is { t: Trade; net: number } => x.net !== null)
    .sort((a, b) => `${b.t.date}${b.t.time}`.localeCompare(`${a.t.date}${a.t.time}`));

  const lastN = closed.slice(0, n);
  return lastN.length === n && lastN.every((x) => x.net < 0);
}

export interface StrongestSession {
  sessionName: string;
  weekdayLabel: string;
  avgPnl: number;
  count: number;
}

/** The single best-performing (session × weekday) cell across the whole
 *  heatmap — null when there isn't a single closed, session-tagged trade
 *  yet, rather than a misleading "best" pulled from nothing. */
export function findStrongestSession(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>,
  sessions: JournalSession[]
): StrongestSession | null {
  const heatmap = computeSessionHeatmap(trades, instrumentById, sessions);
  let best: StrongestSession | null = null;
  for (const row of heatmap) {
    for (const cell of row.cells) {
      if (cell.avgPnl === null) continue;
      if (!best || cell.avgPnl > best.avgPnl) {
        best = {
          sessionName: row.sessionName,
          weekdayLabel: WEEKDAY_LABELS[cell.weekday],
          avgPnl: cell.avgPnl,
          count: cell.count,
        };
      }
    }
  }
  return best;
}

export interface ClosedTradeNet {
  trade: Trade;
  net: number;
}

/** Closed trades with a real net, ordered by entry date+time ascending —
 *  the shared backbone every correlation/curve function below walks. Entry
 *  time (not close time) is the ordering key throughout this file, same as
 *  hasConsecutiveLosses and the journal page's own equityDeltas: manual
 *  trades never carry a reliable closedAt, so entry order is the only
 *  chronology every trade actually has. */
export function closedTradesWithNet(trades: Trade[], instrumentById: Map<string, JournalInstrument>): ClosedTradeNet[] {
  return trades
    .filter((t) => t.status === "closed")
    .map((t) => ({ trade: t, net: computeTradePnL(t, instrumentById.get(t.instrumentId)).net }))
    .filter((x): x is ClosedTradeNet => x.net !== null)
    .sort((a, b) => `${a.trade.date}${a.trade.time}`.localeCompare(`${b.trade.date}${b.trade.time}`));
}

function winRateOf(list: ClosedTradeNet[]): number {
  return list.length > 0 ? Math.round((list.filter((x) => x.net > 0).length / list.length) * 100) : 0;
}

export interface BinaryCorrelation {
  /** e.g. "дотримувався плану" */
  aLabel: string;
  aWinRate: number;
  aCount: number;
  /** e.g. "порушував план" */
  bLabel: string;
  bWinRate: number;
  bCount: number;
}

/** followedPlan is the app's own stand-in for "checklist was actually
 *  followed" — there's no historical per-trade checklist-completion record
 *  (the pretrade checklist is a single always-reset-before-the-next-trade
 *  list, not logged per trade), but followedPlan already answers the same
 *  underlying question the mockup's "unchecked checklist" correlation asks:
 *  did discipline hold on this specific trade. Null when either side has no
 *  trades yet — a correlation needs both ends. */
export function computePlanCorrelation(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>
): BinaryCorrelation | null {
  const closed = closedTradesWithNet(trades, instrumentById);
  const followed = closed.filter((x) => x.trade.followedPlan === true);
  const broke = closed.filter((x) => x.trade.followedPlan === false);
  if (followed.length === 0 || broke.length === 0) return null;
  return {
    aLabel: "за планом",
    aWinRate: winRateOf(followed),
    aCount: followed.length,
    bLabel: "порушив план",
    bWinRate: winRateOf(broke),
    bCount: broke.length,
  };
}

/** Win rate for trades entered at/after `hourThreshold` (local wall-clock
 *  hour from the trade's own `time` field) vs everything else. */
export function computeLateHourCorrelation(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>,
  hourThreshold = 22
): BinaryCorrelation | null {
  const closed = closedTradesWithNet(trades, instrumentById);
  const late = closed.filter((x) => Number(x.trade.time.split(":")[0]) >= hourThreshold);
  const rest = closed.filter((x) => Number(x.trade.time.split(":")[0]) < hourThreshold);
  if (late.length === 0 || rest.length === 0) return null;
  return {
    aLabel: `після ${hourThreshold}:00`,
    aWinRate: winRateOf(late),
    aCount: late.length,
    bLabel: "решта дня",
    bWinRate: winRateOf(rest),
    bCount: rest.length,
  };
}

/** Minutes between two trades' entry moments, both on "YYYY-MM-DD"+"HH:MM" —
 *  entry time only (see closedTradesWithNet), but for a same-account pair
 *  already ordered chronologically that's exactly the gap that matters: how
 *  long the trader waited before opening the next position. */
function minutesBetween(a: Trade, b: Trade): number {
  const from = new Date(`${a.date}T${a.time}:00`).getTime();
  const to = new Date(`${b.date}T${b.time}:00`).getTime();
  return (to - from) / 60000;
}

/** Of the trades that immediately followed a loss, do the ones opened
 *  quickly after (within `pauseMinutes`) perform worse than the ones where
 *  the trader waited? Null when there aren't losses with a following trade
 *  on both sides of the threshold. */
export function computePostLossPauseCorrelation(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>,
  pauseMinutes = 30
): BinaryCorrelation | null {
  const closed = closedTradesWithNet(trades, instrumentById);
  const shortPause: ClosedTradeNet[] = [];
  const longPause: ClosedTradeNet[] = [];
  for (let i = 1; i < closed.length; i++) {
    if (closed[i - 1].net >= 0) continue;
    const gap = minutesBetween(closed[i - 1].trade, closed[i].trade);
    if (gap < pauseMinutes) shortPause.push(closed[i]);
    else longPause.push(closed[i]);
  }
  if (shortPause.length === 0 || longPause.length === 0) return null;
  return {
    aLabel: `пауза < ${pauseMinutes} хв після збитку`,
    aWinRate: winRateOf(shortPause),
    aCount: shortPause.length,
    bLabel: `пауза ≥ ${pauseMinutes} хв`,
    bWinRate: winRateOf(longPause),
    bCount: longPause.length,
  };
}

export interface HourlyPerformance {
  hour: number; // 0-23, local wall-clock hour of the trade's entry time
  winRate: number | null; // null when this hour has no closed trades
  count: number;
}

/** Win rate bucketed by the hour of day trades were entered — covers only
 *  the span between the earliest and latest hour actually traded, not a
 *  fixed 0-23 sweep, so the curve doesn't stretch across hours nobody ever
 *  trades in. */
export function computeHourlyPerformanceCurve(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>
): HourlyPerformance[] {
  const closed = closedTradesWithNet(trades, instrumentById);
  if (closed.length === 0) return [];
  const byHour = new Map<number, ClosedTradeNet[]>();
  for (const x of closed) {
    const hour = Number(x.trade.time.split(":")[0]);
    const list = byHour.get(hour) ?? [];
    list.push(x);
    byHour.set(hour, list);
  }
  const hours = [...byHour.keys()];
  const minHour = Math.min(...hours);
  const maxHour = Math.max(...hours);
  return Array.from({ length: maxHour - minHour + 1 }, (_, i) => {
    const hour = minHour + i;
    const list = byHour.get(hour);
    return { hour, winRate: list ? winRateOf(list) : null, count: list?.length ?? 0 };
  });
}

export interface TagCombination {
  tagNames: string[];
  winRate: number;
  count: number;
}

/** Top tag PAIRS (not individual tags) that occur together at least
 *  `minOccurrences` times, ranked by win rate — a trade with 3+ tags
 *  contributes one entry per pair it contains, same as the mockup's
 *  "setup combinations" framing. */
export function computeTagCombinations(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>,
  tagById: Map<string, JournalTag>,
  minOccurrences = 2
): TagCombination[] {
  const closed = closedTradesWithNet(trades, instrumentById);
  const byPair = new Map<string, ClosedTradeNet[]>();
  for (const x of closed) {
    const ids = [...x.trade.tagIds].sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}|${ids[j]}`;
        const list = byPair.get(key) ?? [];
        list.push(x);
        byPair.set(key, list);
      }
    }
  }
  const combos: TagCombination[] = [];
  for (const [key, list] of byPair) {
    if (list.length < minOccurrences) continue;
    const tagNames = key.split("|").map((id) => tagById.get(id)?.name ?? id);
    combos.push({ tagNames, winRate: winRateOf(list), count: list.length });
  }
  return combos.sort((a, b) => b.winRate - a.winRate).slice(0, 3);
}

/** A trade flagged as a possible "revenge trade": its lot size is at least
 *  `lotMultiplier`× the account's average lot, AND it was opened right after
 *  a loss. Both conditions from the prompt, applied over the trader's whole
 *  closed history (not just one period) — a pattern like this is worth
 *  surfacing even if none of the incidents happened in the currently
 *  selected period. */
export interface ResultStreak {
  results: ("W" | "L" | "B")[]; // oldest to newest, last `n` closed trades
  wins: number;
  losses: number;
  breakeven: number;
  /** Type + length of the run at the very end of `results` — what's true
   *  "right now", walking backwards from the most recent trade. */
  current: { type: "W" | "L" | "B"; count: number } | null;
}

/** Win/loss/breakeven for each of the last `n` closed trades, oldest to
 *  newest — a breakeven (net exactly 0) is its own outcome, not folded into
 *  either win or loss, matching the mockup's own three-way W/L/B labeling. */
export function computeResultStreakStrip(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>,
  n = 14
): ResultStreak {
  const closed = closedTradesWithNet(trades, instrumentById).slice(-n);
  const results: ("W" | "L" | "B")[] = closed.map((x) => (x.net > 0 ? "W" : x.net < 0 ? "L" : "B"));
  let current: ResultStreak["current"] = null;
  for (let i = results.length - 1; i >= 0; i--) {
    if (current === null) current = { type: results[i], count: 1 };
    else if (results[i] === current.type) current.count++;
    else break;
  }
  return {
    results,
    wins: results.filter((r) => r === "W").length,
    losses: results.filter((r) => r === "L").length,
    breakeven: results.filter((r) => r === "B").length,
    current,
  };
}

export interface RiskStabilityPoint {
  lot: number;
  isOutlier: boolean;
}

export interface RiskStability {
  points: RiskStabilityPoint[]; // oldest to newest, last `n` closed trades
  avgLot: number;
  outlierCount: number;
}

/** Position size for each of the last `n` closed trades, flagging anything
 *  at or above `outlierMultiplier`× the average as an outlier — the
 *  "did risk discipline slip" check from the mockup. */
export function computeRiskStability(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>,
  n = 20,
  outlierMultiplier = 1.8
): RiskStability {
  const closed = closedTradesWithNet(trades, instrumentById).slice(-n);
  if (closed.length === 0) return { points: [], avgLot: 0, outlierCount: 0 };
  const avgLot = closed.reduce((sum, x) => sum + x.trade.lot, 0) / closed.length;
  const points = closed.map((x) => ({ lot: x.trade.lot, isOutlier: x.trade.lot >= avgLot * outlierMultiplier }));
  return { points, avgLot, outlierCount: points.filter((p) => p.isOutlier).length };
}

export interface PeriodComparisonSide {
  net: number;
  winRate: number;
}

export interface PeriodComparison {
  current: PeriodComparisonSide;
  previous: PeriodComparisonSide;
}

/** Net P&L + win rate for the current calendar month vs the previous one —
 *  calendar-month boundaries (not "last 30 days"), matching the mockup's own
 *  "цей місяць проти минулого" framing. */
export function computeMonthVsLastMonth(trades: Trade[], instrumentById: Map<string, JournalInstrument>): PeriodComparison {
  const now = new Date();
  const currentPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const closed = closedTradesWithNet(trades, instrumentById);
  const side = (prefix: string): PeriodComparisonSide => {
    const list = closed.filter((x) => x.trade.date.startsWith(prefix));
    return { net: list.reduce((sum, x) => sum + x.net, 0), winRate: winRateOf(list) };
  };
  return { current: side(currentPrefix), previous: side(prevPrefix) };
}

export interface ExtremeTrade {
  trade: Trade;
  net: number;
  rMultiple: number | null;
}

export interface ExtremePoints {
  best: ExtremeTrade | null;
  worst: ExtremeTrade | null;
}

/** The single best and single worst closed trade of the last `n` trades —
 *  the "крайні точки" cards. Both null only when there are no closed trades
 *  at all; with exactly one closed trade, best and worst are the same trade. */
export function computeExtremePoints(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>,
  n = 20
): ExtremePoints {
  const closed = closedTradesWithNet(trades, instrumentById).slice(-n);
  if (closed.length === 0) return { best: null, worst: null };
  let best = closed[0];
  let worst = closed[0];
  for (const x of closed) {
    if (x.net > best.net) best = x;
    if (x.net < worst.net) worst = x;
  }
  const withR = (x: ClosedTradeNet): ExtremeTrade => ({
    trade: x.trade,
    net: x.net,
    rMultiple: computeTradePnL(x.trade, instrumentById.get(x.trade.instrumentId)).rMultiple,
  });
  return { best: withR(best), worst: withR(worst) };
}

export function detectRevengeTrading(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>,
  lotMultiplier = 1.4
): { count: number; trades: Trade[] } {
  const closed = closedTradesWithNet(trades, instrumentById);
  if (closed.length < 2) return { count: 0, trades: [] };
  const avgLot = closed.reduce((sum, x) => sum + x.trade.lot, 0) / closed.length;
  const incidents: Trade[] = [];
  for (let i = 1; i < closed.length; i++) {
    if (closed[i - 1].net >= 0) continue;
    if (closed[i].trade.lot >= avgLot * lotMultiplier) incidents.push(closed[i].trade);
  }
  return { count: incidents.length, trades: incidents };
}

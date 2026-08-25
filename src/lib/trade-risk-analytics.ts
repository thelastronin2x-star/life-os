import type { Trade } from "./journal-store";
import type { JournalInstrument, JournalTag } from "./journal-config-store";
import { computeTradePnL } from "./trade-calculations";
import { closedTradesWithNet, type ClosedTradeNet } from "./trade-insights";

export const MIN_TRADES_FOR_KELLY = 30;
export const MIN_TRADES_FOR_SETUP_EDGE = 20;

function winRateOf(list: ClosedTradeNet[]): number {
  return list.length > 0 ? Math.round((list.filter((x) => x.net > 0).length / list.length) * 100) : 0;
}

/** Every closed trade's R-multiple, oldest→newest — the raw input Kelly,
 *  risk-of-ruin, and the Monte Carlo simulation all resample from. */
export function extractRMultiples(trades: Trade[], instrumentById: Map<string, JournalInstrument>): number[] {
  return closedTradesWithNet(trades, instrumentById)
    .map((x) => computeTradePnL(x.trade, instrumentById.get(x.trade.instrumentId)).rMultiple)
    .filter((r): r is number => r !== null);
}

/** The journal has no first-class "planned risk %" field (see Trade in
 *  journal-store.ts) — this estimates it from what's already there: a
 *  trade's `gross` P&L and its `rMultiple` are both derived purely from
 *  entry/stop/close price and lot size, with no commission noise, so
 *  `gross / rMultiple` is the $ value that trade's "1R" actually was.
 *  Expressed as a % of the account deposit, that's the risk that trade
 *  took. Averaged across trades, not tracked — an estimate, not a fact. */
export function estimateAverageRiskPercent(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>,
  accountDeposit: number
): number | null {
  if (accountDeposit <= 0) return null;
  const estimates: number[] = [];
  for (const { trade } of closedTradesWithNet(trades, instrumentById)) {
    const pnl = computeTradePnL(trade, instrumentById.get(trade.instrumentId));
    if (pnl.rMultiple === null || Math.abs(pnl.rMultiple) < 0.2 || pnl.gross === null) continue;
    const oneRInCurrency = Math.abs(pnl.gross / pnl.rMultiple);
    estimates.push((oneRInCurrency / accountDeposit) * 100);
  }
  if (estimates.length === 0) return null;
  return estimates.reduce((s, v) => s + v, 0) / estimates.length;
}

export interface KellyResult {
  winRate: number; // 0-1
  avgRR: number;
  fullKelly: number; // fraction, e.g. 0.032 = 3.2%
  halfKelly: number;
}

/** f* = W - (1-W)/R (Kelly Criterion), where W is win rate and R is the
 *  ratio of the average winning R-multiple to the average losing one.
 *  Half-Kelly is the conventionally recommended sizing — full Kelly is
 *  mathematically optimal for long-run growth only if the edge (W, R)
 *  never changes, which a real trading edge doesn't hold still for. */
export function computeKellyCriterion(rMultiples: number[]): KellyResult | null {
  if (rMultiples.length < MIN_TRADES_FOR_KELLY) return null;
  const wins = rMultiples.filter((r) => r > 0);
  const losses = rMultiples.filter((r) => r <= 0);
  if (wins.length === 0 || losses.length === 0) return null;

  const winRate = wins.length / rMultiples.length;
  const avgWin = wins.reduce((s, r) => s + r, 0) / wins.length;
  const avgLoss = Math.abs(losses.reduce((s, r) => s + r, 0) / losses.length);
  if (avgLoss === 0) return null;

  const avgRR = avgWin / avgLoss;
  const fullKelly = winRate - (1 - winRate) / avgRR;
  return { winRate, avgRR, fullKelly, halfKelly: fullKelly / 2 };
}

export function tradesNeededForKelly(rMultiples: number[]): number {
  return Math.max(0, MIN_TRADES_FOR_KELLY - rMultiples.length);
}

const RUIN_EQUITY_FLOOR = 0.5; // "lose 50%+ of the deposit"
const RUIN_SIMULATIONS = 1000;
const RUIN_SIMULATION_TRADES = 200; // a representative long-run horizon, not the visible projection window

function ruinProbabilityPercent(rMultiples: number[], riskPercent: number, random: () => number): number {
  if (rMultiples.length === 0 || riskPercent <= 0) return 0;
  const riskFraction = riskPercent / 100;
  let ruinedCount = 0;
  for (let s = 0; s < RUIN_SIMULATIONS; s++) {
    let equity = 1;
    for (let i = 0; i < RUIN_SIMULATION_TRADES; i++) {
      const r = rMultiples[Math.floor(random() * rMultiples.length)];
      equity *= 1 + r * riskFraction;
      if (equity <= RUIN_EQUITY_FLOOR) {
        ruinedCount++;
        break;
      }
    }
  }
  return Math.round((ruinedCount / RUIN_SIMULATIONS) * 100);
}

export interface RiskOfRuinResult {
  currentRiskPercent: number;
  ruinProbabilityPercent: number;
  higherRiskPercent: number;
  ruinProbabilityAtHigherRisk: number;
}

/** There is no single agreed closed-form "risk of ruin" formula for fixed-
 *  fractional position sizing (unlike the classic fixed-stake gambler's
 *  ruin problem) — real trading tools estimate it by simulation instead,
 *  which is what this does: bootstrap-resample the trader's own historical
 *  R-multiples (with replacement) over a long run of trades, compounding a
 *  fixed % risk of current equity each time, and report what fraction of
 *  simulated paths ever drop to half the starting deposit. Also reports
 *  the same probability at a higher risk level, for the "what if I risked
 *  more" comparison the UI shows alongside it. */
export function computeRiskOfRuin(
  rMultiples: number[],
  currentRiskPercent: number,
  random: () => number = Math.random
): RiskOfRuinResult | null {
  if (rMultiples.length < 10 || currentRiskPercent <= 0) return null;
  const higherRiskPercent = Math.min(10, currentRiskPercent + 2);
  return {
    currentRiskPercent,
    ruinProbabilityPercent: ruinProbabilityPercent(rMultiples, currentRiskPercent, random),
    higherRiskPercent,
    ruinProbabilityAtHigherRisk: ruinProbabilityPercent(rMultiples, higherRiskPercent, random),
  };
}

const MC_SIMULATIONS = 1000;
const MC_WEEKS = 4;

export interface MonteCarloWeekPoint {
  week: number; // 1-indexed
  low: number; // 10th percentile cumulative $ P&L
  high: number; // 90th percentile cumulative $ P&L
}

/** Projects the next 4 weeks by bootstrap-resampling real historical
 *  R-multiples (with replacement), applying a fixed $ risk per trade
 *  (not compounding — over 4 weeks the difference from compounding is
 *  small, and a fixed $-per-R keeps the output directly readable as
 *  money). `tradesPerWeek` should come from the trader's own recent
 *  frequency, not a guess. Returns the 10th/90th percentile of cumulative
 *  $ P&L at each week boundary, across all simulated paths — a range, not
 *  a point prediction. */
export function computeMonteCarloProjection(
  rMultiples: number[],
  riskAmountPerTrade: number,
  tradesPerWeek: number,
  random: () => number = Math.random
): MonteCarloWeekPoint[] | null {
  if (rMultiples.length < 10 || tradesPerWeek <= 0 || riskAmountPerTrade <= 0) return null;

  const tradesTotal = Math.max(MC_WEEKS, Math.round(tradesPerWeek * MC_WEEKS));
  const weekBoundaries = Array.from({ length: MC_WEEKS }, (_, w) => Math.round((tradesTotal * (w + 1)) / MC_WEEKS));
  const cumulativeAtWeek: number[][] = weekBoundaries.map(() => []);

  for (let s = 0; s < MC_SIMULATIONS; s++) {
    let cumulative = 0;
    let boundaryIdx = 0;
    for (let i = 1; i <= tradesTotal; i++) {
      const r = rMultiples[Math.floor(random() * rMultiples.length)];
      cumulative += r * riskAmountPerTrade;
      if (boundaryIdx < weekBoundaries.length && i === weekBoundaries[boundaryIdx]) {
        cumulativeAtWeek[boundaryIdx].push(cumulative);
        boundaryIdx++;
      }
    }
  }

  function percentile(sorted: number[], p: number): number {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
    return sorted[idx];
  }

  return weekBoundaries.map((_, i) => {
    const sorted = [...cumulativeAtWeek[i]].sort((a, b) => a - b);
    return { week: i + 1, low: percentile(sorted, 0.1), high: percentile(sorted, 0.9) };
  });
}

export interface SetupEdge {
  tagName: string;
  winRate: number;
  count: number;
  lowSample: boolean;
}

/** Win rate per INDIVIDUAL tag (not pairs — see computeTagCombinations in
 *  trade-insights.ts for the pair-based ranking used elsewhere on this
 *  screen). `lowSample` flags a tag below the confidence threshold so the
 *  UI can warn rather than imply a settled verdict from a handful of
 *  trades. */
export function computeSetupEdge(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>,
  tagById: Map<string, JournalTag>,
  minSampleSize = MIN_TRADES_FOR_SETUP_EDGE
): SetupEdge[] {
  const closed = closedTradesWithNet(trades, instrumentById);
  const byTag = new Map<string, ClosedTradeNet[]>();
  for (const x of closed) {
    for (const tagId of x.trade.tagIds) {
      const list = byTag.get(tagId) ?? [];
      list.push(x);
      byTag.set(tagId, list);
    }
  }

  const edges: SetupEdge[] = [];
  for (const [tagId, list] of byTag) {
    edges.push({
      tagName: tagById.get(tagId)?.name ?? tagId,
      winRate: winRateOf(list),
      count: list.length,
      lowSample: list.length < minSampleSize,
    });
  }
  return edges.sort((a, b) => b.winRate - a.winRate).slice(0, 6);
}

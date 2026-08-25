import { describe, expect, it } from "vitest";
import {
  computeKellyCriterion,
  tradesNeededForKelly,
  computeRiskOfRuin,
  computeMonteCarloProjection,
  computeSetupEdge,
  MIN_TRADES_FOR_KELLY,
} from "./trade-risk-analytics";
import type { Trade } from "./journal-store";
import type { JournalInstrument, JournalTag } from "./journal-config-store";

/** A simple deterministic PRNG (mulberry32) so simulation-based tests are
 *  reproducible instead of depending on Math.random. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("computeKellyCriterion", () => {
  it("returns null below the minimum trade count", () => {
    const rMultiples = Array(MIN_TRADES_FOR_KELLY - 1).fill(1);
    expect(computeKellyCriterion(rMultiples)).toBeNull();
  });

  it("computes f* = W - (1-W)/R for a known win rate and R:R", () => {
    // 20 wins of +2R, 10 losses of -1R => W=2/3, avgWin=2, avgLoss=1, R=2
    const rMultiples = [...Array(20).fill(2), ...Array(10).fill(-1)];
    const result = computeKellyCriterion(rMultiples);
    expect(result).not.toBeNull();
    expect(result!.winRate).toBeCloseTo(2 / 3, 5);
    expect(result!.avgRR).toBeCloseTo(2, 5);
    // f* = 2/3 - (1/3)/2 = 2/3 - 1/6 = 0.5
    expect(result!.fullKelly).toBeCloseTo(0.5, 5);
    expect(result!.halfKelly).toBeCloseTo(0.25, 5);
  });

  it("returns null when there are no losing trades to form a ratio", () => {
    expect(computeKellyCriterion(Array(MIN_TRADES_FOR_KELLY).fill(1))).toBeNull();
  });
});

describe("tradesNeededForKelly", () => {
  it("reports how many more trades are needed", () => {
    expect(tradesNeededForKelly(Array(10).fill(1))).toBe(MIN_TRADES_FOR_KELLY - 10);
  });

  it("floors at zero once the minimum is met", () => {
    expect(tradesNeededForKelly(Array(MIN_TRADES_FOR_KELLY + 5).fill(1))).toBe(0);
  });
});

describe("computeRiskOfRuin", () => {
  const random = seededRandom(42);

  it("returns null with too little history", () => {
    expect(computeRiskOfRuin(Array(5).fill(1), 1, random)).toBeNull();
  });

  it("reports ~0% ruin probability for a consistently winning system", () => {
    const rMultiples = Array(50).fill(2); // every trade wins 2R
    const result = computeRiskOfRuin(rMultiples, 1, random);
    expect(result).not.toBeNull();
    expect(result!.ruinProbabilityPercent).toBe(0);
  });

  it("reports high ruin probability for a consistently losing system", () => {
    const rMultiples = Array(50).fill(-1); // every trade is a full stop-out
    const result = computeRiskOfRuin(rMultiples, 5, random);
    expect(result).not.toBeNull();
    expect(result!.ruinProbabilityPercent).toBeGreaterThan(90);
  });

  it("shows higher risk implies a higher or equal ruin probability", () => {
    const rMultiples = [...Array(15).fill(1.5), ...Array(15).fill(-1)];
    const result = computeRiskOfRuin(rMultiples, 1, random);
    expect(result).not.toBeNull();
    expect(result!.higherRiskPercent).toBeGreaterThan(result!.currentRiskPercent);
    expect(result!.ruinProbabilityAtHigherRisk).toBeGreaterThanOrEqual(result!.ruinProbabilityPercent);
  });
});

describe("computeMonteCarloProjection", () => {
  const random = seededRandom(7);

  it("returns null with too little history", () => {
    expect(computeMonteCarloProjection(Array(5).fill(1), 100, 5, random)).toBeNull();
  });

  it("returns 4 weeks with low <= high at every week", () => {
    const rMultiples = [...Array(20).fill(1.5), ...Array(20).fill(-1)];
    const result = computeMonteCarloProjection(rMultiples, 100, 10, random);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(4);
    expect(result!.map((w) => w.week)).toEqual([1, 2, 3, 4]);
    for (const point of result!) {
      expect(point.low).toBeLessThanOrEqual(point.high);
    }
  });

  it("projects a positive range for a strongly winning system", () => {
    const rMultiples = Array(30).fill(2);
    const result = computeMonteCarloProjection(rMultiples, 100, 10, random);
    expect(result).not.toBeNull();
    expect(result![3].low).toBeGreaterThan(0);
  });
});

function makeInstrument(overrides: Partial<JournalInstrument> = {}): JournalInstrument {
  return { id: "i1", symbol: "CUSTOM", assetType: "custom", isCustom: true, contractMultiplier: 1, ...overrides };
}

function makeTrade(overrides: Partial<Trade>): Trade {
  return {
    id: crypto.randomUUID(),
    accountId: "acc1",
    instrumentId: "i1",
    direction: "LONG",
    status: "closed",
    date: "2026-01-01",
    time: "10:00",
    entry: 1.1,
    stop: 1.09,
    take: 1.12,
    lot: 1,
    closePrice: 1.11,
    commission: 0,
    swap: 0,
    tagIds: [],
    sessionId: null,
    screenshots: [],
    ...overrides,
  };
}

describe("computeSetupEdge", () => {
  const instrumentById = new Map([["i1", makeInstrument()]]);
  const tagById = new Map<string, JournalTag>([
    ["t1", { id: "t1", name: "OB", isCustom: false }],
    ["t2", { id: "t2", name: "FVG", isCustom: false }],
  ]);

  it("computes win rate per individual tag and flags low sample size", () => {
    const winning = Array.from({ length: 3 }, (_, i) => makeTrade({ id: `w${i}`, tagIds: ["t1"], closePrice: 1.12 }));
    const losing = Array.from({ length: 2 }, (_, i) => makeTrade({ id: `l${i}`, tagIds: ["t1"], closePrice: 1.09 }));
    const trades = [...winning, ...losing];

    const edges = computeSetupEdge(trades, instrumentById, tagById, 10);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ tagName: "OB", count: 5, lowSample: true });
    expect(edges[0].winRate).toBe(60);
  });

  it("does not flag a tag once it reaches the sample threshold", () => {
    const trades = Array.from({ length: 4 }, (_, i) => makeTrade({ id: `t${i}`, tagIds: ["t2"], closePrice: 1.12 }));
    const edges = computeSetupEdge(trades, instrumentById, tagById, 4);
    expect(edges[0].lowSample).toBe(false);
  });
});

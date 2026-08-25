import { describe, expect, it } from "vitest";
import {
  computeDisciplineStreak,
  computeSessionHeatmap,
  computeRMultipleBuckets,
  hasConsecutiveLosses,
  findStrongestSession,
  computePlanCorrelation,
  computeLateHourCorrelation,
  computePostLossPauseCorrelation,
  computeHourlyPerformanceCurve,
  computeTagCombinations,
  detectRevengeTrading,
  computeResultStreakStrip,
  computeRiskStability,
  computeMonthVsLastMonth,
  computeExtremePoints,
} from "./trade-insights";
import type { Trade } from "./journal-store";
import type { JournalInstrument, JournalSession, JournalTag } from "./journal-config-store";

const instrument: JournalInstrument = {
  id: "i1",
  symbol: "BTC/USD",
  assetType: "custom",
  isCustom: true,
  contractMultiplier: 1,
};
const instrumentById = new Map([["i1", instrument]]);

const sessions: JournalSession[] = [
  { id: "sess-london", name: "Лондон", startTime: "08:00", endTime: "17:00", timezoneLabel: "GMT+3", isCustom: false },
  { id: "sess-asia", name: "Азія", startTime: "01:00", endTime: "09:00", timezoneLabel: "GMT+3", isCustom: false },
];

function makeTrade(overrides: Partial<Trade>): Trade {
  return {
    id: crypto.randomUUID(),
    accountId: null,
    instrumentId: "i1",
    direction: "LONG",
    status: "closed",
    date: "2026-01-05", // a Monday
    time: "10:00",
    entry: 100,
    stop: 90,
    take: 120,
    lot: 1,
    closePrice: 110,
    commission: 0,
    swap: 0,
    tagIds: [],
    sessionId: null,
    screenshots: [],
    ...overrides,
  };
}

describe("computeDisciplineStreak", () => {
  it("counts consecutive trading days, most recent first, where every trade followed the plan", () => {
    const trades = [
      makeTrade({ date: "2026-01-07", followedPlan: true }),
      makeTrade({ date: "2026-01-06", followedPlan: true }),
      makeTrade({ date: "2026-01-05", followedPlan: false }),
    ];
    expect(computeDisciplineStreak(trades)).toBe(2);
  });

  it("skips days with no trades instead of breaking the streak on them", () => {
    const trades = [
      makeTrade({ date: "2026-01-07", followedPlan: true }),
      // 01-06 has no trades — not a break
      makeTrade({ date: "2026-01-05", followedPlan: true }),
    ];
    expect(computeDisciplineStreak(trades)).toBe(2);
  });

  it("stops the streak at an unanswered (undefined) followedPlan, not just an explicit false", () => {
    const trades = [
      makeTrade({ date: "2026-01-07", followedPlan: true }),
      makeTrade({ date: "2026-01-06", followedPlan: undefined }),
    ];
    expect(computeDisciplineStreak(trades)).toBe(1);
  });

  it("returns 0 when there are no trades at all", () => {
    expect(computeDisciplineStreak([])).toBe(0);
  });
});

describe("computeSessionHeatmap", () => {
  it("averages net P&L per session+weekday and orders Азія before Лондон", () => {
    const trades = [
      makeTrade({ date: "2026-01-05", sessionId: "sess-london", entry: 100, closePrice: 110 }), // Monday, +10
      makeTrade({ date: "2026-01-05", sessionId: "sess-london", entry: 100, closePrice: 90 }), // Monday, -10
    ];
    const heatmap = computeSessionHeatmap(trades, instrumentById, sessions);
    expect(heatmap.map((r) => r.sessionId)).toEqual(["sess-asia", "sess-london"]);
    const londonMonday = heatmap.find((r) => r.sessionId === "sess-london")!.cells[0];
    expect(londonMonday.count).toBe(2);
    expect(londonMonday.avgPnl).toBe(0);
  });

  it("ignores trades with no session assigned", () => {
    const trades = [makeTrade({ sessionId: null })];
    const heatmap = computeSessionHeatmap(trades, instrumentById, sessions);
    expect(heatmap.every((r) => r.cells.every((c) => c.count === 0))).toBe(true);
  });
});

describe("computeRMultipleBuckets", () => {
  it("rounds and clamps R-multiples into the -2R..+3R buckets", () => {
    const trades = [
      makeTrade({ entry: 100, stop: 90, closePrice: 400 }), // huge win, clamps to +3R
      makeTrade({ entry: 100, stop: 90, closePrice: 95 }), // -0.5R rounds to 0R
    ];
    const buckets = computeRMultipleBuckets(trades, instrumentById);
    const plus3 = buckets.find((b) => b.label === "+3R")!;
    expect(plus3.count).toBe(1);
    expect(buckets.map((b) => b.label)).toEqual(["-2R", "-1R", "0R", "+1R", "+2R", "+3R"]);
  });

  it("only counts closed trades with a computable R-multiple", () => {
    const trades = [makeTrade({ status: "open", closePrice: null })];
    const buckets = computeRMultipleBuckets(trades, instrumentById);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });
});

describe("hasConsecutiveLosses", () => {
  it("is true when the last N closed trades (by date+time) all lost money", () => {
    const trades = [
      makeTrade({ date: "2026-01-05", time: "09:00", entry: 100, closePrice: 90 }),
      makeTrade({ date: "2026-01-06", time: "09:00", entry: 100, closePrice: 90 }),
    ];
    expect(hasConsecutiveLosses(trades, instrumentById, 2)).toBe(true);
  });

  it("is false when a win breaks up the losing streak", () => {
    const trades = [
      makeTrade({ date: "2026-01-05", time: "09:00", entry: 100, closePrice: 90 }),
      makeTrade({ date: "2026-01-06", time: "09:00", entry: 100, closePrice: 110 }),
    ];
    expect(hasConsecutiveLosses(trades, instrumentById, 2)).toBe(false);
  });

  it("is false when there aren't yet N closed trades", () => {
    expect(hasConsecutiveLosses([makeTrade({ entry: 100, closePrice: 90 })], instrumentById, 2)).toBe(false);
  });
});

describe("findStrongestSession", () => {
  it("returns null when there are no closed, session-tagged trades", () => {
    expect(findStrongestSession([], instrumentById, sessions)).toBeNull();
  });

  it("picks the session+weekday cell with the highest average P&L", () => {
    const trades = [
      makeTrade({ date: "2026-01-05", sessionId: "sess-london", entry: 100, closePrice: 110 }), // +10
      makeTrade({ date: "2026-01-06", sessionId: "sess-asia", entry: 100, closePrice: 150 }), // +50
    ];
    const best = findStrongestSession(trades, instrumentById, sessions);
    expect(best?.sessionName).toBe("Азія");
    expect(best?.avgPnl).toBe(50);
  });
});

describe("computePlanCorrelation", () => {
  it("compares win rate between followed-plan and broke-plan trades", () => {
    const trades = [
      makeTrade({ followedPlan: true, entry: 100, closePrice: 110 }),
      makeTrade({ followedPlan: true, entry: 100, closePrice: 110 }),
      makeTrade({ followedPlan: false, entry: 100, closePrice: 90 }),
    ];
    const c = computePlanCorrelation(trades, instrumentById);
    expect(c?.aWinRate).toBe(100);
    expect(c?.bWinRate).toBe(0);
  });

  it("returns null when one side has no trades", () => {
    const trades = [makeTrade({ followedPlan: true, entry: 100, closePrice: 110 })];
    expect(computePlanCorrelation(trades, instrumentById)).toBeNull();
  });
});

describe("computeLateHourCorrelation", () => {
  it("splits by entry hour against the threshold", () => {
    const trades = [
      makeTrade({ time: "23:00", entry: 100, closePrice: 90 }),
      makeTrade({ time: "10:00", entry: 100, closePrice: 110 }),
    ];
    const c = computeLateHourCorrelation(trades, instrumentById, 22);
    expect(c?.aWinRate).toBe(0); // late
    expect(c?.bWinRate).toBe(100); // rest of day
  });
});

describe("computePostLossPauseCorrelation", () => {
  it("buckets trades right after a loss by how long the trader waited", () => {
    const trades = [
      makeTrade({ date: "2026-01-05", time: "09:00", entry: 100, closePrice: 90 }), // loss (never bucketed itself — i=0)
      makeTrade({ date: "2026-01-05", time: "09:10", entry: 100, closePrice: 90 }), // 10 min after a loss: short pause, itself a loss
      makeTrade({ date: "2026-01-06", time: "09:00", entry: 100, closePrice: 110 }), // ~23h50m after a loss: long pause, itself a win
    ];
    const c = computePostLossPauseCorrelation(trades, instrumentById, 30);
    expect(c?.aWinRate).toBe(0); // short pause
    expect(c?.bWinRate).toBe(100); // long pause
  });

  it("returns null without losses followed by another trade on both sides", () => {
    expect(computePostLossPauseCorrelation([makeTrade({ entry: 100, closePrice: 110 })], instrumentById)).toBeNull();
  });
});

describe("computeHourlyPerformanceCurve", () => {
  it("spans only the hours actually traded, bucketed by entry hour", () => {
    const trades = [
      makeTrade({ time: "09:00", entry: 100, closePrice: 110 }),
      makeTrade({ time: "11:00", entry: 100, closePrice: 90 }),
    ];
    const curve = computeHourlyPerformanceCurve(trades, instrumentById);
    expect(curve.map((c) => c.hour)).toEqual([9, 10, 11]);
    expect(curve.find((c) => c.hour === 10)?.winRate).toBeNull();
    expect(curve.find((c) => c.hour === 9)?.winRate).toBe(100);
  });

  it("returns an empty array with no closed trades", () => {
    expect(computeHourlyPerformanceCurve([], instrumentById)).toEqual([]);
  });
});

describe("computeTagCombinations", () => {
  const tags: JournalTag[] = [
    { id: "t1", name: "OB", isCustom: false },
    { id: "t2", name: "CHoCH", isCustom: false },
  ];
  const tagById = new Map(tags.map((t) => [t.id, t]));

  it("only surfaces pairs meeting the minimum occurrence count", () => {
    const trades = [
      makeTrade({ tagIds: ["t1", "t2"], entry: 100, closePrice: 110 }),
      makeTrade({ tagIds: ["t1", "t2"], entry: 100, closePrice: 110 }),
      makeTrade({ tagIds: ["t1"], entry: 100, closePrice: 90 }),
    ];
    const combos = computeTagCombinations(trades, instrumentById, tagById, 2);
    expect(combos).toHaveLength(1);
    expect(combos[0].tagNames).toEqual(["OB", "CHoCH"]);
    expect(combos[0].winRate).toBe(100);
  });

  it("excludes pairs below the minimum occurrence count", () => {
    const trades = [makeTrade({ tagIds: ["t1", "t2"], entry: 100, closePrice: 110 })];
    expect(computeTagCombinations(trades, instrumentById, tagById, 2)).toHaveLength(0);
  });
});

describe("detectRevengeTrading", () => {
  it("flags a trade that follows a loss with an outsized lot", () => {
    const trades = [
      makeTrade({ date: "2026-01-05", time: "09:00", lot: 1, entry: 100, closePrice: 90 }), // loss
      makeTrade({ date: "2026-01-05", time: "09:10", lot: 3, entry: 100, closePrice: 110 }), // 3x avg, right after loss
    ];
    const r = detectRevengeTrading(trades, instrumentById, 1.4);
    expect(r.count).toBe(1);
  });

  it("does not flag an outsized lot that doesn't follow a loss", () => {
    const trades = [
      makeTrade({ date: "2026-01-05", time: "09:00", lot: 1, entry: 100, closePrice: 110 }), // win
      makeTrade({ date: "2026-01-05", time: "09:10", lot: 3, entry: 100, closePrice: 110 }),
    ];
    expect(detectRevengeTrading(trades, instrumentById, 1.4).count).toBe(0);
  });
});

describe("computeResultStreakStrip", () => {
  it("labels each trade W/L/B oldest to newest and tracks the current run", () => {
    const trades = [
      makeTrade({ date: "2026-01-05", time: "09:00", entry: 100, closePrice: 110 }), // W
      makeTrade({ date: "2026-01-06", time: "09:00", entry: 100, closePrice: 90 }), // L
      makeTrade({ date: "2026-01-07", time: "09:00", entry: 100, closePrice: 90 }), // L
    ];
    const s = computeResultStreakStrip(trades, instrumentById);
    expect(s.results).toEqual(["W", "L", "L"]);
    expect(s.current).toEqual({ type: "L", count: 2 });
  });

  it("treats an exact-zero net as breakeven, not a win or loss", () => {
    const trades = [makeTrade({ entry: 100, closePrice: 100 })];
    const s = computeResultStreakStrip(trades, instrumentById);
    expect(s.results).toEqual(["B"]);
    expect(s.breakeven).toBe(1);
  });
});

describe("computeRiskStability", () => {
  it("flags lots at or above the outlier multiplier of the average", () => {
    const trades = [
      makeTrade({ lot: 1, entry: 100, closePrice: 110 }),
      makeTrade({ lot: 1, entry: 100, closePrice: 110 }),
      makeTrade({ lot: 3, entry: 100, closePrice: 90 }),
    ];
    const r = computeRiskStability(trades, instrumentById, 20, 1.8);
    expect(r.outlierCount).toBe(1);
    expect(r.points[2].isOutlier).toBe(true);
  });
});

describe("computeMonthVsLastMonth", () => {
  it("splits net P&L and win rate by calendar month", () => {
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-10`;
    const trades = [makeTrade({ date: thisMonthKey, entry: 100, closePrice: 110 })];
    const r = computeMonthVsLastMonth(trades, instrumentById);
    expect(r.current.net).toBe(10);
    expect(r.previous.net).toBe(0);
  });
});

describe("computeExtremePoints", () => {
  it("picks the single best and worst closed trade", () => {
    const trades = [
      makeTrade({ date: "2026-01-05", entry: 100, closePrice: 130 }), // +30
      makeTrade({ date: "2026-01-06", entry: 100, closePrice: 70 }), // -30
      makeTrade({ date: "2026-01-07", entry: 100, closePrice: 105 }), // +5
    ];
    const { best, worst } = computeExtremePoints(trades, instrumentById);
    expect(best?.net).toBe(30);
    expect(worst?.net).toBe(-30);
  });

  it("returns nulls with no closed trades", () => {
    expect(computeExtremePoints([], instrumentById)).toEqual({ best: null, worst: null });
  });
});

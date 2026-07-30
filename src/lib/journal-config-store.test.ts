import { describe, expect, it } from "vitest";
import { findAmbiguousInstrumentPairs, type JournalInstrument } from "./journal-config-store";
import type { Trade } from "./journal-store";

function makeInstrument(overrides: Partial<JournalInstrument>): JournalInstrument {
  return { id: "i1", symbol: "BTC/USD", assetType: "crypto", isCustom: true, contractMultiplier: 1, ...overrides };
}

function makeTrade(overrides: Partial<Trade>): Trade {
  return {
    id: "t1",
    accountId: null,
    instrumentId: "i1",
    direction: "LONG",
    status: "closed",
    date: "2026-01-01",
    time: "10:00",
    entry: 100,
    stop: 0,
    take: 0,
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

describe("findAmbiguousInstrumentPairs", () => {
  it("finds nothing when no instrument's symbol prefixes another's", () => {
    const instruments = [makeInstrument({ id: "btc", symbol: "BTC/USD" }), makeInstrument({ id: "sol", symbol: "SOL/USD" })];
    expect(findAmbiguousInstrumentPairs(instruments, [])).toEqual([]);
  });

  it("flags a pair where one crypto instrument's symbol is a prefix of another's, with the longer's trade count", () => {
    const eth = makeInstrument({ id: "eth", symbol: "ETH/USD" });
    const ethw = makeInstrument({ id: "ethw", symbol: "ETHW/USD" });
    const trades = [
      makeTrade({ id: "t1", instrumentId: "ethw" }),
      makeTrade({ id: "t2", instrumentId: "ethw" }),
      makeTrade({ id: "t3", instrumentId: "eth" }),
    ];
    const pairs = findAmbiguousInstrumentPairs([eth, ethw], trades);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].shorter.id).toBe("eth");
    expect(pairs[0].longer.id).toBe("ethw");
    expect(pairs[0].longerTradeCount).toBe(2);
  });

  it("ignores non-crypto instruments entirely", () => {
    const eth = makeInstrument({ id: "eth", symbol: "EUR/USD", assetType: "forex" });
    const ethw = makeInstrument({ id: "ethw", symbol: "EURW/USD", assetType: "forex" });
    expect(findAmbiguousInstrumentPairs([eth, ethw], [])).toEqual([]);
  });

  it("is idempotent — calling it twice with the same input gives the same result", () => {
    const eth = makeInstrument({ id: "eth", symbol: "ETH/USD" });
    const ethw = makeInstrument({ id: "ethw", symbol: "ETHW/USD" });
    const first = findAmbiguousInstrumentPairs([eth, ethw], []);
    const second = findAmbiguousInstrumentPairs([eth, ethw], []);
    expect(second).toEqual(first);
  });

  it("does not flag two instruments of equal normalized symbol length", () => {
    const a = makeInstrument({ id: "a", symbol: "BTC/USD" });
    const b = makeInstrument({ id: "b", symbol: "ETH/USD" });
    expect(findAmbiguousInstrumentPairs([a, b], [])).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { computeTradePnL } from "./trade-calculations";
import type { Trade } from "./journal-store";
import type { JournalInstrument } from "./journal-config-store";

const instrument: JournalInstrument = {
  id: "i1",
  symbol: "BTC/USD",
  assetType: "custom",
  isCustom: true,
  contractMultiplier: 1,
};

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

describe("computeTradePnL", () => {
  it("uses the local gross/commission/swap formula when externalPnl is absent (manual/MT5 trades)", () => {
    const t = makeTrade({ entry: 100, closePrice: 110, lot: 1, commission: 2, swap: -1 });
    const { net, gross } = computeTradePnL(t, instrument);
    expect(gross).toBe(10);
    expect(net).toBe(10 - 2 - 1);
  });

  it("trusts externalPnl over the local formula when present (broker-reported net, e.g. Bybit)", () => {
    // Local formula would give gross(10) - commission(2) + swap(0) = 8, but
    // Bybit's own closedPnl (funding-adjusted) says otherwise — that must win.
    const t = makeTrade({ entry: 100, closePrice: 110, lot: 1, commission: 2, externalPnl: 6.5 });
    const { net } = computeTradePnL(t, instrument);
    expect(net).toBe(6.5);
  });

  it("still computes gross/rrActual normally even when externalPnl overrides net", () => {
    const t = makeTrade({ entry: 100, closePrice: 110, lot: 1, externalPnl: 999 });
    const { gross, rrActual } = computeTradePnL(t, instrument);
    expect(gross).toBe(10);
    expect(rrActual).not.toBeNull();
  });

  it("returns nulls for an open trade regardless of externalPnl", () => {
    const t = makeTrade({ status: "open", closePrice: null, externalPnl: 42 });
    const { net, gross } = computeTradePnL(t, instrument);
    expect(net).toBeNull();
    expect(gross).toBeNull();
  });
});

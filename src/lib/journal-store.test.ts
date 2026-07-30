import { describe, expect, it, beforeEach } from "vitest";
import { migrateBybitDirection, migrateTradeSource, useJournalStore, type Trade } from "./journal-store";

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

describe("migrateBybitDirection", () => {
  it("flips LONG to SHORT for a Bybit-imported trade", () => {
    const t = makeTrade({ direction: "LONG", externalId: "bybit:abc:123" });
    const [migrated] = migrateBybitDirection([t]);
    expect(migrated.direction).toBe("SHORT");
  });

  it("flips SHORT to LONG for a Bybit-imported trade", () => {
    const t = makeTrade({ direction: "SHORT", externalId: "bybit:abc:123" });
    const [migrated] = migrateBybitDirection([t]);
    expect(migrated.direction).toBe("LONG");
  });

  it("leaves an MT5-imported trade untouched", () => {
    const t = makeTrade({ direction: "LONG", externalId: "mt5:456" });
    const [migrated] = migrateBybitDirection([t]);
    expect(migrated.direction).toBe("LONG");
  });

  it("leaves a manual trade (no externalId) untouched", () => {
    const t = makeTrade({ direction: "SHORT", externalId: undefined });
    const [migrated] = migrateBybitDirection([t]);
    expect(migrated.direction).toBe("SHORT");
  });
});

describe("migrateTradeSource", () => {
  it("infers 'mt5' from an mt5: externalId", () => {
    const t = makeTrade({ externalId: "mt5:12345" });
    const [migrated] = migrateTradeSource([t]);
    expect(migrated.source).toBe("mt5");
  });

  it("infers 'bybit' from a bybit: externalId", () => {
    const t = makeTrade({ externalId: "bybit:abc:123" });
    const [migrated] = migrateTradeSource([t]);
    expect(migrated.source).toBe("bybit");
  });

  it("infers 'manual' when there's no externalId", () => {
    const t = makeTrade({ externalId: undefined });
    const [migrated] = migrateTradeSource([t]);
    expect(migrated.source).toBe("manual");
  });

  it("leaves an already-tagged trade's source untouched", () => {
    const t = makeTrade({ externalId: "bybit:abc:123", source: "manual" });
    const [migrated] = migrateTradeSource([t]);
    expect(migrated.source).toBe("manual");
  });
});

describe("addTrade", () => {
  beforeEach(() => {
    useJournalStore.setState({ trades: [] });
  });

  it("does not add a trade whose externalId already exists in the journal", () => {
    useJournalStore.getState().addTrade(makeTrade({ externalId: "bybit:abc:123" }));
    useJournalStore.getState().addTrade(makeTrade({ externalId: "bybit:abc:123" }));
    expect(useJournalStore.getState().trades).toHaveLength(1);
  });

  it("adds two manual trades with no externalId without treating them as duplicates", () => {
    useJournalStore.getState().addTrade(makeTrade({ externalId: undefined }));
    useJournalStore.getState().addTrade(makeTrade({ externalId: undefined }));
    expect(useJournalStore.getState().trades).toHaveLength(2);
  });
});

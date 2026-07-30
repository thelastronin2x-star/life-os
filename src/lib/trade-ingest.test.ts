import { describe, expect, it, beforeEach } from "vitest";
import { useJournalStore } from "./journal-store";
import { dedupKeyFor, ingestTrades, type IncomingTrade } from "./trade-ingest";

function makeIncoming(overrides: Partial<IncomingTrade>): IncomingTrade {
  return {
    source: "bybit",
    sourceId: "order-1",
    instrumentId: "inst-1",
    sourceSymbol: "BTCUSDT",
    direction: "LONG",
    date: "2026-01-01",
    time: "10:00",
    entry: 100,
    stop: 0,
    take: 0,
    lot: 1,
    closePrice: 110,
    commission: 0,
    swap: 0,
    ...overrides,
  };
}

describe("dedupKeyFor", () => {
  it("joins source and sourceId with a colon", () => {
    expect(dedupKeyFor("bybit", "abc:123")).toBe("bybit:abc:123");
    expect(dedupKeyFor("mt5", "42")).toBe("mt5:42");
  });
});

describe("ingestTrades", () => {
  beforeEach(() => {
    useJournalStore.setState({ trades: [] });
  });

  it("imports a new trade and tags it with its source", () => {
    const result = ingestTrades("acc-1", [makeIncoming({})]);
    expect(result).toEqual({ imported: 1, duplicates: 0 });
    const [trade] = useJournalStore.getState().trades;
    expect(trade.source).toBe("bybit");
    expect(trade.externalId).toBe("bybit:order-1");
    expect(trade.accountId).toBe("acc-1");
  });

  it("is idempotent — resubmitting the same (source, sourceId) does not duplicate", () => {
    ingestTrades("acc-1", [makeIncoming({})]);
    const second = ingestTrades("acc-1", [makeIncoming({})]);
    expect(second).toEqual({ imported: 0, duplicates: 1 });
    expect(useJournalStore.getState().trades).toHaveLength(1);
  });

  it("does not confuse trades from different sources with the same sourceId", () => {
    ingestTrades("acc-1", [makeIncoming({ source: "bybit", sourceId: "1" })]);
    const result = ingestTrades("acc-1", [makeIncoming({ source: "mt5", sourceId: "1" })]);
    expect(result).toEqual({ imported: 1, duplicates: 0 });
    expect(useJournalStore.getState().trades).toHaveLength(2);
  });

  it("passes externalPnl through when present, and leaves it unset when absent", () => {
    ingestTrades("acc-1", [makeIncoming({ sourceId: "with-pnl", externalPnl: 42 })]);
    ingestTrades("acc-1", [makeIncoming({ sourceId: "without-pnl" })]);
    const trades = useJournalStore.getState().trades;
    expect(trades.find((t) => t.externalId === "bybit:with-pnl")?.externalPnl).toBe(42);
    expect(trades.find((t) => t.externalId === "bybit:without-pnl")?.externalPnl).toBeUndefined();
  });

  it("imports multiple trades in one call and reports mixed new/duplicate correctly", () => {
    ingestTrades("acc-1", [makeIncoming({ sourceId: "1" })]);
    const result = ingestTrades("acc-1", [
      makeIncoming({ sourceId: "1" }), // duplicate
      makeIncoming({ sourceId: "2" }), // new
    ]);
    expect(result).toEqual({ imported: 1, duplicates: 1 });
    expect(useJournalStore.getState().trades).toHaveLength(2);
  });

  it("dedups within a single batch — two identical rows in one call produce one record", () => {
    const result = ingestTrades("acc-1", [makeIncoming({ sourceId: "dup" }), makeIncoming({ sourceId: "dup" })]);
    expect(result).toEqual({ imported: 1, duplicates: 1 });
    expect(useJournalStore.getState().trades).toHaveLength(1);
  });

  it("stores the original sourceSymbol on the trade", () => {
    ingestTrades("acc-1", [makeIncoming({ sourceSymbol: "ETHWUSDT" })]);
    expect(useJournalStore.getState().trades[0].sourceSymbol).toBe("ETHWUSDT");
  });
});

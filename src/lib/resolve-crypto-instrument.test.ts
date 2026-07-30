import { describe, expect, it, beforeEach } from "vitest";
import { useJournalConfigStore } from "./journal-config-store";
import { resolveCryptoInstrumentId } from "./resolve-crypto-instrument";

describe("resolveCryptoInstrumentId", () => {
  beforeEach(() => {
    useJournalConfigStore.setState({ instruments: [] });
  });

  it("creates a new instrument for a symbol not seen before", () => {
    const id = resolveCryptoInstrumentId("BTCUSDT");
    const instruments = useJournalConfigStore.getState().instruments;
    expect(instruments).toHaveLength(1);
    expect(instruments[0].id).toBe(id);
    expect(instruments[0].symbol).toBe("BTC/USD");
  });

  it("reuses the same instrument for the same symbol across calls", () => {
    const first = resolveCryptoInstrumentId("BTCUSDT");
    const second = resolveCryptoInstrumentId("BTCUSDT");
    expect(second).toBe(first);
    expect(useJournalConfigStore.getState().instruments).toHaveLength(1);
  });

  it("does not merge ETH into an existing ETHW instrument", () => {
    const ethwId = resolveCryptoInstrumentId("ETHWUSDT");
    const ethId = resolveCryptoInstrumentId("ETHUSDT");
    expect(ethId).not.toBe(ethwId);
    expect(useJournalConfigStore.getState().instruments).toHaveLength(2);
  });

  it("resolves two trades with the same NEW symbol in a row to one instrument, not two — no stale-closure duplicate", () => {
    const first = resolveCryptoInstrumentId("SOLUSDT");
    const second = resolveCryptoInstrumentId("SOLUSDT");
    expect(first).toBe(second);
    expect(useJournalConfigStore.getState().instruments.filter((i) => i.symbol === "SOL/USD")).toHaveLength(1);
  });
});

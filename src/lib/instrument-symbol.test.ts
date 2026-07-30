import { describe, expect, it } from "vitest";
import { normalizeSymbol, baseAssetDisplaySymbol } from "./instrument-symbol";

describe("normalizeSymbol", () => {
  it("does not match ETH against ETHW or ETHFI — different real markets", () => {
    expect(normalizeSymbol("ETHUSDT")).not.toBe(normalizeSymbol("ETHWUSDT"));
    expect(normalizeSymbol("ETHUSDT")).not.toBe(normalizeSymbol("ETHFIUSDT"));
  });

  it("does not match ETH against a suffixed variant like ETHUSDT-PERP", () => {
    expect(normalizeSymbol("ETHUSDT")).not.toBe(normalizeSymbol("ETHUSDT-PERP"));
  });

  it("treats BTCUSDT, BTCUSDC and BTCUSD as the same instrument", () => {
    const a = normalizeSymbol("BTCUSDT");
    expect(normalizeSymbol("BTCUSDC")).toBe(a);
    expect(normalizeSymbol("BTCUSD")).toBe(a);
  });

  it("is unaffected by case", () => {
    expect(normalizeSymbol("btcusdt")).toBe(normalizeSymbol("BTCUSDT"));
  });

  it("is unaffected by a slash separator", () => {
    expect(normalizeSymbol("BTC/USDT")).toBe(normalizeSymbol("BTCUSDT"));
    expect(normalizeSymbol("BTC/USD")).toBe(normalizeSymbol("BTCUSDT"));
  });

  it("matches an existing displayed instrument symbol against a raw broker symbol", () => {
    expect(normalizeSymbol("ETH/USD")).toBe(normalizeSymbol("ETHUSDT"));
  });
});

describe("baseAssetDisplaySymbol", () => {
  it("strips the quote suffix and appends /USD", () => {
    expect(baseAssetDisplaySymbol("BTCUSDT")).toBe("BTC/USD");
    expect(baseAssetDisplaySymbol("ethusdc")).toBe("ETH/USD");
  });
});

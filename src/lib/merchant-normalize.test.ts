import { describe, expect, it } from "vitest";
import { normalizeMerchantForGrouping } from "./merchant-normalize";

describe("normalizeMerchantForGrouping", () => {
  it("lowercases and trims", () => {
    expect(normalizeMerchantForGrouping("  Сільпо  ")).toBe("сільпо");
  });

  it("strips a № terminal marker regardless of digit count", () => {
    expect(normalizeMerchantForGrouping("АТБ №1234")).toBe("атб");
    expect(normalizeMerchantForGrouping("АТБ №7")).toBe("атб");
  });

  it("strips a # terminal marker", () => {
    expect(normalizeMerchantForGrouping("WOG #42")).toBe("wog");
  });

  it("strips a bare trailing run of 4+ digits", () => {
    expect(normalizeMerchantForGrouping("WOG 1234")).toBe("wog");
  });

  it("does not strip short numbers that are part of the brand", () => {
    expect(normalizeMerchantForGrouping("Аптека 911")).toBe("аптека 911");
    expect(normalizeMerchantForGrouping("7-eleven")).toBe("7-eleven");
  });

  it("leaves names with no trailing number unchanged", () => {
    expect(normalizeMerchantForGrouping("Netflix")).toBe("netflix");
  });

  it("groups two different terminal ids to the same key", () => {
    const a = normalizeMerchantForGrouping("АТБ №1234");
    const b = normalizeMerchantForGrouping("АТБ №5678");
    expect(a).toBe(b);
  });
});

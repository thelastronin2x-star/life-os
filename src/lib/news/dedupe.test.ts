import { describe, expect, it } from "vitest";
import { idFromUrl, dedupeByUrl } from "./dedupe";

describe("idFromUrl", () => {
  it("is stable for the same URL", () => {
    expect(idFromUrl("https://example.com/a")).toBe(idFromUrl("https://example.com/a"));
  });

  it("differs for different URLs", () => {
    expect(idFromUrl("https://example.com/a")).not.toBe(idFromUrl("https://example.com/b"));
  });
});

describe("dedupeByUrl", () => {
  it("keeps only one entry per URL", () => {
    const items = [
      { url: "https://a.com/1", markets: ["forex"] },
      { url: "https://a.com/1", markets: ["indices"] },
      { url: "https://a.com/2", markets: ["crypto"] },
    ];
    const result = dedupeByUrl(items);
    expect(result).toHaveLength(2);
  });

  it("unions markets across duplicate URLs instead of dropping either", () => {
    const items = [
      { url: "https://a.com/1", markets: ["forex"] },
      { url: "https://a.com/1", markets: ["indices"] },
    ];
    const result = dedupeByUrl(items);
    expect(result).toHaveLength(1);
    expect(result[0].markets.sort()).toEqual(["forex", "indices"]);
  });
});

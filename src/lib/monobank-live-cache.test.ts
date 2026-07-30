import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchLiveMonobankAccounts, fetchLiveMonobankAccountsWithError, __resetLiveMonobankAccountsCacheForTests } from "./monobank-sync";

// Regression coverage for the shared live-balance cache introduced to stop
// independent consumers (page-mount refresh, manual sync, periodic sync)
// from each burning their own request against Monobank's ~1-per-60s
// client-info limit — which is what originally starved the second call in
// any given cycle and left a link's balance stuck unreconciled.
describe("live Monobank accounts cache", () => {
  beforeEach(() => {
    __resetLiveMonobankAccountsCacheForTests();
  });

  it("shares one request across concurrent callers instead of firing one each", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        return { ok: true, json: async () => ({ accounts: [{ id: "mono1", balance: 1000 }] }) };
      })
    );

    const [a, b, c] = await Promise.all([
      fetchLiveMonobankAccounts(),
      fetchLiveMonobankAccounts(),
      fetchLiveMonobankAccounts(),
    ]);

    expect(callCount).toBe(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("reuses the cached result for a subsequent call within the TTL, without a new request", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        return { ok: true, json: async () => ({ accounts: [{ id: "mono1", balance: 2000 }] }) };
      })
    );

    await fetchLiveMonobankAccounts();
    const second = await fetchLiveMonobankAccounts();

    expect(callCount).toBe(1);
    expect(second[0].balance).toBe(2000);
  });

  it("does not cache a rate-limited/failed result — the next call tries again", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        if (callCount === 1) return { ok: false, json: async () => ({ error: "rate_limited" }) };
        return { ok: true, json: async () => ({ accounts: [{ id: "mono1", balance: 3000 }] }) };
      })
    );

    const first = await fetchLiveMonobankAccountsWithError();
    expect(first.error).toBe("rate_limited");
    expect(first.accounts).toEqual([]);

    const second = await fetchLiveMonobankAccountsWithError();
    expect(callCount).toBe(2);
    expect(second.error).toBeNull();
    expect(second.accounts[0].balance).toBe(3000);
  });

  it("distinguishes rate_limited from a generic failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    const result = await fetchLiveMonobankAccountsWithError();
    expect(result.error).toBe("failed");
  });
});

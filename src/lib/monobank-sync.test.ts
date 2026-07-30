import { describe, it, expect, beforeEach, vi } from "vitest";
import { useFinanceStore } from "./finance-store";
import { useMonobankLinkStore, type MonobankLink } from "./monobank-store";
import { syncMonobankAccount, __resetLiveMonobankAccountsCacheForTests } from "./monobank-sync";

function makeLink(overrides: Partial<MonobankLink> = {}): MonobankLink {
  return {
    monobankAccountId: "mono1",
    label: "•• 1234",
    localAccountId: "local1",
    lastSyncedAt: null,
    earliestSyncedAt: null,
    historyExhausted: false,
    metadataBackfilled: false,
    reconciledAt: null,
    ...overrides,
  };
}

// Regression test for the bug: a new local account (startingBalance 0)
// imports a statement window with a negative net sum (money was already on
// the card before the window; this window's spend just exceeds this
// window's income) while Monobank's client-info happens to be rate-limited
// right after the page's own mount-time fetch — the exact collision that
// left a second linked card stuck at a negative balance forever, because
// the manual-sync fallback that masked this for the FIRST card didn't exist
// on the background periodic-sync path.
describe("syncMonobankAccount — new account negative balance bug", () => {
  beforeEach(() => {
    __resetLiveMonobankAccountsCacheForTests();
    useFinanceStore.setState({
      accounts: [{ id: "local1", name: "Card", type: "personal", currencySymbol: "₴", startingBalance: 0 }],
      transactions: [],
      goals: [],
      budgetCategories: [],
    });
    useMonobankLinkStore.setState({ links: [makeLink()] });
  });

  it("marks the link as still unreconciled instead of advancing lastSyncedAt when client-info fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/transactions")) {
          return {
            ok: true,
            json: async () => ({
              transactions: [
                { id: "t1", time: Math.floor(Date.now() / 1000), description: "Groceries", mcc: 5411, hold: false, amount: -50000, balance: 10000 },
              ],
            }),
          };
        }
        // client-info rate-limited right after the page's own mount fetch
        return { ok: false, json: async () => ({ error: "rate_limited" }) };
      })
    );

    const link = useMonobankLinkStore.getState().links[0];
    const result = await syncMonobankAccount(link);

    expect(result.reconciled).toBe(false);
    const linkAfter = useMonobankLinkStore.getState().links[0];
    expect(linkAfter.reconciledAt).toBeNull();
    // Must NOT advance — a link that has never reconciled has to keep
    // retrying on every future sync, or it's stuck forever (the actual bug).
    expect(linkAfter.lastSyncedAt).toBeNull();
  });

  it("self-corrects on the next call once client-info succeeds, with no manual intervention", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/transactions")) {
          return {
            ok: true,
            json: async () => ({
              transactions: [
                { id: "t1", time: Math.floor(Date.now() / 1000), description: "Groceries", mcc: 5411, hold: false, amount: -50000, balance: 10000 },
              ],
            }),
          };
        }
        return { ok: false, json: async () => ({ error: "rate_limited" }) };
      })
    );
    const firstLink = useMonobankLinkStore.getState().links[0];
    await syncMonobankAccount(firstLink);

    // Displayed balance is transiently negative — expected, not yet fixed.
    const afterFirst = useFinanceStore.getState();
    const displayedAfterFirst = afterFirst.accounts[0].startingBalance + afterFirst.transactions[0].amount * -1;
    expect(displayedAfterFirst).toBeLessThan(0);

    // Second sync cycle: client-info now available, no new transactions.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/transactions")) return { ok: true, json: async () => ({ transactions: [] }) };
        if (url.includes("/accounts")) return { ok: true, json: async () => ({ accounts: [{ id: "mono1", balance: 25000 }] }) };
        throw new Error(`unexpected url ${url}`);
      })
    );
    const staleLink = useMonobankLinkStore.getState().links[0]; // still unreconciled going in
    const result2 = await syncMonobankAccount(staleLink);

    expect(result2.reconciled).toBe(true);
    const linkAfter = useMonobankLinkStore.getState().links[0];
    expect(linkAfter.reconciledAt).not.toBeNull();
    expect(linkAfter.lastSyncedAt).not.toBeNull();

    // Balance is no longer negative — it matches Monobank's live balance
    // (250.00) exactly, regardless of what startingBalance began at.
    const account = useFinanceStore.getState().accounts[0];
    const transactions = useFinanceStore.getState().transactions;
    const displayedBalance = account.startingBalance + transactions.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
    expect(displayedBalance).toBeCloseTo(250, 5);
  });

  it("advances lastSyncedAt normally once a link has reconciled at least once", async () => {
    useMonobankLinkStore.setState({ links: [makeLink({ reconciledAt: "2026-01-01T00:00:00.000Z" })] });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/transactions")) return { ok: true, json: async () => ({ transactions: [] }) };
        // client-info fails this cycle — but the link has reconciled before,
        // so a single missed cycle is just staleness, not a structural bug.
        return { ok: false, json: async () => ({ error: "rate_limited" }) };
      })
    );

    const link = useMonobankLinkStore.getState().links[0];
    const result = await syncMonobankAccount(link);

    expect(result.reconciled).toBe(false);
    const linkAfter = useMonobankLinkStore.getState().links[0];
    expect(linkAfter.lastSyncedAt).not.toBeNull();
  });
});

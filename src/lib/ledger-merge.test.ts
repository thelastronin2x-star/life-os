import { describe, expect, it } from "vitest";
import { toLocalTransaction, type LedgerEntryDto } from "./ledger-merge";

function entry(overrides: Partial<LedgerEntryDto>): LedgerEntryDto {
  return {
    externalId: "monobank:txn-1",
    localAccountId: "local-acc-1",
    timeSeconds: 1700000000,
    description: "АТБ",
    mcc: 5411,
    amountMinorUnits: -15050,
    isPending: false,
    ...overrides,
  };
}

describe("toLocalTransaction", () => {
  it("maps a negative amount to an expense with a positive display amount", () => {
    const t = toLocalTransaction(entry({ amountMinorUnits: -15050 }));
    expect(t?.type).toBe("expense");
    expect(t?.amount).toBe(150.5);
  });

  it("maps a positive amount to income", () => {
    const t = toLocalTransaction(entry({ amountMinorUnits: 50000 }));
    expect(t?.type).toBe("income");
    expect(t?.amount).toBe(500);
  });

  it("never assigns a category to income", () => {
    const t = toLocalTransaction(entry({ amountMinorUnits: 50000, mcc: 5411 }));
    expect(t?.categoryId).toBeNull();
  });

  it("returns null when there's no resolved local account", () => {
    expect(toLocalTransaction(entry({ localAccountId: null }))).toBeNull();
  });

  it("returns null for a pending (hold) entry", () => {
    expect(toLocalTransaction(entry({ isPending: true }))).toBeNull();
  });

  it("carries the externalId through unchanged for dedup", () => {
    const t = toLocalTransaction(entry({ externalId: "manual-local:abc-123" }));
    expect(t?.externalId).toBe("manual-local:abc-123");
  });

  it("falls back to the current time when timeSeconds is null, rather than crashing", () => {
    const t = toLocalTransaction(entry({ timeSeconds: null }));
    expect(t?.time).toBeUndefined();
    expect(t?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

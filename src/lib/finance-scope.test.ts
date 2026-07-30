import { describe, expect, it } from "vitest";
import { computeFinanceScope } from "./finance-scope";
import type { BudgetCategory, FinanceAccount, Transaction } from "./finance-store";

const uahAccount: FinanceAccount = {
  id: "uah",
  name: "Картка UAH",
  type: "personal",
  currencySymbol: "₴",
  startingBalance: 1000,
};

const usdAccount: FinanceAccount = {
  id: "usd",
  name: "Картка USD",
  type: "personal",
  currencySymbol: "$",
  startingBalance: 100,
};

const accounts = [uahAccount, usdAccount];
const rates = { UAH: 1, USD: 40, EUR: 43 };

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    type: "expense",
    amount: 100,
    categoryId: null,
    accountId: "uah",
    date: "2026-01-01",
    title: "Test",
    ...overrides,
  };
}

describe("computeFinanceScope — all accounts", () => {
  it("converts a foreign-currency transaction into the app currency", () => {
    const t = txn({ accountId: "usd", amount: 10 });
    const scope = computeFinanceScope(null, accounts, [], "UAH", "₴", rates);
    expect(scope.convert(t)).toBe(400); // 10 USD * 40
  });

  it("returns null (excludes) a foreign-currency transaction when rates aren't loaded", () => {
    const t = txn({ accountId: "usd", amount: 10 });
    const scope = computeFinanceScope(null, accounts, [], "UAH", "₴", null);
    expect(scope.convert(t)).toBeNull();
  });

  it("includes every transaction regardless of account", () => {
    const scope = computeFinanceScope(null, accounts, [], "UAH", "₴", rates);
    expect(scope.includesTxn(txn({ accountId: "uah" }))).toBe(true);
    expect(scope.includesTxn(txn({ accountId: "usd" }))).toBe(true);
  });

  it("sums balances across accounts in the app currency", () => {
    const scope = computeFinanceScope(null, accounts, [], "UAH", "₴", rates);
    // 1000 UAH + (100 USD * 40) = 5000
    expect(scope.balance).toBe(5000);
  });
});

describe("computeFinanceScope — single account", () => {
  it("returns the raw amount when the account is already in the display currency", () => {
    const scope = computeFinanceScope(uahAccount, accounts, [], "UAH", "₴", rates);
    expect(scope.convert(txn({ amount: 250 }))).toBe(250);
  });

  it("converts the amount when the account's currency differs from the display currency", () => {
    const scope = computeFinanceScope(usdAccount, accounts, [], "UAH", "₴", rates);
    expect(scope.convert(txn({ accountId: "usd", amount: 10 }))).toBe(400); // 10 USD * 40
  });

  it("excludes the amount when a needed conversion isn't possible yet", () => {
    const scope = computeFinanceScope(usdAccount, accounts, [], "UAH", "₴", null);
    expect(scope.convert(txn({ accountId: "usd", amount: 10 }))).toBeNull();
  });

  it("includes the account's own transactions", () => {
    const scope = computeFinanceScope(uahAccount, accounts, [], "UAH", "₴", rates);
    expect(scope.includesTxn(txn({ accountId: "uah" }))).toBe(true);
    expect(scope.includesTxn(txn({ accountId: "usd" }))).toBe(false);
  });

  it("includes an incoming transfer from another account", () => {
    const scope = computeFinanceScope(uahAccount, accounts, [], "UAH", "₴", rates);
    const incoming = txn({ type: "transfer", accountId: "usd", transferAccountId: "uah", amount: 50 });
    expect(scope.includesTxn(incoming)).toBe(true);
  });

  it("excludes an unrelated transfer between other accounts", () => {
    const scope = computeFinanceScope(uahAccount, accounts, [], "UAH", "₴", rates);
    const other: FinanceAccount = { ...usdAccount, id: "other" };
    const unrelated = txn({ type: "transfer", accountId: "usd", transferAccountId: other.id, amount: 50 });
    expect(scope.includesTxn(unrelated)).toBe(false);
  });

  it("always uses the display currency's symbol, not the account's own", () => {
    const scope = computeFinanceScope(usdAccount, accounts, [], "UAH", "₴", rates);
    expect(scope.symbol).toBe("₴");
  });

  it("reports the account's own balance unconverted when already in the display currency", () => {
    const scope = computeFinanceScope(uahAccount, accounts, [txn({ type: "income", amount: 500 })], "UAH", "₴", rates);
    expect(scope.balance).toBe(1500); // 1000 starting + 500 income
  });

  it("converts the account's balance into the display currency when they differ", () => {
    const scope = computeFinanceScope(usdAccount, accounts, [], "UAH", "₴", rates);
    expect(scope.balance).toBe(4000); // 100 USD starting * 40
  });
});

describe("computeFinanceScope — cross-currency transfer", () => {
  // 10 USD moves from usdAccount to uahAccount — a single record, amount
  // denominated in the SOURCE account's currency (t.accountId = "usd").
  const transfer = txn({ type: "transfer", accountId: "usd", transferAccountId: "uah", amount: 10 });

  it("converts from the transaction's own (source) account, not the currently-viewed one", () => {
    // Viewed from the destination account (uah) — the amount must still be
    // read as 10 USD, not misread as 10 already-UAH.
    const scope = computeFinanceScope(uahAccount, accounts, [], "UAH", "₴", rates);
    expect(scope.convert(transfer)).toBe(400); // 10 USD * 40
  });

  it("leaves the source side's own conversion unaffected", () => {
    const scope = computeFinanceScope(usdAccount, accounts, [], "USD", "$", rates);
    expect(scope.convert(transfer)).toBe(10); // already in USD, the account it left from
  });
});

function cat(limitsByAccount: Record<string, number>): BudgetCategory {
  return { id: "food", name: "Їжа", icon: "food", color: "sage", limitsByAccount };
}

describe("computeFinanceScope — categoryLimit", () => {
  it("returns the account's own limit for a single-account scope", () => {
    const scope = computeFinanceScope(uahAccount, accounts, [], "UAH", "₴", rates);
    expect(scope.categoryLimit(cat({ uah: 300, usd: 50 }))).toBe(300);
  });

  it("returns 0 (not the raw missing value) when this account has no limit set", () => {
    const scope = computeFinanceScope(uahAccount, accounts, [], "UAH", "₴", rates);
    expect(scope.categoryLimit(cat({ usd: 50 }))).toBe(0);
  });

  it("converts a single account's own limit into the display currency when they differ", () => {
    const scope = computeFinanceScope(usdAccount, accounts, [], "UAH", "₴", rates);
    expect(scope.categoryLimit(cat({ usd: 50 }))).toBe(2000); // 50 USD * 40
  });

  it("sums every account's limit, converted, for the all-accounts scope", () => {
    const scope = computeFinanceScope(null, accounts, [], "UAH", "₴", rates);
    // 300 UAH + (50 USD * 40) = 2300
    expect(scope.categoryLimit(cat({ uah: 300, usd: 50 }))).toBe(2300);
  });

  it("excludes an unconvertible foreign limit rather than mixing it in raw", () => {
    const scope = computeFinanceScope(null, accounts, [], "UAH", "₴", null);
    expect(scope.categoryLimit(cat({ uah: 300, usd: 50 }))).toBe(300);
  });

  it("treats a category with no limits at all as 0 in every scope", () => {
    const allScope = computeFinanceScope(null, accounts, [], "UAH", "₴", rates);
    const singleScope = computeFinanceScope(uahAccount, accounts, [], "UAH", "₴", rates);
    expect(allScope.categoryLimit(cat({}))).toBe(0);
    expect(singleScope.categoryLimit(cat({}))).toBe(0);
  });
});

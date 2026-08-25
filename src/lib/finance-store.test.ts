import { describe, expect, it } from "vitest";
import { migrateBudgetCategoryLimits, migrateBudgetCategoryIconIds } from "./finance-store";
import type { Transaction, BudgetCategory } from "./finance-store";

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    type: "expense",
    amount: 100,
    categoryId: "food",
    accountId: "uah",
    date: "2026-01-01",
    title: "Test",
    ...overrides,
  };
}

describe("migrateBudgetCategoryLimits", () => {
  it("assigns the old limit to the account with the most historical spend in that category", () => {
    const categories = [{ id: "food", name: "Їжа", icon: "food", color: "sage" as const, limit: 500 }];
    const transactions = [
      txn({ accountId: "uah", amount: 300 }),
      txn({ accountId: "uah", amount: 100 }),
      txn({ accountId: "usd", amount: 50 }),
    ];
    const migrated = migrateBudgetCategoryLimits(categories, transactions);
    expect(migrated[0].limitsByAccount).toEqual({ uah: 500 });
  });

  it("leaves a category with no limit (or a zero limit) with an empty map", () => {
    const categories = [{ id: "food", name: "Їжа", icon: "food", color: "sage" as const, limit: 0 }];
    const migrated = migrateBudgetCategoryLimits(categories, []);
    expect(migrated[0].limitsByAccount).toEqual({});
  });

  it("leaves a category with a positive limit but no matching transactions with an empty map", () => {
    const categories = [{ id: "food", name: "Їжа", icon: "food", color: "sage" as const, limit: 500 }];
    const migrated = migrateBudgetCategoryLimits(categories, []);
    expect(migrated[0].limitsByAccount).toEqual({});
  });

  it("only counts expense transactions in the same category toward 'most historical spend'", () => {
    const categories = [{ id: "food", name: "Їжа", icon: "food", color: "sage" as const, limit: 500 }];
    const transactions = [
      txn({ accountId: "uah", amount: 10 }),
      txn({ accountId: "usd", amount: 9999, type: "income" }), // wrong type, ignored
      txn({ accountId: "usd", amount: 9999, categoryId: "other" }), // wrong category, ignored
    ];
    const migrated = migrateBudgetCategoryLimits(categories, transactions);
    expect(migrated[0].limitsByAccount).toEqual({ uah: 500 });
  });

  it("is idempotent — running it twice on an already-migrated category is a no-op", () => {
    const categories = [{ id: "food", name: "Їжа", icon: "food", color: "sage" as const, limit: 500 }];
    const transactions = [txn({ accountId: "uah", amount: 300 })];
    const once = migrateBudgetCategoryLimits(categories, transactions);
    const twice = migrateBudgetCategoryLimits(once, transactions);
    expect(twice[0].limitsByAccount).toEqual({ uah: 500 });
  });

  it("does not lose an already-migrated limitsByAccount even if a stray old `limit` field is still present", () => {
    const categories = [
      { id: "food", name: "Їжа", icon: "food", color: "sage" as const, limit: 999, limitsByAccount: { usd: 42 } },
    ];
    const migrated = migrateBudgetCategoryLimits(categories, []);
    expect(migrated[0].limitsByAccount).toEqual({ usd: 42 });
  });
});

function cat(overrides: Partial<BudgetCategory>): BudgetCategory {
  return { id: "c1", name: "Стара назва", icon: "utensils", color: "sage", limitsByAccount: {}, ...overrides };
}

describe("migrateBudgetCategoryIconIds", () => {
  it("maps every legacy 9-icon-id category onto its closest fixed category key, re-deriving the name", () => {
    const migrated = migrateBudgetCategoryIconIds([cat({ icon: "utensils" })]);
    expect(migrated[0].icon).toBe("restaurant");
    expect(migrated[0].name).toBe("Ресторан");
  });

  it("maps the legacy transfer icon onto the transfers category", () => {
    const migrated = migrateBudgetCategoryIconIds([cat({ icon: "transfer" })]);
    expect(migrated[0].icon).toBe("transfers");
  });

  it("falls back to home for an unrecognized legacy icon id", () => {
    const migrated = migrateBudgetCategoryIconIds([cat({ icon: "some-unknown-icon" })]);
    expect(migrated[0].icon).toBe("home");
    expect(migrated[0].name).toBe("Дім");
  });

  it("is idempotent — a category already on a valid fixed key passes through unchanged", () => {
    const migrated = migrateBudgetCategoryIconIds([cat({ icon: "sport", name: "Спорт" })]);
    expect(migrated[0].icon).toBe("sport");
    expect(migrated[0].name).toBe("Спорт");
  });
});

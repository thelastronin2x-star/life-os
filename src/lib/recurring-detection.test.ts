import { describe, expect, it } from "vitest";
import { detectRecurringTransactions } from "./recurring-detection";
import type { Transaction } from "./finance-store";

let idCounter = 0;
function txn(overrides: Partial<Transaction> & Pick<Transaction, "date" | "title" | "amount">): Transaction {
  idCounter++;
  return {
    id: `t${idCounter}`,
    type: "expense",
    categoryId: null,
    accountId: "acc1",
    ...overrides,
  };
}

describe("detectRecurringTransactions", () => {
  it("detects a merchant with 3 monthly occurrences of the same amount", () => {
    const transactions = [
      txn({ date: "2026-05-15", title: "Netflix", amount: 200 }),
      txn({ date: "2026-06-14", title: "Netflix", amount: 200 }),
      txn({ date: "2026-07-15", title: "Netflix", amount: 200 }),
    ];
    const result = detectRecurringTransactions(transactions);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Netflix");
    expect(result[0].occurrences).toBe(3);
    expect(result[0].nextDateEstimate).toBe("2026-08-14");
  });

  it("does not detect a merchant with only 2 occurrences", () => {
    const transactions = [
      txn({ date: "2026-05-15", title: "Netflix", amount: 200 }),
      txn({ date: "2026-06-14", title: "Netflix", amount: 200 }),
    ];
    expect(detectRecurringTransactions(transactions)).toHaveLength(0);
  });

  it("does not detect when amounts vary by more than 10%", () => {
    const transactions = [
      txn({ date: "2026-05-15", title: "Groceries", amount: 200 }),
      txn({ date: "2026-06-14", title: "Groceries", amount: 500 }),
      txn({ date: "2026-07-15", title: "Groceries", amount: 150 }),
    ];
    expect(detectRecurringTransactions(transactions)).toHaveLength(0);
  });

  it("does not detect when gaps aren't roughly monthly", () => {
    const transactions = [
      txn({ date: "2026-05-01", title: "Coffee", amount: 80 }),
      txn({ date: "2026-05-08", title: "Coffee", amount: 80 }),
      txn({ date: "2026-05-15", title: "Coffee", amount: 80 }),
    ];
    expect(detectRecurringTransactions(transactions)).toHaveLength(0);
  });

  it("groups occurrences under different terminal-number suffixes as one merchant", () => {
    const transactions = [
      txn({ date: "2026-05-10", title: "АТБ №1234", amount: 600 }),
      txn({ date: "2026-06-09", title: "АТБ №5678", amount: 610 }),
      txn({ date: "2026-07-10", title: "АТБ №9012", amount: 590 }),
    ];
    const result = detectRecurringTransactions(transactions);
    expect(result).toHaveLength(1);
    expect(result[0].occurrences).toBe(3);
  });

  it("ranks merchants with more occurrences first", () => {
    const transactions = [
      txn({ date: "2026-02-01", title: "Gym", amount: 500 }),
      txn({ date: "2026-03-01", title: "Gym", amount: 500 }),
      txn({ date: "2026-04-01", title: "Gym", amount: 500 }),
      txn({ date: "2026-05-01", title: "Gym", amount: 500 }),
      txn({ date: "2026-05-15", title: "Spotify", amount: 150 }),
      txn({ date: "2026-06-14", title: "Spotify", amount: 150 }),
      txn({ date: "2026-07-15", title: "Spotify", amount: 150 }),
    ];
    const result = detectRecurringTransactions(transactions);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Gym");
    expect(result[1].title).toBe("Spotify");
  });
});

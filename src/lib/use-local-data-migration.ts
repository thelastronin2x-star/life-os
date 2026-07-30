"use client";

import { useCallback, useState } from "react";
import { useFinanceStore } from "./finance-store";
import { useLocalMigrationStore } from "./local-migration-store";

export interface MigrationResult {
  migrated: number;
  alreadyExisted: number;
  skippedTransfers: number;
}

/** Downloads the whole local Фінанси store (not just transactions — the
 *  full picture is what makes it a real restorable backup) as a JSON file,
 *  before the one-time upload to the server ledger. */
export function downloadLocalFinanceBackup(): void {
  const state = useFinanceStore.getState();
  const payload = {
    exportedAt: new Date().toISOString(),
    accounts: state.accounts,
    goals: state.goals,
    budgetCategories: state.budgetCategories,
    transactions: state.transactions,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `life-os-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function useLocalDataMigration() {
  const { migratedAt, setMigratedAt } = useLocalMigrationStore();
  const [isMigrating, setIsMigrating] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const migrate = useCallback(async () => {
    setIsMigrating(true);
    setError(null);
    setResult(null);
    try {
      const { transactions } = useFinanceStore.getState();
      const res = await fetch("/api/finance/monobank/migrate-local-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error === "not_connected" ? "Спочатку підключи Monobank" : "Не вдалося перенести дані");
        return;
      }
      const data: MigrationResult = await res.json();
      setResult(data);
      setMigratedAt(new Date().toISOString());
    } catch {
      setError("Не вдалося перенести дані");
    } finally {
      setIsMigrating(false);
    }
  }, [setMigratedAt]);

  return { migratedAt, isMigrating, result, error, migrate };
}

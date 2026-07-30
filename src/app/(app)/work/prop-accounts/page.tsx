"use client";

import { useState } from "react";
import { WorkSubpageHeader } from "@/components/work/WorkSubpageHeader";
import { PropAccountForm } from "@/components/work/PropAccountForm";
import { Card } from "@/components/ui/Card";
import { usePropAccountsStore, type PropAccount } from "@/lib/prop-accounts-store";
import { useTraderOnlyGuard } from "@/lib/use-trader-guard";

export default function PropAccountsPage() {
  const isTrader = useTraderOnlyGuard();
  const { accounts, addAccount, updateAccount, removeAccount } = usePropAccountsStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PropAccount | null>(null);

  function openAddForm() {
    setEditingAccount(null);
    setFormOpen(true);
  }

  function openEditForm(account: PropAccount) {
    setEditingAccount(account);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingAccount(null);
  }

  function handleSave(data: Omit<PropAccount, "id">) {
    if (editingAccount) {
      updateAccount(editingAccount.id, data);
    } else {
      addAccount(data);
    }
    closeForm();
  }

  function handleDelete(id: string) {
    removeAccount(id);
    closeForm();
  }

  if (!isTrader) return null;

  return (
    <div>
      <div className="flex items-start justify-between">
        <WorkSubpageHeader title="Prop-акаунти" subtitle={`${accounts.length} акаунтів`} />
        <button
          onClick={openAddForm}
          className="mt-2 flex-shrink-0 rounded-full bg-accent px-3.5 py-2 text-[11.5px] font-semibold text-bg"
        >
          + акаунт
        </button>
      </div>

      {accounts.length === 0 && (
        <div className="rounded-card-sm bg-surface shadow-card py-8 text-center text-[11.5px] text-text-faint">
          Ще немає доданих prop-акаунтів
        </div>
      )}

      {accounts.map((acc) => (
        <Card key={acc.id} className="mb-2.5">
          <div className="mb-2 flex items-baseline justify-between">
            <div>
              <div className="text-[13px] font-semibold text-text">{acc.firm}</div>
              <div className="text-[10.5px] text-text-faint">{acc.phase}</div>
            </div>
            <button onClick={() => openEditForm(acc)} className="text-[10.5px] text-text-faint">
              ред. ›
            </button>
          </div>
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-sage"
              style={{ width: `${Math.min(100, (acc.profitPct / acc.profitTarget) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10.5px] text-text-faint">
            <span>
              Profit: {acc.profitPct}% / {acc.profitTarget}%
            </span>
            <span>
              Drawdown: {acc.drawdownPct}% / {acc.maxDrawdown}%
            </span>
          </div>
        </Card>
      ))}

      {formOpen && (
        <PropAccountForm
          editingAccount={editingAccount}
          onSave={handleSave}
          onClose={closeForm}
          onDelete={editingAccount ? handleDelete : undefined}
        />
      )}
    </div>
  );
}

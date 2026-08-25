"use client";

import { useState } from "react";
import { WorkSubpageHeader } from "@/components/work/WorkSubpageHeader";
import { PropAccountForm } from "@/components/work/PropAccountForm";
import { Card } from "@/components/ui/Card";
import { usePropAccountsStore, type PropAccount } from "@/lib/prop-accounts-store";
import { useTraderOnlyGuard } from "@/lib/use-trader-guard";
import { BriefcaseIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const ACCOUNT_COLORS = ["sage", "sky", "gold", "rose", "clay"] as const;

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
          className="mt-2 flex-shrink-0 rounded-btn bg-accent px-3.5 py-2 text-[11.5px] font-semibold text-bg"
        >
          + акаунт
        </button>
      </div>

      {accounts.length === 0 && (
        <div className="rounded-card-sm bg-surface shadow-card py-8 text-center text-[11.5px] text-text-faint">
          Ще немає доданих prop-акаунтів
        </div>
      )}

      {accounts.map((acc, i) => {
        const color = ACCOUNT_COLORS[i % ACCOUNT_COLORS.length];
        return (
          <Card key={acc.id} className="mb-2.5">
            <div className="mb-3 flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-icon"
                style={{ background: `var(--${color}-soft)`, color: `var(--${color})` }}
              >
                <BriefcaseIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-text">{acc.firm}</div>
                <div className="text-[10.5px] text-text-faint">{acc.phase}</div>
              </div>
              <button onClick={() => openEditForm(acc)} className="flex-shrink-0 text-[10.5px] text-text-faint">
                ред. ›
              </button>
            </div>

            <div className="mb-1 flex items-center justify-between text-[10.5px] text-text-faint">
              <span>Ціль {acc.profitTarget}%</span>
              <span className="font-mono">
                {acc.profitPct}% / {acc.profitTarget}%
              </span>
            </div>
            <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-sage"
                style={{ width: `${Math.min(100, (acc.profitPct / acc.profitTarget) * 100)}%` }}
              />
            </div>

            <div className="mb-1 flex items-center justify-between text-[10.5px] text-text-faint">
              <span>Просадка</span>
              <span
                className={cn(
                  "font-mono",
                  acc.drawdownPct / acc.maxDrawdown > 0.8 ? "font-semibold text-clay" : undefined
                )}
              >
                {acc.drawdownPct}% / {acc.maxDrawdown}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn("h-full rounded-full", acc.drawdownPct / acc.maxDrawdown > 0.8 ? "bg-clay" : "bg-gold")}
                style={{ width: `${Math.min(100, (acc.drawdownPct / acc.maxDrawdown) * 100)}%` }}
              />
            </div>
          </Card>
        );
      })}

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

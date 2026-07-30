"use client";

import { usePersonalTradingAccountsStore } from "./personal-trading-accounts-store";
import { usePropAccountsStore } from "./prop-accounts-store";
import { useJournalStore, type Trade } from "./journal-store";
import { useJournalConfigStore, type JournalInstrument } from "./journal-config-store";
import { computeTradePnL } from "./trade-calculations";

export interface PersonalAccountView {
  kind: "personal";
  id: string;
  name: string;
  startingDeposit: number;
  netPnL: number;
  balance: number;
}

export interface PropAccountView {
  kind: "prop";
  id: string;
  name: string;
  phase: string;
  profitPct: number;
  profitTarget: number;
  drawdownPct: number;
  maxDrawdown: number;
  netPnL: number;
}

export type TradingAccountView = PersonalAccountView | PropAccountView;

function closedNetPnL(trades: Trade[], accountId: string, instrumentById: Map<string, JournalInstrument>): number {
  return trades
    .filter((t) => t.accountId === accountId && t.status === "closed")
    .reduce((sum, t) => sum + (computeTradePnL(t, instrumentById.get(t.instrumentId)).net ?? 0), 0);
}

/** Combined library of trading accounts (personal deposits + prop-firm challenges)
 *  used everywhere a trader needs to pick "which account am I looking at" —
 *  currently the Journal account selector, reusable wherever else it's needed. */
export function useTradingAccounts(): TradingAccountView[] {
  const personal = usePersonalTradingAccountsStore((s) => s.accounts);
  const prop = usePropAccountsStore((s) => s.accounts);
  const trades = useJournalStore((s) => s.trades);
  const instruments = useJournalConfigStore((s) => s.instruments);
  const instrumentById = new Map(instruments.map((i) => [i.id, i]));

  const personalViews: PersonalAccountView[] = personal.map((a) => {
    const netPnL = closedNetPnL(trades, a.id, instrumentById);
    return {
      kind: "personal",
      id: a.id,
      name: a.name,
      startingDeposit: a.startingDeposit,
      netPnL,
      balance: a.startingDeposit + netPnL,
    };
  });

  const propViews: PropAccountView[] = prop.map((a) => ({
    kind: "prop",
    id: a.id,
    name: a.firm,
    phase: a.phase,
    profitPct: a.profitPct,
    profitTarget: a.profitTarget,
    drawdownPct: a.drawdownPct,
    maxDrawdown: a.maxDrawdown,
    netPnL: closedNetPnL(trades, a.id, instrumentById),
  }));

  return [...personalViews, ...propViews];
}

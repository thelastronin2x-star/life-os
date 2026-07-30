"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { CURRENCIES, useAppStore } from "@/lib/store";
import { useJournalStore, type Trade } from "@/lib/journal-store";
import { useJournalConfigStore } from "@/lib/journal-config-store";
import { useTradingAccounts } from "@/lib/trading-accounts";
import { computeTradePnL } from "@/lib/trade-calculations";
import { useTraderOnlyGuard } from "@/lib/use-trader-guard";
import { cn } from "@/lib/cn";

interface GroupStat {
  key: string;
  label: string;
  count: number;
  wins: number;
  net: number;
}

function buildGroups(
  trades: { trade: Trade; net: number | null }[],
  keyFn: (t: Trade) => string[],
  labelFn: (key: string) => string
): GroupStat[] {
  const map = new Map<string, GroupStat>();
  for (const { trade, net } of trades) {
    if (net === null) continue;
    for (const key of keyFn(trade)) {
      const existing = map.get(key) ?? { key, label: labelFn(key), count: 0, wins: 0, net: 0 };
      existing.count += 1;
      existing.net += net;
      if (net > 0) existing.wins += 1;
      map.set(key, existing);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.net - a.net);
}

function GroupTable({ title, groups, currencySymbol }: { title: string; groups: GroupStat[]; currencySymbol: string }) {
  if (groups.length === 0) return null;
  return (
    <div className="mb-3 rounded-card-sm bg-surface shadow-card p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">{title}</div>
      <div className="space-y-1.5">
        {groups.map((g) => {
          const winRate = g.count > 0 ? Math.round((g.wins / g.count) * 100) : 0;
          return (
            <div key={g.key} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
              <div>
                <div className="text-[12px] font-medium text-text">{g.label}</div>
                <div className="text-[10px] text-text-faint">
                  {g.count} угод · win rate {winRate}%
                </div>
              </div>
              <span className={cn("font-mono text-[13px] font-bold", g.net >= 0 ? "text-sage" : "text-rose")}>
                {g.net >= 0 ? "+" : ""}
                {g.net.toFixed(0)} {currencySymbol}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function JournalStatsPage() {
  const isTrader = useTraderOnlyGuard();
  const currencyId = useAppStore((s) => s.settings.currency);
  const currencySymbol = CURRENCIES.find((c) => c.id === currencyId)?.symbol ?? "₴";

  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId");
  const accounts = useTradingAccounts();
  const account = accounts.find((a) => a.id === accountId) ?? null;

  const { trades: allTrades } = useJournalStore();
  const trades = useMemo(
    () => (accountId ? allTrades.filter((t) => t.accountId === accountId) : allTrades),
    [allTrades, accountId]
  );
  const { instruments, tags, sessions } = useJournalConfigStore();

  const instrumentById = useMemo(() => new Map(instruments.map((i) => [i.id, i])), [instruments]);
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  const withPnl = useMemo(
    () =>
      trades.map((trade) => ({
        trade,
        net: computeTradePnL(trade, instrumentById.get(trade.instrumentId)).net,
      })),
    [trades, instrumentById]
  );

  const closed = withPnl.filter((t) => t.net !== null);
  const wins = closed.filter((t) => (t.net ?? 0) > 0);
  const losses = closed.filter((t) => (t.net ?? 0) <= 0);
  const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.net ?? 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.net ?? 0), 0) / losses.length : 0;
  const grossWin = wins.reduce((s, t) => s + (t.net ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.net ?? 0), 0));
  const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : grossWin > 0 ? "∞" : "—";
  const totalCommission = trades.reduce((s, t) => s + t.commission, 0);
  const totalSwap = trades.reduce((s, t) => s + t.swap, 0);

  const byInstrument = buildGroups(
    withPnl,
    (t) => [t.instrumentId],
    (key) => instrumentById.get(key)?.symbol ?? key
  );
  const byTag = buildGroups(
    withPnl,
    (t) => t.tagIds,
    (key) => tagById.get(key)?.name ?? key
  );
  const bySession = buildGroups(
    withPnl,
    (t) => (t.sessionId ? [t.sessionId] : []),
    (key) => sessionById.get(key)?.name ?? key
  );

  if (!isTrader) return null;

  return (
    <div>
      <div className="pb-3.5 pt-2">
        <Link href="/work/journal" className="mb-2 flex items-center gap-2 text-[12.5px] text-text-dim">
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-border bg-surface">
            ‹
          </span>
          Журнал
        </Link>
        <div className="font-heading text-lg font-semibold text-text">Статистика</div>
        <div className="mt-0.5 text-[11.5px] text-text-faint">
          {account ? `${account.name} · ` : ""}Розбивка по тегах, інструментах, сесіях
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-card-sm bg-surface shadow-card p-2.5 text-center">
          <div className="text-[8px] uppercase text-text-faint">Win rate</div>
          <div className="font-mono text-[15px] font-bold text-text">{winRate}%</div>
        </div>
        <div className="rounded-card-sm bg-surface shadow-card p-2.5 text-center">
          <div className="text-[8px] uppercase text-text-faint">Profit Factor</div>
          <div className="font-mono text-[15px] font-bold text-gold">{profitFactor}</div>
        </div>
        <div className="rounded-card-sm bg-surface shadow-card p-2.5 text-center">
          <div className="text-[8px] uppercase text-text-faint">Сер. виграш</div>
          <div className="font-mono text-[15px] font-bold text-sage">
            +{avgWin.toFixed(0)} {currencySymbol}
          </div>
        </div>
        <div className="rounded-card-sm bg-surface shadow-card p-2.5 text-center">
          <div className="text-[8px] uppercase text-text-faint">Сер. програш</div>
          <div className="font-mono text-[15px] font-bold text-rose">
            {avgLoss.toFixed(0)} {currencySymbol}
          </div>
        </div>
      </div>

      <div className="mb-3 rounded-card-sm bg-surface shadow-card p-3">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
          Витрати брокера (всього)
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[12px] text-text-dim">Комісія</span>
          <span className="font-mono text-[13px] font-semibold text-clay">-{totalCommission.toFixed(2)} {currencySymbol}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[12px] text-text-dim">Своп</span>
          <span className={cn("font-mono text-[13px] font-semibold", totalSwap >= 0 ? "text-sage" : "text-clay")}>
            {totalSwap >= 0 ? "+" : ""}
            {totalSwap.toFixed(2)} {currencySymbol}
          </span>
        </div>
      </div>

      <GroupTable title="По інструменту" groups={byInstrument} currencySymbol={currencySymbol} />
      <GroupTable title="По тегу / сетапу" groups={byTag} currencySymbol={currencySymbol} />
      <GroupTable title="По сесії" groups={bySession} currencySymbol={currencySymbol} />

      {closed.length === 0 && (
        <div className="rounded-card-sm bg-surface shadow-card py-8 text-center text-[11.5px] text-text-faint">
          Ще немає закритих угод для статистики
        </div>
      )}
    </div>
  );
}

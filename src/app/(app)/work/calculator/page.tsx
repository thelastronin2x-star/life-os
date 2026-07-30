"use client";

import { useMemo, useState } from "react";
import { WorkSubpageHeader } from "@/components/work/WorkSubpageHeader";
import { Card } from "@/components/ui/Card";
import { NumberInput } from "@/components/ui/NumberInput";
import { CURRENCY_PAIRS, RISK_PRESETS } from "@/lib/currency-pairs";
import { CURRENCIES, useAppStore } from "@/lib/store";
import { useTraderOnlyGuard } from "@/lib/use-trader-guard";

export default function RiskCalculatorPage() {
  const isTrader = useTraderOnlyGuard();
  const currencyId = useAppStore((s) => s.settings.currency);
  const currencySymbol = CURRENCIES.find((c) => c.id === currencyId)?.symbol ?? "₴";

  const [pairSymbol, setPairSymbol] = useState(CURRENCY_PAIRS[0].symbol);
  const [deposit, setDeposit] = useState(10000);
  const [riskPct, setRiskPct] = useState(1.5);
  const [stopPips, setStopPips] = useState(25);

  const pair = CURRENCY_PAIRS.find((p) => p.symbol === pairSymbol) ?? CURRENCY_PAIRS[0];

  const riskAmount = deposit * (riskPct / 100);
  const lotSize = useMemo(
    () => (stopPips > 0 ? riskAmount / (stopPips * pair.pipValuePerLot) : 0),
    [riskAmount, stopPips, pair]
  );
  const potentialProfit = riskAmount * 2;

  if (!isTrader) return null;

  return (
    <div>
      <WorkSubpageHeader title="Ризик-калькулятор" subtitle="Автоматичний розрахунок лота" />

      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-dim">
        Валютна пара
      </div>
      <select
        value={pairSymbol}
        onChange={(e) => setPairSymbol(e.target.value)}
        className="mb-3 w-full rounded-input border border-border bg-surface-2 px-3.5 py-3 text-[14px] font-semibold text-text outline-none"
      >
        {CURRENCY_PAIRS.map((p) => (
          <option key={p.symbol} value={p.symbol}>
            {p.symbol}
          </option>
        ))}
      </select>

      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-dim">
        Депозит рахунку
      </div>
      <div className="mb-3 flex items-center justify-between rounded-input border border-border bg-surface-2 px-3.5 py-3">
        <NumberInput
          value={deposit}
          onChange={setDeposit}
          className="w-full bg-transparent font-mono text-[14px] font-semibold text-text outline-none"
        />
        <span className="flex-shrink-0 text-[11px] text-text-faint">{currencySymbol}</span>
      </div>

      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-dim">
        Ризик на угоду
      </div>
      <div className="mb-2 flex items-center justify-between rounded-input border border-border bg-surface-2 px-3.5 py-3">
        <NumberInput
          value={riskPct}
          onChange={setRiskPct}
          className="w-16 bg-transparent font-mono text-[14px] font-semibold text-text outline-none"
        />
        <span className="flex-shrink-0 text-[11px] text-text-faint">% від депозиту</span>
      </div>
      <input
        type="range"
        min={0.5}
        max={5}
        step={0.1}
        value={riskPct}
        onChange={(e) => setRiskPct(Number(e.target.value))}
        className="mb-1 w-full accent-[var(--sage)]"
      />
      <div className="mb-3.5 flex justify-between text-[9.5px] text-text-faint">
        <span>0.5%</span>
        <span>2%</span>
        <span>5%</span>
      </div>

      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-dim">
        Стоп-лосс
      </div>
      <div className="mb-4 flex items-center justify-between rounded-input border border-border bg-surface-2 px-3.5 py-3">
        <NumberInput
          value={stopPips}
          onChange={setStopPips}
          className="w-16 bg-transparent font-mono text-[14px] font-semibold text-text outline-none"
        />
        <span className="flex-shrink-0 text-[11px] text-text-faint">пунктів</span>
      </div>

      <Card className="mb-4 border-sage/60 bg-gradient-to-br from-surface-2 to-surface">
        <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-sage">
          Результат розрахунку
        </div>
        <div className="flex items-center justify-between border-b border-border py-2">
          <span className="text-[11.5px] text-text-dim">Ризик у грошах</span>
          <span className="font-mono text-[14px] font-bold text-text">
            {riskAmount.toFixed(0)} {currencySymbol}
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border py-2">
          <span className="text-[11.5px] text-text-dim">Вартість пункту</span>
          <span className="font-mono text-[14px] font-bold text-text">
            {pair.pipValuePerLot.toFixed(1)} $
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border py-2">
          <span className="text-[11.5px] text-text-dim">Рекомендований лот</span>
          <span className="font-mono text-[18px] font-bold text-sage">{lotSize.toFixed(2)} лот</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-[11.5px] text-text-dim">При тейк-профіті 1:2</span>
          <span className="font-mono text-[14px] font-bold text-sky">
            +{potentialProfit.toFixed(0)} {currencySymbol}
          </span>
        </div>
      </Card>

      <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-text-dim">
        Швидкі пресети ризику
      </div>
      <div className="flex gap-2">
        {RISK_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setRiskPct(preset.value)}
            className={`flex-1 rounded-full border px-2 py-2 text-center text-[10.5px] font-medium ${
              riskPct === preset.value
                ? "border-sage bg-sage text-bg font-semibold"
                : "border-border bg-surface text-text-dim"
            }`}
          >
            {preset.label} {preset.value}%
          </button>
        ))}
      </div>
    </div>
  );
}

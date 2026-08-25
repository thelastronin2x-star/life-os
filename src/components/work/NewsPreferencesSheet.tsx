"use client";

import { useState } from "react";
import { useNewsPreferencesStore, MAX_TICKERS } from "@/lib/news-preferences-store";
import { NEWS_MARKETS } from "@/lib/news/types";
import { MARKET_FILTER_LABELS } from "@/lib/news-view";
import { cn } from "@/lib/cn";
import { TrashIcon } from "@/components/icons";

export function NewsPreferencesSheet({ onClose }: { onClose: () => void }) {
  const { markets, tickers, toggleMarket, addTicker, removeTicker } = useNewsPreferencesStore();
  const [newTicker, setNewTicker] = useState("");

  function handleAddTicker() {
    const t = newTicker.trim();
    if (!t) return;
    addTicker(t);
    setNewTicker("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="w-full max-w-md rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[14px] font-bold text-text">Твої ринки</div>
          <button onClick={onClose} className="text-[13px] font-bold text-text-dim">
            Закрити
          </button>
        </div>

        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">Ринки</div>
        <div className="mb-4 flex flex-wrap gap-2">
          {NEWS_MARKETS.map((market) => {
            const active = markets.includes(market);
            return (
              <button
                key={market}
                onClick={() => toggleMarket(market)}
                className={cn(
                  "rounded-btn px-3.5 py-2 text-[11.5px] font-extrabold",
                  active ? "bg-text text-bg" : "bg-surface text-text-dim"
                )}
              >
                {MARKET_FILTER_LABELS[market]}
              </button>
            );
          })}
        </div>

        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">
          Свої тикери (до {MAX_TICKERS})
        </div>
        <div className="mb-2 flex gap-1.5">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTicker()}
            placeholder="напр. AAPL"
            disabled={tickers.length >= MAX_TICKERS}
            className="flex-1 rounded-input border border-border bg-surface px-3 py-2 text-[12.5px] uppercase text-text outline-none disabled:opacity-50"
          />
          <button
            onClick={handleAddTicker}
            disabled={tickers.length >= MAX_TICKERS}
            className="rounded-btn bg-accent px-4 py-2 text-[12px] font-semibold text-bg disabled:opacity-50"
          >
            Додати
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tickers.map((t) => (
            <span key={t} className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[11px] font-bold text-text-dim">
              {t}
              <button onClick={() => removeTicker(t)}>
                <TrashIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

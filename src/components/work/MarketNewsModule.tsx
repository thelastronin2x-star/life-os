"use client";

import { useState } from "react";
import { useNewsFeed } from "@/lib/use-news-feed";
import { MARKET_FILTER_LABELS, pickFocusItem, filterByMarket, formatRelativeTime } from "@/lib/news-view";
import type { NewsItem, NewsMarket } from "@/lib/news/types";
import { cn } from "@/lib/cn";
import { NewspaperIcon, AlertTriangleIcon, GearIcon } from "@/components/icons";
import { NewsPreferencesSheet } from "./NewsPreferencesSheet";
import { NewsDetailSheet } from "./NewsDetailSheet";

const FILTERS: ("all" | NewsMarket)[] = ["all", "indices", "forex", "crypto", "commodities"];

function SentimentDot({ sentiment }: { sentiment: NewsItem["sentiment"] }) {
  if (!sentiment) return null;
  return (
    <span
      className={cn(
        "h-1.5 w-1.5 flex-shrink-0 rounded-full",
        sentiment === "positive" && "bg-sage",
        sentiment === "negative" && "bg-clay",
        sentiment === "neutral" && "bg-text-faint"
      )}
    />
  );
}

function NewsRow({ item, onOpen }: { item: NewsItem; onOpen: (item: NewsItem) => void }) {
  return (
    <button
      onClick={() => onOpen(item)}
      className="flex w-full items-start gap-2.5 border-b border-border py-3 text-left last:border-b-0"
    >
      <SentimentDot sentiment={item.sentiment} />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold leading-snug text-text">{item.headline}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-text-faint">
          <span>{item.source}</span>
          <span>·</span>
          <span>{formatRelativeTime(item.publishedAt)}</span>
          {item.markets[0] && (
            <>
              <span>·</span>
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-semibold text-text-dim">
                {MARKET_FILTER_LABELS[item.markets[0]]}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

export function MarketNewsModule() {
  const { items, loading, error } = useNewsFeed();
  const [filter, setFilter] = useState<"all" | NewsMarket>("all");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);

  const focusItem = pickFocusItem(items);
  const listItems = filterByMarket(items, filter)
    .filter((item) => item.id !== focusItem?.id)
    .slice(0, 8);

  return (
    <div className="mb-4">
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">
          <NewspaperIcon className="h-3.5 w-3.5" />
          Що рухає твої ринки
        </div>
        <button onClick={() => setPrefsOpen(true)} aria-label="Налаштування ринків" className="text-text-faint">
          <GearIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="card-raised rounded-card bg-surface py-8 text-center text-[11.5px] text-text-faint">
          Завантажую новини…
        </div>
      ) : error ? (
        <div className="card-raised rounded-card bg-surface py-8 text-center text-[11.5px] text-text-faint">
          Не вдалося завантажити новини. Спробуй пізніше.
        </div>
      ) : items.length === 0 ? (
        <div className="card-raised rounded-card bg-surface py-8 text-center text-[11.5px] text-text-faint">
          Поки немає новин для обраних ринків
        </div>
      ) : (
        <>
          {focusItem && (
            <button
              onClick={() => setSelectedItem(focusItem)}
              className="card-raised mb-3 block w-full rounded-card bg-surface p-3.5 text-left"
            >
              <div className="mb-1.5 text-[9.5px] font-bold uppercase tracking-wide text-sage">Зараз у фокусі</div>
              <div className="text-[13.5px] font-bold leading-snug text-text">{focusItem.headline}</div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-text-faint">
                <span>{focusItem.source}</span>
                <span>·</span>
                <span>{formatRelativeTime(focusItem.publishedAt)}</span>
              </div>
            </button>
          )}

          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-shrink-0 rounded-btn px-3.5 py-2 text-[11.5px] font-extrabold",
                  filter === f ? "bg-text text-bg" : "bg-surface text-text-dim"
                )}
              >
                {MARKET_FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          {listItems.length === 0 ? (
            <div className="card-raised rounded-card bg-surface py-8 text-center text-[11.5px] text-text-faint">
              Поки немає новин для обраних ринків
            </div>
          ) : (
            <div className="card-raised rounded-card bg-surface px-3.5">
              {listItems.map((item) => (
                <NewsRow key={item.id} item={item} onOpen={setSelectedItem} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="card-raised mt-3 flex items-start gap-3 rounded-card border border-gold/25 bg-gold-soft p-3.5">
        <span className="well-pressed flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface text-gold">
          <AlertTriangleIcon className="h-4 w-4" />
        </span>
        <div className="text-[11.5px] leading-relaxed text-text-dim">
          Перед угодою — перевір макроподії найближчих 60 хвилин.
        </div>
      </div>

      {prefsOpen && <NewsPreferencesSheet onClose={() => setPrefsOpen(false)} />}
      {selectedItem && <NewsDetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}

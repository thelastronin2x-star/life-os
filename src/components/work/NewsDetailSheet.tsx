"use client";

import type { NewsItem } from "@/lib/news/types";
import { MARKET_FILTER_LABELS, formatRelativeTime } from "@/lib/news-view";
import { cn } from "@/lib/cn";

function SentimentLabel({ sentiment }: { sentiment: NewsItem["sentiment"] }) {
  if (!sentiment) return null;
  const label = sentiment === "positive" ? "Позитивна" : sentiment === "negative" ? "Негативна" : "Нейтральна";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold",
        sentiment === "positive" && "bg-sage/15 text-sage",
        sentiment === "negative" && "bg-clay/15 text-clay",
        sentiment === "neutral" && "bg-surface-2 text-text-faint"
      )}
    >
      {label}
    </span>
  );
}

/** In-app reading experience for a news item — headline + already-cached
 *  summary + metadata, so tapping a headline never leaves the app. The
 *  external site is reachable only via the explicit "Читати оригінал"
 *  link below, matching the NewsItem model's ToS constraint (no full
 *  article text is ever cached, only headline+summary). */
export function NewsDetailSheet({ item, onClose }: { item: NewsItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg p-5 shadow-card md:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-text-faint">
            <span>{item.source}</span>
            <span>·</span>
            <span>{formatRelativeTime(item.publishedAt)}</span>
          </div>
          <button onClick={onClose} className="text-[13px] font-bold text-text-dim">
            Закрити
          </button>
        </div>

        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <SentimentLabel sentiment={item.sentiment} />
          {item.markets.map((market) => (
            <span key={market} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-text-dim">
              {MARKET_FILTER_LABELS[market]}
            </span>
          ))}
          {item.tickers.map((ticker) => (
            <span key={ticker} className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold text-text-dim">
              {ticker}
            </span>
          ))}
        </div>

        <div className="mb-3 text-[16px] font-bold leading-snug text-text">{item.headline}</div>

        {item.summary && <p className="mb-4 text-[13px] leading-relaxed text-text-dim">{item.summary}</p>}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-btn bg-text px-4 py-3 text-center text-[12.5px] font-extrabold text-bg"
        >
          Читати оригінал →
        </a>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useNewsFeed } from "@/lib/use-news-feed";
import { pickFocusItem, formatRelativeTime } from "@/lib/news-view";
import { NewspaperIcon } from "@/components/icons";

/** Compact teaser embedded in the Робота scroll — links out to the
 *  dedicated /work/news page rather than embedding the full module inline,
 *  since news now has its own subpage (matching /work/journal, /work/calculator). */
export function NewsTeaser() {
  const { items, loading } = useNewsFeed();
  const focusItem = pickFocusItem(items);

  return (
    <Link href="/work/news" className="mb-4 block rounded-card border border-border bg-surface p-3.5">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">
          <NewspaperIcon className="h-3.5 w-3.5" />
          Що рухає твої ринки
        </div>
        <span className="text-[11px] font-semibold text-sage">Усі новини →</span>
      </div>
      {loading ? (
        <div className="text-[11.5px] text-text-faint">Завантажую новини…</div>
      ) : focusItem ? (
        <>
          <div className="text-[13px] font-bold leading-snug text-text">{focusItem.headline}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-text-faint">
            <span>{focusItem.source}</span>
            <span>·</span>
            <span>{formatRelativeTime(focusItem.publishedAt)}</span>
          </div>
        </>
      ) : (
        <div className="text-[11.5px] text-text-faint">Поки немає новин</div>
      )}
    </Link>
  );
}

"use client";

import type { MacroEvent } from "@/lib/macro/types";
import { REGION_FLAGS } from "@/lib/macro/view";
import { cn } from "@/lib/cn";

const IMPORTANCE_LABEL: Record<MacroEvent["importance"], string> = { high: "Висока", medium: "Середня", low: "Низька" };

export function MacroEventDetailSheet({ event, onClose }: { event: MacroEvent; onClose: () => void }) {
  const scheduled = new Date(event.scheduledAt);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-card bg-bg p-5 shadow-card md:rounded-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-text-faint">
            <span>{REGION_FLAGS[event.region]}</span>
            <span>{event.currency}</span>
          </div>
          <button onClick={onClose} className="text-[13px] font-bold text-text-dim">
            Закрити
          </button>
        </div>

        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              event.importance === "high" && "bg-clay/15 text-clay",
              event.importance === "medium" && "bg-gold/15 text-gold",
              event.importance === "low" && "bg-surface-2 text-text-faint"
            )}
          >
            Важливість: {IMPORTANCE_LABEL[event.importance]}
          </span>
          {event.affectedMarkets.map((market) => (
            <span key={market} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-text-dim">
              {market}
            </span>
          ))}
        </div>

        <div className="mb-3 text-[16px] font-bold leading-snug text-text">{event.title}</div>

        <div className="mb-4 rounded-card border border-border bg-surface p-3.5 text-[12.5px] text-text-dim">
          <div className="flex items-center justify-between border-b border-border py-1.5 first:pt-0 last:border-b-0">
            <span className="text-text-faint">Дата</span>
            <span className="font-semibold text-text">
              {scheduled.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
          {event.previous && (
            <div className="flex items-center justify-between border-b border-border py-1.5 last:border-b-0">
              <span className="text-text-faint">Попереднє значення</span>
              <span className="font-semibold text-text">{event.previous}</span>
            </div>
          )}
          {event.actual && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-text-faint">Фактичне значення</span>
              <span className="font-semibold text-text">{event.actual}</span>
            </div>
          )}
        </div>

        {event.sourceUrl && (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-btn bg-text px-4 py-3 text-center text-[12.5px] font-extrabold text-bg"
          >
            Читати джерело →
          </a>
        )}
      </div>
    </div>
  );
}

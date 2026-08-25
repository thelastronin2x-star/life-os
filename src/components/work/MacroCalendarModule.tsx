"use client";

import { useState } from "react";
import { useMacroEvents } from "@/lib/use-macro-events";
import { CURRENCY_FILTER_LABELS, REGION_FLAGS, filterByCurrency, formatUpcomingTime } from "@/lib/macro/view";
import type { MacroEvent, MacroCurrency } from "@/lib/macro/types";
import { cn } from "@/lib/cn";
import { CalendarDateIcon } from "@/components/icons";
import { MacroEventDetailSheet } from "./MacroEventDetailSheet";

const FILTERS: ("all" | MacroCurrency)[] = ["all", "USD", "EUR", "JPY"];

function ImportanceDot({ importance }: { importance: MacroEvent["importance"] }) {
  return (
    <span
      className={cn(
        "h-1.5 w-1.5 flex-shrink-0 rounded-full",
        importance === "high" && "bg-clay",
        importance === "medium" && "bg-gold",
        importance === "low" && "bg-text-faint"
      )}
    />
  );
}

function MacroEventRow({ event, onOpen }: { event: MacroEvent; onOpen: (event: MacroEvent) => void }) {
  return (
    <button onClick={() => onOpen(event)} className="flex w-full items-start gap-2.5 border-b border-border py-3 text-left last:border-b-0">
      <ImportanceDot importance={event.importance} />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold leading-snug text-text">{event.title}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-text-faint">
          <span>{REGION_FLAGS[event.region]}</span>
          <span>{event.currency}</span>
          <span>·</span>
          <span>{formatUpcomingTime(event.scheduledAt)}</span>
          {event.previous && (
            <>
              <span>·</span>
              <span>попереднє {event.previous}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

/** Sits below MarketNewsModule on /work/news — upcoming US/EU/JP macro
 *  releases that could move the markets a trader is watching. Reads a
 *  server-side cache filled by a daily cron (see api/macro/refresh); the
 *  BusinessQuant/FXMacroData API keys never reach the client. */
export function MacroCalendarModule() {
  const { items, loading, error } = useMacroEvents();
  const [filter, setFilter] = useState<"all" | MacroCurrency>("all");
  const [selectedEvent, setSelectedEvent] = useState<MacroEvent | null>(null);

  const filtered = filterByCurrency(items, filter).slice(0, 10);

  return (
    <div className="mb-4">
      <div className="mb-2.5 flex items-center gap-1.5 px-0.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">
        <CalendarDateIcon className="h-3.5 w-3.5" />
        Економічний календар
      </div>

      {loading ? (
        <div className="rounded-card border border-border bg-surface py-8 text-center text-[11.5px] text-text-faint">Завантажую події…</div>
      ) : error ? (
        <div className="rounded-card border border-border bg-surface py-8 text-center text-[11.5px] text-text-faint">
          Не вдалося завантажити календар. Спробуй пізніше.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-card border border-border bg-surface py-8 text-center text-[11.5px] text-text-faint">Найближчим часом немає значних подій</div>
      ) : (
        <>
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
                {CURRENCY_FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-card border border-border bg-surface py-8 text-center text-[11.5px] text-text-faint">Немає подій для обраної валюти</div>
          ) : (
            <div className="rounded-card border border-border bg-surface px-3.5">
              {filtered.map((event) => (
                <MacroEventRow key={event.id} event={event} onOpen={setSelectedEvent} />
              ))}
            </div>
          )}
        </>
      )}

      {selectedEvent && <MacroEventDetailSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}

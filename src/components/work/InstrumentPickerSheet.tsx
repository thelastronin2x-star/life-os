"use client";

import { useMemo, useState } from "react";
import { CURRENCY_PAIRS, PAIR_CATEGORY_LABELS, type CurrencyPair } from "@/lib/currency-pairs";
import type { JournalInstrument } from "@/lib/journal-config-store";

/** Instrument picker for "+ Угода" — a search box over the full currency-
 *  pairs catalog (majors/crosses/metals/indices/oil) instead of a native
 *  <select> limited to whatever instruments the journal already knows
 *  about (by default just 6). Typing something no pair matches offers it
 *  straight back as a new custom instrument. */
export function InstrumentPickerSheet({
  instruments,
  onSelectExisting,
  onSelectPair,
  onSelectCustom,
  onClose,
}: {
  instruments: JournalInstrument[];
  onSelectExisting: (id: string) => void;
  onSelectPair: (pair: CurrencyPair) => void;
  onSelectCustom: (symbol: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toUpperCase();

  const ownSymbols = useMemo(() => new Set(instruments.map((i) => i.symbol.toUpperCase())), [instruments]);
  const filteredOwn = useMemo(
    () => instruments.filter((i) => !q || i.symbol.toUpperCase().includes(q)),
    [instruments, q]
  );
  const filteredPairs = useMemo(
    () => CURRENCY_PAIRS.filter((p) => !ownSymbols.has(p.symbol.toUpperCase()) && (!q || p.symbol.toUpperCase().includes(q))),
    [ownSymbols, q]
  );
  const exactMatch = q.length > 0 && (ownSymbols.has(q) || CURRENCY_PAIRS.some((p) => p.symbol.toUpperCase() === q));

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-card bg-bg shadow-card md:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="font-heading text-[16px] font-semibold text-text">Інструмент</div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>
        <div className="px-4 pb-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук або новий інструмент…"
            className="w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-[13px] text-text outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filteredOwn.length > 0 && (
            <>
              <div className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-text-faint">Твої інструменти</div>
              {filteredOwn.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => onSelectExisting(i.id)}
                  className="block w-full rounded-input px-2 py-2.5 text-left text-[13px] text-text"
                >
                  {i.symbol}
                </button>
              ))}
            </>
          )}

          {filteredPairs.length > 0 && (
            <>
              <div className="mb-1 mt-3 text-[9.5px] font-bold uppercase tracking-wide text-text-faint">З каталогу</div>
              {filteredPairs.map((p) => (
                <button
                  key={p.symbol}
                  type="button"
                  onClick={() => onSelectPair(p)}
                  className="flex w-full items-center justify-between rounded-input px-2 py-2.5 text-left text-[13px] text-text"
                >
                  <span>{p.symbol}</span>
                  <span className="text-[10px] text-text-faint">{PAIR_CATEGORY_LABELS[p.category]}</span>
                </button>
              ))}
            </>
          )}

          {q.length > 0 && !exactMatch && (
            <button
              type="button"
              onClick={() => onSelectCustom(query.trim())}
              className="mt-3 block w-full rounded-input border border-dashed border-border px-2 py-2.5 text-left text-[13px] font-semibold text-sage"
            >
              + Додати «{query.trim()}» як новий інструмент
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

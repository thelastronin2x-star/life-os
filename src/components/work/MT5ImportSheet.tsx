"use client";

import { useRef, useState } from "react";
import { parseMT5Report, matchesKnownSymbol, type ParsedMT5Trade } from "@/lib/mt5-import";
import { useJournalConfigStore } from "@/lib/journal-config-store";
import { CURRENCY_PAIRS, getContractMultiplier } from "@/lib/currency-pairs";
import { ingestTrades, type IncomingTrade } from "@/lib/trade-ingest";
import { UploadIcon } from "@/components/icons";

type Stage = "pick" | "preview" | "done";

export function MT5ImportSheet({ accountId, onClose }: { accountId: string | null; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedMT5Trade[]>([]);
  const [skippedRows, setSkippedRows] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);

  const { instruments, addInstrument } = useJournalConfigStore();

  async function handleFile(file: File) {
    setError(null);
    const text = await file.text();
    const result = parseMT5Report(text);
    if (result.trades.length === 0) {
      setError("Не вдалося знайти таблицю \"Positions\" у файлі — переконайся, що це звіт історії угод з MT5.");
      return;
    }
    setParsed(result.trades);
    setSkippedRows(result.skippedRows);
    setStage("preview");
  }

  function resolveInstrumentId(symbol: string): string {
    const existing = instruments.find(
      (i) => i.symbol.replace("/", "").toUpperCase() === symbol.replace(/^#/, "").toUpperCase()
    );
    if (existing) return existing.id;

    const pair = CURRENCY_PAIRS.find((p) => matchesKnownSymbol(symbol, p.symbol.replace("/", "")));
    if (pair) {
      return addInstrument({
        symbol: pair.symbol,
        assetType: pair.symbol.startsWith("XAU") || pair.symbol.startsWith("XAG") ? "metals" : "forex",
        contractMultiplier: getContractMultiplier(pair),
      });
    }

    return addInstrument({ symbol, assetType: "custom", contractMultiplier: 1 });
  }

  function handleConfirm() {
    if (!accountId) return;

    const incoming: IncomingTrade[] = parsed.map((p) => ({
      source: "mt5",
      // p.externalId is already "mt5:<positionId>" — strip the prefix since
      // ingestTrades adds it back itself (the one place that owns the final
      // dedup-key format for every source).
      sourceId: p.externalId.replace(/^mt5:/, ""),
      instrumentId: resolveInstrumentId(p.symbol),
      sourceSymbol: p.symbol,
      direction: p.direction,
      date: p.openDate,
      time: p.openTime,
      entry: p.entry,
      stop: p.stop,
      take: p.take,
      lot: p.lot,
      closePrice: p.closePrice,
      commission: p.commission,
      swap: p.swap,
    }));

    const { imported, duplicates } = ingestTrades(accountId, incoming);
    setImportedCount(imported);
    setDuplicateCount(duplicates);
    setStage("done");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">Імпорт з MT5</div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        {stage === "pick" && (
          <>
            <div className="mb-3 text-[11.5px] leading-relaxed text-text-faint">
              У MetaTrader 5: вкладка «Історія» → права кнопка миші → «Звіт» → зберегти як HTML. Файл
              обробляється прямо в браузері, нікуди не завантажується.
            </div>
            {!accountId && (
              <div className="mb-3 text-[11.5px] text-rose">Спочатку обери або створи рахунок у Журналі.</div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!accountId}
              className="flex w-full items-center justify-center gap-1.5 rounded-card-sm border border-dashed border-border p-3.5 text-center text-[12px] text-text-faint disabled:opacity-40"
            >
              <UploadIcon className="h-3.5 w-3.5" /> Обрати файл звіту
            </button>
            {error && <div className="mt-2.5 text-[11px] text-rose">{error}</div>}
          </>
        )}

        {stage === "preview" && (
          <>
            <div className="mb-3 rounded-card-sm bg-surface shadow-card p-3">
              <div className="text-[13px] font-semibold text-text">Знайдено {parsed.length} угод</div>
              {skippedRows > 0 && (
                <div className="mt-1 text-[10.5px] text-text-faint">
                  Пропущено {skippedRows} рядків із незрозумілим форматом
                </div>
              )}
            </div>
            <div className="mb-3 max-h-[240px] space-y-1.5 overflow-y-auto">
              {parsed.slice(0, 50).map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-card-sm bg-surface shadow-card px-3 py-2">
                  <div>
                    <span className="text-[12px] font-medium text-text">{t.symbol}</span>
                    <span className="ml-2 text-[10px] text-text-faint">{t.direction}</span>
                  </div>
                  <span className="font-mono text-[11px] text-text-faint">{t.openDate}</span>
                </div>
              ))}
              {parsed.length > 50 && (
                <div className="text-center text-[10.5px] text-text-faint">і ще {parsed.length - 50}…</div>
              )}
            </div>
            <button
              onClick={handleConfirm}
              className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
            >
              Імпортувати {parsed.length} угод
            </button>
          </>
        )}

        {stage === "done" && (
          <div className="py-4 text-center">
            <div className="mb-1.5 text-[15px] font-semibold text-sage">Готово</div>
            <div className="text-[12px] text-text-dim">
              Імпортовано {importedCount} нових угод
              {duplicateCount > 0 && `, пропущено ${duplicateCount} вже наявних`}
            </div>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
            >
              Закрити
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

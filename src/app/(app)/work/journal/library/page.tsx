"use client";

import Link from "next/link";
import { useState } from "react";
import { useJournalConfigStore, QUICK_ADD_INDICES, QUICK_ADD_CRYPTO, type AssetType } from "@/lib/journal-config-store";
import { CURRENCY_PAIRS, getContractMultiplier } from "@/lib/currency-pairs";
import { useTraderOnlyGuard } from "@/lib/use-trader-guard";
import { cn } from "@/lib/cn";

const ASSET_TYPES: { id: AssetType; label: string }[] = [
  { id: "forex", label: "Forex" },
  { id: "metals", label: "Метали" },
  { id: "indices", label: "Індекси" },
  { id: "crypto", label: "Крипто" },
  { id: "custom", label: "Інше" },
];

type Section = "instruments" | "tags" | "sessions";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "instruments", label: "Інструменти" },
  { id: "tags", label: "Теги" },
  { id: "sessions", label: "Сесії" },
];

export default function JournalLibraryPage() {
  const isTrader = useTraderOnlyGuard();
  const {
    instruments,
    tags,
    sessions,
    addInstrument,
    removeInstrument,
    addTag,
    removeTag,
    addSession,
    removeSession,
  } = useJournalConfigStore();

  const [section, setSection] = useState<Section>("instruments");
  const [newSymbol, setNewSymbol] = useState("");
  const [newAssetType, setNewAssetType] = useState<AssetType>("custom");
  const [newMultiplier, setNewMultiplier] = useState("1");
  const [quickAddCategory, setQuickAddCategory] = useState<Exclude<AssetType, "custom">>("forex");
  const [newTag, setNewTag] = useState("");
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionStart, setNewSessionStart] = useState("08:00");
  const [newSessionEnd, setNewSessionEnd] = useState("17:00");

  function handleAddInstrument() {
    const symbol = newSymbol.trim();
    if (!symbol) return;
    addInstrument({ symbol, assetType: newAssetType, contractMultiplier: Number(newMultiplier) || 1 });
    setNewSymbol("");
    setNewMultiplier("1");
  }

  function handleQuickAdd(symbol: string, assetType: AssetType, contractMultiplier: number) {
    addInstrument({ symbol, assetType, contractMultiplier });
  }

  const existingSymbols = new Set(instruments.map((i) => i.symbol));
  const quickAddForex = CURRENCY_PAIRS.filter(
    (p) => !p.symbol.startsWith("XAU") && !p.symbol.startsWith("XAG") && !existingSymbols.has(p.symbol)
  );
  const quickAddMetals = CURRENCY_PAIRS.filter(
    (p) => (p.symbol.startsWith("XAU") || p.symbol.startsWith("XAG")) && !existingSymbols.has(p.symbol)
  );
  const quickAddIndices = QUICK_ADD_INDICES.filter((s) => !existingSymbols.has(s));
  const quickAddCrypto = QUICK_ADD_CRYPTO.filter((s) => !existingSymbols.has(s));

  const QUICK_ADD_TABS: { id: Exclude<AssetType, "custom">; label: string; count: number }[] = [
    { id: "forex", label: "Forex", count: quickAddForex.length },
    { id: "metals", label: "Метали", count: quickAddMetals.length },
    { id: "indices", label: "Індекси", count: quickAddIndices.length },
    { id: "crypto", label: "Крипто", count: quickAddCrypto.length },
  ];

  const activeQuickAdd =
    quickAddCategory === "forex"
      ? quickAddForex.map((p) => ({ symbol: p.symbol, multiplier: getContractMultiplier(p) }))
      : quickAddCategory === "metals"
        ? quickAddMetals.map((p) => ({ symbol: p.symbol, multiplier: getContractMultiplier(p) }))
        : quickAddCategory === "indices"
          ? quickAddIndices.map((s) => ({ symbol: s, multiplier: 1 }))
          : quickAddCrypto.map((s) => ({ symbol: s, multiplier: 1 }));

  function handleAddTag() {
    const name = newTag.trim();
    if (!name) return;
    addTag(name);
    setNewTag("");
  }

  function handleAddSession() {
    const name = newSessionName.trim();
    if (!name) return;
    addSession({ name, startTime: newSessionStart, endTime: newSessionEnd, timezoneLabel: "GMT+3" });
    setNewSessionName("");
  }

  if (!isTrader) return null;

  return (
    <div>
      <div className="pb-3.5 pt-2">
        <Link href="/work/journal" className="mb-2 flex items-center gap-2 text-[12.5px] text-text-dim">
          <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">
            ‹
          </span>
          Журнал
        </Link>
        <div className="font-heading text-lg font-semibold text-text">Інструменти й теги</div>
        <div className="mt-0.5 text-[11.5px] text-text-faint">Керуй бібліотекою журналу</div>
      </div>

      <div className="mb-4 flex rounded-btn bg-surface-2 p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              "flex-1 rounded-btn py-2 text-center text-xs font-semibold",
              section === s.id ? "bg-surface text-text shadow-card" : "text-text-dim"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "instruments" && (
        <section className="mb-4">
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-text-dim">
            Твої інструменти
          </div>
          {instruments.length === 0 && (
            <div className="mb-2 rounded-card-sm bg-surface shadow-card py-6 text-center text-[11.5px] text-text-faint">
              Ще нічого не додано
            </div>
          )}
          <div className="space-y-1.5">
            {instruments.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-card-sm bg-surface shadow-card px-3 py-2">
                <div>
                  <span className="text-[12.5px] font-medium text-text">{i.symbol}</span>
                  <span className="ml-2 text-[10px] text-text-faint">
                    {ASSET_TYPES.find((a) => a.id === i.assetType)?.label}
                  </span>
                </div>
                {i.isCustom && (
                  <button onClick={() => removeInstrument(i.id)} className="text-[10px] text-rose">
                    видалити
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 text-[10.5px] font-semibold uppercase tracking-wide text-text-dim">
            Швидко додати
          </div>
          <div className="mt-1.5 mb-2 flex rounded-btn bg-surface-2 p-1">
            {QUICK_ADD_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setQuickAddCategory(t.id)}
                className={cn(
                  "flex-1 rounded-btn py-1.5 text-center text-[11px] font-semibold",
                  quickAddCategory === t.id ? "bg-surface text-text shadow-card" : "text-text-dim"
                )}
              >
                {t.label}
                {t.count > 0 && <span className="ml-1 text-text-faint">{t.count}</span>}
              </button>
            ))}
          </div>

          {activeQuickAdd.length === 0 ? (
            <div className="mb-2 rounded-card-sm border border-dashed border-border py-5 text-center text-[11px] text-text-faint">
              Усе доступне в цій категорії вже додано
            </div>
          ) : (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {activeQuickAdd.map((item) => (
                <button
                  key={item.symbol}
                  onClick={() => handleQuickAdd(item.symbol, quickAddCategory, item.multiplier)}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10.5px] text-text-dim"
                >
                  + {item.symbol}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 rounded-card-sm border border-dashed border-border p-2.5">
            <div className="mb-1.5 text-[9.5px] uppercase tracking-wide text-text-faint">Свій інструмент</div>
            <div className="mb-1.5 grid grid-cols-2 gap-1.5">
              <input
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                placeholder="Символ (напр. NAS100)"
                className="rounded-input border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-text outline-none"
              />
              <select
                value={newAssetType}
                onChange={(e) => setNewAssetType(e.target.value as AssetType)}
                className="rounded-input border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-text outline-none"
              >
                {ASSET_TYPES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-1.5">
              <input
                value={newMultiplier}
                onChange={(e) => setNewMultiplier(e.target.value)}
                placeholder="$ за пункт / 1 лот"
                className="flex-1 rounded-input border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-text outline-none"
              />
              <button
                onClick={handleAddInstrument}
                className="rounded-input bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg"
              >
                Додати
              </button>
            </div>
          </div>
        </section>
      )}

      {section === "tags" && (
        <section className="mb-4">
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-text-dim">Теги / сетапи</div>
          {tags.length === 0 && (
            <div className="mb-2 rounded-card-sm bg-surface shadow-card py-6 text-center text-[11.5px] text-text-faint">
              Ще немає тегів
            </div>
          )}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t.id}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-text-dim"
              >
                {t.name}
                {t.isCustom && (
                  <button onClick={() => removeTag(t.id)} className="text-rose">
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Новий тег"
              className="flex-1 rounded-input border border-dashed border-border bg-surface px-2.5 py-1.5 text-[12px] text-text-dim outline-none"
            />
            <button onClick={handleAddTag} className="rounded-input bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-text-dim">
              Додати
            </button>
          </div>
        </section>
      )}

      {section === "sessions" && (
        <section className="mb-4">
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-text-dim">Торгові сесії</div>
          {sessions.length === 0 && (
            <div className="mb-2 rounded-card-sm bg-surface shadow-card py-6 text-center text-[11.5px] text-text-faint">
              Ще немає сесій
            </div>
          )}
          <div className="space-y-1.5">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-card-sm bg-surface shadow-card px-3 py-2">
                <div>
                  <span className="text-[12.5px] font-medium text-text">{s.name}</span>
                  <span className="ml-2 font-mono text-[10px] text-text-faint">
                    {s.startTime}–{s.endTime}
                  </span>
                </div>
                {s.isCustom && (
                  <button onClick={() => removeSession(s.id)} className="text-[10px] text-rose">
                    видалити
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-card-sm border border-dashed border-border p-2.5">
            <input
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="Назва сесії"
              className="mb-1.5 w-full rounded-input border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-text outline-none"
            />
            <div className="flex gap-1.5">
              <input
                type="time"
                value={newSessionStart}
                onChange={(e) => setNewSessionStart(e.target.value)}
                className="flex-1 rounded-input border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-[12px] text-text outline-none"
              />
              <input
                type="time"
                value={newSessionEnd}
                onChange={(e) => setNewSessionEnd(e.target.value)}
                className="flex-1 rounded-input border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-[12px] text-text outline-none"
              />
              <button
                onClick={handleAddSession}
                className={cn("rounded-input bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg")}
              >
                Додати
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

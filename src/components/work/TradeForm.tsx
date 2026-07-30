"use client";

import { useMemo, useRef, useState } from "react";
import { NumberInput } from "@/components/ui/NumberInput";
import type { Trade, TradeDirection, TradeStatus } from "@/lib/journal-store";
import { useJournalConfigStore } from "@/lib/journal-config-store";
import { computeTradePnL } from "@/lib/trade-calculations";
import type { TradingAccountView } from "@/lib/trading-accounts";
import { cn } from "@/lib/cn";
import {
  TrendingUpIcon,
  CoinsIcon,
  RefreshIcon,
  CameraIcon,
  CalendarDateIcon,
  ClockIcon,
  WalletIcon,
} from "@/components/icons";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FormRow({
  icon,
  label,
  value,
  children,
  onToggle,
  expanded,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
  onToggle?: () => void;
  expanded?: boolean;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className={cn("relative flex w-full items-center gap-3 py-3.5 text-left", !onToggle && "cursor-default")}
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface text-text-dim">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-wide text-text-faint">{label}</span>
          <span className="block truncate text-[13.5px] font-medium text-text">{value}</span>
        </span>
        {onToggle && (
          <span className={cn("text-text-faint transition-transform", expanded && "rotate-90")}>›</span>
        )}
      </button>
      {expanded && <div className="pb-3.5">{children}</div>}
    </div>
  );
}

export function TradeForm({
  initialDateKey,
  editingTrade,
  accounts,
  defaultAccountId,
  onSave,
  onClose,
  onDelete,
}: {
  initialDateKey: string;
  editingTrade: Trade | null;
  accounts: TradingAccountView[];
  defaultAccountId: string | null;
  onSave: (data: Omit<Trade, "id">) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const { instruments, tags, sessions, addTag } = useJournalConfigStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const accountSelectRef = useRef<HTMLSelectElement>(null);
  const instrumentSelectRef = useRef<HTMLSelectElement>(null);
  const sessionSelectRef = useRef<HTMLSelectElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  const [accountId, setAccountId] = useState<string | null>(
    editingTrade?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? null
  );
  const [instrumentId, setInstrumentId] = useState(editingTrade?.instrumentId ?? instruments[0]?.id ?? "");
  const [direction, setDirection] = useState<TradeDirection>(editingTrade?.direction ?? "LONG");
  const [status, setStatus] = useState<TradeStatus>(editingTrade?.status ?? "closed");
  const [date, setDate] = useState(editingTrade?.date ?? initialDateKey);
  const [time, setTime] = useState(editingTrade?.time ?? "09:00");
  const [entry, setEntry] = useState(editingTrade?.entry ?? 0);
  const [stop, setStop] = useState(editingTrade?.stop ?? 0);
  const [take, setTake] = useState(editingTrade?.take ?? 0);
  const [lot, setLot] = useState(editingTrade?.lot ?? 0.1);
  const [closePrice, setClosePrice] = useState(editingTrade?.closePrice ?? 0);
  const [commission, setCommission] = useState(editingTrade?.commission ?? 0);
  const [swap, setSwap] = useState(editingTrade?.swap ?? 0);
  const [tagIds, setTagIds] = useState<string[]>(editingTrade?.tagIds ?? []);
  const [sessionId, setSessionId] = useState<string | null>(editingTrade?.sessionId ?? null);
  const [screenshots, setScreenshots] = useState<string[]>(editingTrade?.screenshots ?? []);
  const [newTagName, setNewTagName] = useState("");

  const [entryExpanded, setEntryExpanded] = useState(false);
  const [lotExpanded, setLotExpanded] = useState(false);
  const [costsExpanded, setCostsExpanded] = useState(false);
  const [dateExpanded, setDateExpanded] = useState(false);

  function toggleTag(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function handleAddCustomTag() {
    const name = newTagName.trim();
    if (!name) return;
    addTag(name);
    setNewTagName("");
    // Newly-added tag becomes the last entry in the store; select it once the store updates.
    queueMicrotask(() => {
      const latest = useJournalConfigStore.getState().tags;
      const created = latest[latest.length - 1];
      if (created) setTagIds((prev) => [...prev, created.id]);
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const encoded = await Promise.all(Array.from(files).map(fileToBase64));
    setScreenshots((prev) => [...prev, ...encoded]);
  }

  const instrument = instruments.find((i) => i.id === instrumentId);
  const session = sessions.find((s) => s.id === sessionId);
  const pnl = useMemo(() => {
    const draft: Trade = {
      id: editingTrade?.id ?? "draft",
      accountId,
      instrumentId,
      direction,
      status,
      date,
      time,
      entry,
      stop,
      take,
      lot,
      closePrice: status === "closed" ? closePrice : null,
      commission,
      swap,
      tagIds,
      sessionId,
      screenshots,
    };
    return computeTradePnL(draft, instrument);
  }, [
    editingTrade,
    accountId,
    instrumentId,
    direction,
    status,
    date,
    time,
    entry,
    stop,
    take,
    lot,
    closePrice,
    commission,
    swap,
    tagIds,
    sessionId,
    screenshots,
    instrument,
  ]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instrumentId) return;
    onSave({
      accountId,
      instrumentId,
      direction,
      status,
      date,
      time,
      entry,
      stop,
      take,
      lot,
      closePrice: status === "closed" ? closePrice : null,
      commission,
      swap,
      tagIds,
      sessionId,
      screenshots,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">
            {editingTrade ? "Редагувати угоду" : "Нова угода"}
          </div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          <div className="flex flex-1 rounded-btn bg-surface p-1">
            {(["LONG", "SHORT"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={cn(
                  "flex-1 rounded-btn py-2 text-center text-xs font-semibold",
                  direction === d ? "bg-surface-2 text-text" : "text-text-faint"
                )}
              >
                {d === "LONG" ? "Long" : "Short"}
              </button>
            ))}
          </div>
          <div className="flex flex-1 rounded-btn bg-surface p-1">
            {(["open", "closed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "flex-1 rounded-btn py-2 text-center text-xs font-semibold",
                  status === s ? "bg-surface-2 text-text" : "text-text-faint"
                )}
              >
                {s === "open" ? "Відкрита" : "Закрита"}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <FormRow
            icon={<WalletIcon className="h-4 w-4" />}
            label="Рахунок"
            value={
              <span className="relative">
                {accounts.find((a) => a.id === accountId)?.name ?? "Без рахунку"}
                <select
                  ref={accountSelectRef}
                  value={accountId ?? ""}
                  onChange={(e) => setAccountId(e.target.value || null)}
                  className="absolute inset-0 -m-3.5 cursor-pointer opacity-0"
                  style={{ width: "calc(100% + 44px)", height: "calc(100% + 28px)" }}
                >
                  {accounts.length === 0 && <option value="">Без рахунку</option>}
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </span>
            }
          />

          <FormRow
            icon={<TrendingUpIcon className="h-4 w-4" />}
            label="Інструмент"
            value={
              <span className="relative">
                {instrument?.symbol ?? "Обрати"}
                <select
                  ref={instrumentSelectRef}
                  value={instrumentId}
                  onChange={(e) => setInstrumentId(e.target.value)}
                  className="absolute inset-0 -m-3.5 cursor-pointer opacity-0"
                  style={{ width: "calc(100% + 44px)", height: "calc(100% + 28px)" }}
                >
                  {instruments.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.symbol}
                    </option>
                  ))}
                </select>
              </span>
            }
          />

          <FormRow
            icon={<CalendarDateIcon className="h-4 w-4" />}
            label="Дата / Час"
            value={`${date} · ${time}`}
            expanded={dateExpanded}
            onToggle={() => setDateExpanded((v) => !v)}
          >
            <div className="flex gap-2">
              <div className="relative flex flex-1 items-center gap-2 rounded-input border border-border bg-surface-2 px-3 py-2">
                <CalendarDateIcon className="h-3.5 w-3.5 text-text-faint" />
                <span className="font-mono text-[12px] text-text">{date}</span>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
              <div className="relative flex flex-1 items-center gap-2 rounded-input border border-border bg-surface-2 px-3 py-2">
                <ClockIcon className="h-3.5 w-3.5 text-text-faint" />
                <span className="font-mono text-[12px] text-text">{time}</span>
                <input
                  ref={timeInputRef}
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
            </div>
          </FormRow>

          <FormRow
            icon={<TrendingUpIcon className="h-4 w-4" />}
            label="Вхід / Стоп / Тейк"
            value={`${entry} · ${stop} · ${take}`}
            expanded={entryExpanded}
            onToggle={() => setEntryExpanded((v) => !v)}
          >
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="mb-1 block text-[9px] uppercase text-text-faint">Вхід</span>
                <NumberInput
                  value={entry}
                  onChange={setEntry}
                  className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[9px] uppercase text-text-faint">Стоп</span>
                <NumberInput
                  value={stop}
                  onChange={setStop}
                  className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[9px] uppercase text-text-faint">Тейк</span>
                <NumberInput
                  value={take}
                  onChange={setTake}
                  className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
                />
              </label>
            </div>
          </FormRow>

          <FormRow
            icon={<ClockIcon className="h-4 w-4" />}
            label="Лот / Ціна закриття"
            value={status === "open" ? `${lot} · відкрита` : `${lot} · ${closePrice}`}
            expanded={lotExpanded}
            onToggle={() => setLotExpanded((v) => !v)}
          >
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[9px] uppercase text-text-faint">Лот</span>
                <NumberInput
                  value={lot}
                  onChange={setLot}
                  className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
                />
              </label>
              <label className={cn("block", status === "open" && "opacity-40")}>
                <span className="mb-1 block text-[9px] uppercase text-text-faint">Ціна закриття</span>
                <NumberInput
                  value={closePrice}
                  onChange={setClosePrice}
                  className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
                />
              </label>
            </div>
          </FormRow>

          <FormRow
            icon={<CoinsIcon className="h-4 w-4" />}
            label="Комісія / Своп"
            value={`${commission.toFixed(2)} $ · ${swap.toFixed(2)} $`}
            expanded={costsExpanded}
            onToggle={() => setCostsExpanded((v) => !v)}
          >
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[9px] text-text-faint">
                  <CoinsIcon className="h-3 w-3" /> Комісія
                </span>
                <NumberInput
                  value={commission}
                  onChange={setCommission}
                  className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-clay outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[9px] text-text-faint">
                  <RefreshIcon className="h-3 w-3" /> Своп
                </span>
                <NumberInput
                  value={swap}
                  onChange={setSwap}
                  className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-clay outline-none"
                />
              </label>
            </div>
          </FormRow>

          <FormRow
            icon={<ClockIcon className="h-4 w-4" />}
            label="Сесія"
            value={
              <span className="relative">
                {session?.name ?? "Без сесії"}
                <select
                  ref={sessionSelectRef}
                  value={sessionId ?? ""}
                  onChange={(e) => setSessionId(e.target.value || null)}
                  className="absolute inset-0 -m-3.5 cursor-pointer opacity-0"
                  style={{ width: "calc(100% + 44px)", height: "calc(100% + 28px)" }}
                >
                  <option value="">Без сесії</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </span>
            }
          />

          <div className="py-3.5">
            <span className="mb-1.5 block text-[10.5px] font-semibold text-text-dim">Сетап / теги</span>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const active = tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10.5px] font-medium",
                      active ? "border-sage bg-sage/15 text-sage" : "border-border bg-surface text-text-dim"
                    )}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="+ свій тег"
                className="flex-1 rounded-full border border-dashed border-border bg-surface px-3 py-1.5 text-[10.5px] text-text-dim outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                className="rounded-full bg-surface-2 px-3 py-1.5 text-[10.5px] font-medium text-text-dim"
              >
                Додати
              </button>
            </div>
          </div>

          <div className="border-t border-border py-3.5">
            <span className="mb-1.5 block text-[10.5px] font-semibold text-text-dim">Скріншот графіка</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-1.5 rounded-card-sm border border-dashed border-border p-3.5 text-center text-[11px] text-text-faint"
            >
              <CameraIcon className="h-3.5 w-3.5" /> Додати скріншот входу/виходу
            </button>
            {screenshots.length > 0 && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto">
                {screenshots.map((src, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-14 w-14 rounded-card-sm object-cover" />
                    <button
                      type="button"
                      onClick={() => setScreenshots((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose text-[9px] text-bg"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-baseline justify-between border-t border-border py-3.5">
            <span className="text-[11.5px] text-text-dim">Чистий P&L</span>
            <span className="flex items-baseline gap-2">
              <span className={cn("font-mono text-[18px] font-bold", (pnl.net ?? 0) >= 0 ? "text-sage" : "text-rose")}>
                {pnl.net === null ? "—" : `${pnl.net > 0 ? "+" : ""}${pnl.net.toFixed(2)} $`}
              </span>
              <span className="font-mono text-[11px] text-text-faint">
                R:R {pnl.rrActual ?? pnl.rrPlanned}
              </span>
            </span>
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
          >
            Зберегти угоду
          </button>

          {editingTrade && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(editingTrade.id)}
              className="mt-2 w-full rounded-btn border border-rose/30 py-2.5 text-center text-[12.5px] font-semibold text-rose"
            >
              Видалити
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

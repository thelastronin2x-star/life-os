"use client";

import type { Trade } from "@/lib/journal-store";
import type { JournalInstrument, JournalSession, JournalTag } from "@/lib/journal-config-store";
import type { TradePnL } from "@/lib/trade-calculations";
import { cn } from "@/lib/cn";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Вручну",
  mt5: "MetaTrader 5",
  bybit: "Bybit",
  binance: "Binance",
  okx: "OKX",
};

function Row({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
      <span className="text-[12px] font-bold text-text-faint">{label}</span>
      <span
        className={cn(
          "font-mono text-[13px] font-extrabold tracking-tight",
          tone === "pos" && "text-sage",
          tone === "neg" && "text-clay",
          !tone && "text-text"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function formatMoment(ms: number | undefined, fallbackDate: string, fallbackTime: string): string {
  if (!ms) return `${fallbackDate} · ${fallbackTime}`;
  const d = new Date(ms);
  return `${d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" })} · ${d
    .toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDuration(from: number | undefined, to: number | undefined): string | null {
  if (!from || !to || to <= from) return null;
  const minutes = Math.round((to - from) / 60000);
  if (minutes < 60) return `${minutes} хв`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} год ${minutes % 60} хв`;
  return `${Math.floor(hours / 24)} д ${hours % 24} год`;
}

/** Everything known about one position, in one screen.
 *
 *  Split out from the edit form deliberately: opening a trade to look at it is
 *  a far more common act than opening it to change it, and a form full of
 *  inputs is a poor way to read. Fields the source never reported are omitted
 *  rather than shown empty — a blank "Плече" line implies the data exists and
 *  is zero, which for Binance (which doesn't report historical leverage at
 *  all) would be false. */
export function TradeDetailSheet({
  trade: t,
  instrument,
  pnl,
  currencySymbol,
  session,
  tags,
  onEdit,
  onClose,
}: {
  trade: Trade;
  instrument: JournalInstrument | undefined;
  pnl: TradePnL;
  currencySymbol: string;
  session?: JournalSession;
  tags: JournalTag[];
  onEdit: () => void;
  onClose: () => void;
}) {
  const m = t.meta;
  const net = pnl.net ?? 0;
  const isWin = net >= 0;
  const duration = formatDuration(m?.openedAt, m?.closedAt);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg p-3.5 pb-6 md:rounded-card">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border md:hidden" />
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[17px] font-extrabold tracking-tight text-text">
            {instrument?.symbol ?? t.sourceSymbol ?? "Угода"}
          </div>
          <button onClick={onClose} className="text-[13px] font-bold text-text-dim">
            Закрити
          </button>
        </div>

        <div className={cn("relative overflow-hidden rounded-card p-4", isWin ? "bg-sage-deep" : "bg-clay-deep")}>
          <div className={cn("text-[11.5px] font-extrabold", isWin ? "text-sage" : "text-clay")}>
            {t.direction === "LONG" ? "Long" : "Short"}
            {m?.leverage ? ` · ${m.leverage}×` : ""}
            {m?.marginMode ? ` · ${m.marginMode}` : ""}
          </div>
          <div
            className={cn(
              "mt-1 font-mono text-[30px] font-extrabold tracking-tight",
              isWin ? "text-sage" : "text-clay"
            )}
          >
            {net >= 0 ? "+" : ""}
            {net.toFixed(2)} {currencySymbol}
          </div>
          <div className={cn("mt-1 text-[12px] font-bold", isWin ? "text-sage" : "text-clay")}>
            {pnl.rMultiple !== null && `${pnl.rMultiple >= 0 ? "+" : "−"}${Math.abs(pnl.rMultiple).toFixed(2)}R`}
            {/* ROI on margin, not on notional — on a leveraged position the
                dollar figure alone can't say whether the trade was good. */}
            {m?.pnlRatio !== undefined && ` · ${(m.pnlRatio * 100).toFixed(1)}% до маржі`}
          </div>
        </div>

        <div className="card-raised mt-3 rounded-card bg-surface px-3.5">
          <Row label="Вхід" value={String(t.entry)} />
          <Row label="Вихід" value={t.closePrice != null ? String(t.closePrice) : "—"} />
          {t.stop > 0 && <Row label="Стоп" value={String(t.stop)} />}
          {t.take > 0 && <Row label="Тейк" value={String(t.take)} />}
          <Row label="Обсяг" value={String(t.lot)} />
          {m?.entryValue !== undefined && (
            <Row label="Обсяг у грошах" value={`${m.entryValue.toFixed(2)} ${currencySymbol}`} />
          )}
        </div>

        <div className="card-raised mt-3 rounded-card bg-surface px-3.5">
          <Row label="Відкрито" value={formatMoment(m?.openedAt, t.date, t.time)} />
          <Row label="Закрито" value={formatMoment(m?.closedAt, t.date, t.time)} />
          {duration && <Row label="Тривалість" value={duration} />}
          {m?.closeReason && <Row label="Як закрито" value={m.closeReason} />}
        </div>

        {(m?.fee !== undefined || m?.funding !== undefined || t.commission > 0 || t.swap !== 0) && (
          <div className="card-raised mt-3 rounded-card bg-surface px-3.5">
            {(m?.fee ?? t.commission) > 0 && (
              <Row label="Комісія" value={`−${(m?.fee ?? t.commission).toFixed(2)} ${currencySymbol}`} tone="neg" />
            )}
            {m?.funding !== undefined && m.funding !== 0 && (
              <Row
                label="Фандинг"
                value={`${m.funding >= 0 ? "+" : ""}${m.funding.toFixed(2)} ${currencySymbol}`}
                tone={m.funding >= 0 ? "pos" : "neg"}
              />
            )}
            {m?.funding === undefined && t.swap !== 0 && (
              <Row
                label="Своп"
                value={`${t.swap >= 0 ? "+" : ""}${t.swap.toFixed(2)} ${currencySymbol}`}
                tone={t.swap >= 0 ? "pos" : "neg"}
              />
            )}
          </div>
        )}

        <div className="card-raised mt-3 rounded-card bg-surface px-3.5">
          <Row label="Джерело" value={SOURCE_LABEL[t.source ?? "manual"] ?? t.source ?? "—"} />
          {t.sourceSymbol && t.sourceSymbol !== instrument?.symbol && (
            <Row label="Символ біржі" value={t.sourceSymbol} />
          )}
          {session && <Row label="Сесія" value={session.name} />}
          <Row
            label="За планом"
            value={t.followedPlan === true ? "Так" : t.followedPlan === false ? "Порушив" : "Не вказано"}
            tone={t.followedPlan === true ? "pos" : t.followedPlan === false ? "neg" : undefined}
          />
        </div>

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag.id} className="rounded-btn bg-sky-soft px-3 py-1.5 text-[11.5px] font-extrabold text-sky">
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {t.notes && (
          <div className="card-raised mt-3 rounded-card bg-surface p-3.5">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-text-faint">
              Логіка входу / нотатки
            </div>
            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-text">{t.notes}</p>
          </div>
        )}

        <button
          onClick={onEdit}
          className="mt-4 w-full rounded-btn bg-text py-3.5 text-center text-[14px] font-extrabold text-bg"
        >
          Редагувати
        </button>
      </div>
    </div>
  );
}

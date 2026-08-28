"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEconomicCalendar } from "@/lib/use-economic-calendar";
import { getDemoHistory } from "@/lib/economic-calendar-data";
import { useJournalStore } from "@/lib/journal-store";
import { useJournalConfigStore } from "@/lib/journal-config-store";
import { useTraderOnlyGuard } from "@/lib/use-trader-guard";
import { cn } from "@/lib/cn";

const IMPACT_LABEL: Record<1 | 2 | 3, string> = { 1: "low impact", 2: "medium impact", 3: "high impact" };

export default function EconomicEventDetailPage() {
  const isTrader = useTraderOnlyGuard();
  const params = useParams<{ id: string }>();
  const { events, status } = useEconomicCalendar();
  const { trades } = useJournalStore();
  const { instruments } = useJournalConfigStore();

  const event = events.find((e) => e.id === params.id);
  const history = event ? getDemoHistory(event.name) : null;

  const assistantText = (() => {
    if (!event) return "";
    const openOnCurrency = trades.some((t) => {
      if (t.status !== "open") return false;
      const symbol = instruments.find((i) => i.id === t.instrumentId)?.symbol ?? "";
      return symbol.toUpperCase().includes(event.currency);
    });
    const base =
      event.impact === 3
        ? `Очікується підвищена волатильність на ${event.currency}-парах довкола цього релізу.`
        : `Помірний вплив на ${event.currency}-пари — рух зазвичай короткостроковий.`;
    return openOnCurrency
      ? `${base} У тебе є відкрита позиція, пов'язана з ${event.currency} — розглянь коригування розміру перед релізом.`
      : base;
  })();

  if (!isTrader) return null;

  return (
    <div>
      <Link href="/work/economic-calendar" className="mb-2 flex items-center gap-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">
          ‹
        </span>
        Економічний календар
      </Link>

      {status === "loading" && (
        <div className="py-8 text-center text-[11.5px] text-text-faint">Завантаження…</div>
      )}

      {status !== "loading" && !event && (
        <div className="card-raised rounded-card-sm bg-surface py-8 text-center text-[11.5px] text-text-faint">
          Подію не знайдено — можливо, тиждень уже змінився
        </div>
      )}

      {event && (
        <>
          <div className="pb-4 pt-1">
            <div className="mb-2 text-[22px]">{event.flag}</div>
            <div className="mb-1 font-heading text-lg font-semibold text-text">{event.name}</div>
            <div className="text-[11.5px] text-text-faint">
              {event.date} · {event.time} · {IMPACT_LABEL[event.impact]}
            </div>
          </div>

          <div className="mb-6 flex gap-6">
            <div>
              <div className="mb-1.5 text-[9.5px] uppercase tracking-wide text-text-faint">Попередня</div>
              <div className="font-mono text-[22px] font-bold text-text">{event.previous}</div>
            </div>
            <div>
              <div className="mb-1.5 text-[9.5px] uppercase tracking-wide text-text-faint">Прогноз</div>
              <div className="font-mono text-[22px] font-bold text-sky">{event.forecast}</div>
            </div>
            <div>
              <div className="mb-1.5 text-[9.5px] uppercase tracking-wide text-text-faint">Факт</div>
              <div className="font-mono text-[22px] font-bold text-text-faint">{event.actual ?? "—"}</div>
            </div>
          </div>

          {history && (
            <>
              <div className="mb-4 text-[10.5px] font-semibold uppercase tracking-wide text-text-dim">
                Прогноз vs факт — останні релізи
              </div>
              <div className="mb-1.5 flex h-[110px] items-end gap-3">
                {history.map((p, i) => {
                  const maxVal = Math.max(...history.map((x) => Math.max(x.actual, x.forecast)), 1);
                  const beat = p.actual >= p.forecast;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex h-[90px] w-full items-end justify-center gap-1">
                        <div
                          className="w-2 rounded-t-[3px] bg-surface-2"
                          style={{ height: `${(p.forecast / maxVal) * 100}%` }}
                        />
                        <div
                          className={cn("w-2 rounded-t-[3px]", beat ? "bg-sage" : "bg-rose")}
                          style={{ height: `${(p.actual / maxVal) * 100}%` }}
                        />
                      </div>
                      <div className="text-[8.5px] text-text-faint">{p.label}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mb-6 flex justify-center gap-4">
                <div className="flex items-center gap-1.5 text-[10px] text-text-dim">
                  <span className="h-2 w-2 rounded-[2px] bg-surface-2" /> Прогноз
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-text-dim">
                  <span className="h-2 w-2 rounded-[2px] bg-sage" /> Перевищено
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-text-dim">
                  <span className="h-2 w-2 rounded-[2px] bg-rose" /> Не досягнуто
                </div>
              </div>
              <div className="mb-4 text-[9.5px] text-text-faint">
                Демо-дані для ілюстрації — реальна історія релізів ще не підключена
              </div>
            </>
          )}

          <div className="border-t border-border pt-3.5">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-sage">Асистент</div>
            <div className="text-[12.5px] leading-relaxed text-text-dim">{assistantText}</div>
          </div>
        </>
      )}
    </div>
  );
}

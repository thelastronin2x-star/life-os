"use client";

import Link from "next/link";
import { useAdviceStore, type AdviceOutcome } from "@/lib/advice-store";
import { cn } from "@/lib/cn";

const OUTCOME_LABEL: Record<AdviceOutcome, string> = {
  worked: "Спрацювало",
  not_worked: "Не спрацювало",
  insufficient_data: "Замало даних для висновку",
  not_measurable: "Ефект не відстежується",
};

const OUTCOME_COLOR: Record<AdviceOutcome, string> = {
  worked: "bg-sage-soft text-sage",
  not_worked: "bg-rose-soft text-rose",
  insufficient_data: "bg-surface-2 text-text-faint",
  not_measurable: "bg-surface-2 text-text-faint",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
}

/** Both sections read straight off useAdviceStore — no examples, no
 *  placeholder rows. An empty list renders as an honest empty state instead
 *  of a fabricated sample, same principle as every correlation card
 *  elsewhere in the app (see ASSISTANT_BASE_PROMPT's "never invent"
 *  guardrail). */
export default function AssistantMemoryPage() {
  const records = useAdviceStore((s) => s.records);
  const executed = records.filter((r) => r.userAction === "accepted");

  return (
    <div>
      <div className="pb-3.5 pt-2">
        <Link href="/assistant" className="mb-2 flex items-center gap-2 text-[12.5px] text-text-dim">
          <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">
            ‹
          </span>
          Асистент
        </Link>
        <div className="font-heading text-lg font-semibold text-text">Пам&apos;ять асистента</div>
        <div className="mt-0.5 text-[11.5px] text-text-faint">Реальні ситуації й дії, без прикладів</div>
      </div>

      <div className="mb-2.5 mt-[18px] text-[11px] font-bold uppercase tracking-wide text-text-faint first:mt-0">
        Пов&apos;язані ситуації
      </div>
      {records.length === 0 ? (
        <div className="card-raised rounded-card-sm bg-surface py-8 text-center text-[11.5px] text-text-faint">
          Ще не було жодної ситуації з конкретними варіантами дій
        </div>
      ) : (
        records.map((r) => (
          <div key={r.id} className="card-raised mb-2.5 rounded-card-sm bg-surface p-3.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] text-text-faint">{formatDate(r.date)}</span>
              <span
                className={cn(
                  "rounded-btn px-2 py-0.5 text-[9.5px] font-semibold",
                  r.outcomeResult ? OUTCOME_COLOR[r.outcomeResult] : "bg-surface-2 text-text-faint"
                )}
              >
                {r.userAction === "shown" ? "Показано повну картину" : r.outcomeResult ? OUTCOME_LABEL[r.outcomeResult] : "Очікує перевірки"}
              </span>
            </div>
            <div className="text-[12.5px] leading-relaxed text-text">{r.summary}</div>
          </div>
        ))
      )}

      <div className="mb-2.5 mt-[18px] text-[11px] font-bold uppercase tracking-wide text-text-faint">
        Що асистент вже зробив сам
      </div>
      {executed.length === 0 ? (
        <div className="card-raised rounded-card-sm bg-surface py-8 text-center text-[11.5px] text-text-faint">
          Асистент ще не виконував дій через діалоговий режим
        </div>
      ) : (
        executed.map((r) => (
          <div key={r.id} className="card-raised mb-2.5 rounded-card-sm bg-surface p-3.5">
            <div className="mb-1 text-[10px] text-text-faint">{formatDate(r.date)}</div>
            <div className="text-[12.5px] leading-relaxed text-text">{r.summary}</div>
          </div>
        ))
      )}
    </div>
  );
}

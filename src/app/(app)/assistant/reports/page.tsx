"use client";

import Link from "next/link";
import { useState } from "react";
import { useAssistantStore } from "@/lib/assistant-store";
import { cn } from "@/lib/cn";

export default function AssistantReportsPage() {
  const reports = useAssistantStore((s) => s.reports);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <div className="pb-3.5 pt-2">
        <Link href="/assistant" className="mb-2 flex items-center gap-2 text-[12.5px] text-text-dim">
          <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">
            ‹
          </span>
          Асистент
        </Link>
        <div className="font-heading text-lg font-semibold text-text">Історія звітів</div>
        <div className="mt-0.5 text-[11.5px] text-text-faint">
          Автоматичні тижневі й місячні звіти
        </div>
      </div>

      {reports.length === 0 && (
        <div className="card-raised rounded-card-sm bg-surface py-8 text-center text-[11.5px] text-text-faint">
          Звітів ще немає — з&apos;являться автоматично щотижня/щомісяця, або натисни
          «Звіт зараз» у чаті асистента
        </div>
      )}

      {reports.map((r) => {
        const expanded = expandedId === r.id;
        return (
          <button
            key={r.id}
            onClick={() => setExpandedId(expanded ? null : r.id)}
            className="card-raised mb-2.5 block w-full rounded-card-sm bg-surface p-3.5 text-left"
          >
            <div className="mb-1 flex items-center justify-between">
              <span
                className={cn(
                  "rounded-btn px-2 py-0.5 text-[9.5px] font-semibold",
                  r.type === "weekly" ? "bg-sky-soft text-sky" : "bg-gold-soft text-gold"
                )}
              >
                {r.type === "weekly" ? "Тижневий" : "Місячний"}
              </span>
              <span className="text-[10px] text-text-faint">{r.periodLabel}</span>
            </div>
            <div
              className={cn(
                "whitespace-pre-wrap text-[12.5px] leading-relaxed text-text",
                !expanded && "line-clamp-2"
              )}
            >
              {r.text}
            </div>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFinanceStore } from "@/lib/finance-store";
import { useCalendarStore } from "@/lib/calendar-store";
import { useHealthStore } from "@/lib/health-store";
import { useVoiceDraftStore } from "@/lib/voice-draft-store";
import { formatDateKey } from "@/lib/calendar-utils";
import type { VoiceClassifyResult, VoiceSection } from "@/lib/voice-classify-types";
import { WalletIcon, CalendarDateIcon, TrendingUpIcon, DropletIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const SECTION_LABEL: Record<VoiceSection, string> = {
  finance: "Фінанси",
  work: "Робота",
  calendar: "Календар",
  health: "Здоров'я",
};

const SECTION_ICON: Record<VoiceSection, typeof WalletIcon> = {
  finance: WalletIcon,
  work: TrendingUpIcon,
  calendar: CalendarDateIcon,
  health: DropletIcon,
};

function fieldRows(result: VoiceClassifyResult): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (result.section === "finance") {
    if (result.categoryName) rows.push({ label: "Категорія", value: result.categoryName });
    if (result.amount !== undefined) rows.push({ label: "Сума", value: `${result.amount}` });
  } else if (result.section === "work") {
    if (result.instrumentSymbol) rows.push({ label: "Інструмент", value: result.instrumentSymbol });
    if (result.direction) rows.push({ label: "Напрямок", value: result.direction === "LONG" ? "Лонг" : "Шорт" });
  } else if (result.section === "calendar") {
    if (result.date) rows.push({ label: "Дата", value: result.date });
    if (result.time) rows.push({ label: "Час", value: result.time });
  } else if (result.section === "health") {
    if (result.healthValue !== undefined) rows.push({ label: "Вода", value: `${result.healthValue} мл` });
  }
  return rows;
}

/** Bottom sheet shown after voice classification — mirrors every other
 *  sheet's fixed-overlay shape in the app (see MacroEventDetailSheet), not
 *  the mockup's bespoke slide animation, for the same reason the AI
 *  Аналітика info sheets do: one shared shell beats one-off CSS per sheet.
 *
 *  "Зберегти" only exists where a one-tap save is honest: a trade needs
 *  entry/stop/take the user never said out loud, so `work` skips straight
 *  to "Виправити" instead of pretending a quick-save is possible. */
export function VoiceResultSheet({
  heard,
  result,
  onClose,
}: {
  heard: string;
  result: VoiceClassifyResult;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const setPendingDraft = useVoiceDraftStore((s) => s.setPendingDraft);

  const accounts = useFinanceStore((s) => s.accounts);
  const budgetCategories = useFinanceStore((s) => s.budgetCategories);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const addCalendarItem = useCalendarStore((s) => s.addItem);
  const addWater = useHealthStore((s) => s.addWater);

  const Icon = SECTION_ICON[result.section];
  const rows = fieldRows(result);
  const canQuickSave = result.section !== "work";

  function goCorrect() {
    setPendingDraft(result);
    onClose();
    const path = result.section === "finance" ? "/balance" : result.section === "work" ? "/work/journal" : result.section === "calendar" ? "/calendar" : "/health";
    router.push(`${path}?action=voice`);
  }

  function handleQuickSave() {
    if (result.section === "finance") {
      const category = result.categoryName
        ? budgetCategories.find((c) => c.name.toLowerCase().includes(result.categoryName!.toLowerCase()))
        : undefined;
      addTransaction({
        type: "expense",
        title: result.title,
        amount: result.amount ?? 0,
        categoryId: category?.id ?? budgetCategories[0]?.id ?? null,
        accountId: accounts[0]?.id ?? "",
        date: result.date ?? formatDateKey(new Date()),
      });
    } else if (result.section === "calendar") {
      addCalendarItem({
        kind: "event",
        title: result.title,
        date: result.date ?? formatDateKey(new Date()),
        time: result.time,
        category: "personal",
        reminder: "10min",
        recurrence: null,
      });
    } else if (result.section === "health") {
      addWater(result.healthValue ?? 250);
    }
    setSaved(true);
    setTimeout(onClose, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-card bg-bg p-5 shadow-card md:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-faint">Почув:</div>
        <div className="mb-4 text-[14px] font-medium italic leading-relaxed text-text-dim">&quot;{heard}&quot;</div>

        {saved ? (
          <div className="card-raised rounded-card bg-sage-soft p-4 text-center text-[13px] font-bold text-sage">
            Збережено ✓
          </div>
        ) : (
          <>
            <div className="well-pressed mb-2.5 flex items-center gap-3 rounded-card bg-surface p-3.5">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface-2 text-sage">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[9.5px] font-bold uppercase tracking-wide text-text-faint">Розділ</div>
                <div className="mt-0.5 truncate text-[13px] font-semibold text-text">
                  {SECTION_LABEL[result.section]} · {result.title}
                </div>
              </div>
            </div>

            {rows.length > 0 && (
              <div className="well-pressed mb-4 rounded-card bg-surface p-3.5">
                {rows.map((row, i) => (
                  <div
                    key={row.label}
                    className={cn("flex items-center justify-between py-1.5", i < rows.length - 1 && "border-b border-border")}
                  >
                    <span className="text-[11.5px] text-text-faint">{row.label}</span>
                    <span className="text-[12.5px] font-semibold text-text">{row.value}</span>
                  </div>
                ))}
              </div>
            )}

            {result.confidence < 0.55 && (
              <div className="mb-4 text-[11px] leading-relaxed text-gold">
                Не зовсім впевнений, куди це віднести — перевір розділ перед збереженням.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={goCorrect}
                className="well-pressed flex-1 rounded-btn bg-surface py-3 text-center text-[12.5px] font-bold text-text-dim"
              >
                Виправити
              </button>
              {canQuickSave && (
                <button
                  onClick={handleQuickSave}
                  className="flex-1 rounded-btn bg-sage py-3 text-center text-[12.5px] font-bold text-bg"
                >
                  Зберегти ✓
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

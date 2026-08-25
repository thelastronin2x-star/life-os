"use client";

import Link from "next/link";
import { useAppStore, type HomeWidgetId } from "@/lib/store";
import { ChatBubbleIcon, CalendarDateIcon, WalletIcon, TrendingUpIcon, NotebookIcon, ConstructionIcon, PlusIcon } from "@/components/icons";
import type { ReactNode } from "react";

const WIDGET_META: Record<HomeWidgetId, { title: string; icon: ReactNode; color: "sage" | "clay" | "gold" | "sky" | "rose" }> = {
  "ai-card": { title: "AI-картка", icon: <ChatBubbleIcon className="h-5 w-5" />, color: "gold" },
  today: { title: "Сьогодні", icon: <CalendarDateIcon className="h-5 w-5" />, color: "sky" },
  "week-balance": { title: "Баланс тижня", icon: <WalletIcon className="h-5 w-5" />, color: "clay" },
  weather: { title: "Прогноз погоди", icon: <span className="text-[20px] leading-none">☀️</span>, color: "sky" },
  "equity-curve": { title: "Крива капіталу", icon: <TrendingUpIcon className="h-5 w-5" />, color: "sage" },
  "journal-link": { title: "Журнал угод", icon: <NotebookIcon className="h-5 w-5" />, color: "sage" },
  "it-work": { title: "IT-профіль", icon: <ConstructionIcon className="h-5 w-5" />, color: "sky" },
};

export default function HomeAddWidgetPage() {
  const profile = useAppStore((s) => s.profile);
  const homeWidgets = useAppStore((s) => s.homeWidgets);
  const addHomeWidget = useAppStore((s) => s.addHomeWidget);

  // Weather is in both lists — it's the one widget that has nothing to do
  // with which profession the user picked.
  const relevantIds: HomeWidgetId[] =
    profile === "trader"
      ? ["ai-card", "today", "week-balance", "weather", "equity-curve", "journal-link"]
      : ["ai-card", "today", "week-balance", "weather", "it-work"];

  const hidden = homeWidgets.filter((w) => relevantIds.includes(w.id) && !w.visible);

  return (
    <div>
      <Link href="/" className="mb-2 flex items-center gap-2 pt-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">
          ‹
        </span>
        Готово
      </Link>
      <div className="mb-4 pt-2 font-heading text-lg font-semibold text-text">Додати віджет</div>

      {hidden.length === 0 ? (
        <div className="rounded-card-sm bg-surface shadow-card py-8 text-center text-[11.5px] text-text-faint">
          Усі віджети вже додано на Головну
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {hidden.map((w) => {
            const meta = WIDGET_META[w.id];
            return (
              <div key={w.id} className="relative rounded-card-sm bg-surface shadow-card p-3.5">
                <div className="mb-2.5 text-[12px] font-bold text-text">{meta.title}</div>
                <div
                  className="flex h-[52px] items-center justify-center rounded-icon"
                  style={{ background: `var(--${meta.color}-soft)`, color: `var(--${meta.color})` }}
                >
                  {meta.icon}
                </div>
                <button
                  onClick={() => addHomeWidget(w.id)}
                  className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-sage text-bg"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

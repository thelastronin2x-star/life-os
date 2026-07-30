"use client";

import { AICard } from "./AICard";
import { useAppStore, useHasHydrated } from "@/lib/store";
import { useAssistantStore, type InsightSource } from "@/lib/assistant-store";
import { useCalendarInsightSync, useFinanceInsightSync, useWorkInsightSync } from "@/lib/use-source-insight-sync";

const SOURCE_LABEL: Record<InsightSource, string> = {
  calendar: "з Календаря",
  finance: "з Балансу",
  work: "з Роботи",
};

/**
 * Shows whichever of the three source insights (calendar/finance/work) was
 * generated most recently — it doesn't generate a combined insight of its
 * own. Mounting the three sync hooks here (in addition to their own
 * screens) means a source can freshen even for someone who only ever opens
 * Home and never visits Calendar/Робота directly.
 */
export function HomeInsightCard() {
  const hydrated = useHasHydrated();
  const profile = useAppStore((s) => s.profile);
  const { contextInsights } = useAssistantStore();

  useCalendarInsightSync();
  useWorkInsightSync(profile);
  useFinanceInsightSync();

  if (!hydrated) return <AICard text="Готую інсайт…" />;

  const entries = (Object.entries(contextInsights) as [InsightSource, (typeof contextInsights)[InsightSource]][])
    .filter((entry): entry is [InsightSource, NonNullable<(typeof contextInsights)[InsightSource]>] => !!entry[1])
    .sort((a, b) => new Date(b[1].generatedAt).getTime() - new Date(a[1].generatedAt).getTime());

  const freshest = entries[0];

  if (!freshest) return <AICard text="Асистент ще збирає дані для інсайтів…" />;

  const [source, insight] = freshest;
  return <AICard text={insight.text} sub={SOURCE_LABEL[source]} />;
}

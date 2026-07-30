"use client";

import { useAssistantStore, type ReportType } from "./assistant-store";

export type { ReportType };
import { buildReportContext, callAssistantOnce } from "./assistant-context";
import { formatDateKey } from "./calendar-utils";
import type { Profile } from "./store";

const REPORT_PROMPTS: Record<ReportType, string> = {
  weekly:
    "Згенеруй короткий тижневий звіт користувачу на основі контексту нижче. Формат: короткий вступ (1 речення), 2-3 ключові спостереження з цифрами, один практичний висновок/порада. Без зайвої води — має читатися за 15-20 секунд.",
  monthly:
    "Згенеруй короткий місячний звіт користувачу на основі контексту нижче. Формат: короткий вступ (1 речення), 2-3 ключові спостереження з цифрами, один практичний висновок/порада. Без зайвої води — має читатися за 15-20 секунд.",
};

const PERIOD_DAYS: Record<ReportType, number> = { weekly: 7, monthly: 30 };
const PERIOD_LABEL: Record<ReportType, string> = { weekly: "Тиждень", monthly: "Місяць" };

export function shouldGenerateWeekly(lastDate: string | null): boolean {
  if (!lastDate) return true;
  return Date.now() - new Date(lastDate).getTime() >= 7 * 24 * 60 * 60 * 1000;
}

export function shouldGenerateMonthly(lastDate: string | null): boolean {
  if (!lastDate) return true;
  const last = new Date(lastDate);
  const now = new Date();
  return last.getFullYear() !== now.getFullYear() || last.getMonth() !== now.getMonth();
}

export async function generateReport(type: ReportType, profile: Profile): Promise<string> {
  const context = buildReportContext(profile, PERIOD_DAYS[type]);
  const text = await callAssistantOnce(REPORT_PROMPTS[type], context, "report");

  const todayIso = new Date().toISOString();
  const { addReport, setLastWeeklyReportAt, setLastMonthlyReportAt } = useAssistantStore.getState();

  addReport({
    type,
    periodLabel: `${PERIOD_LABEL[type]} · ${formatDateKey(new Date())}`,
    date: todayIso,
    text,
  });

  if (type === "weekly") setLastWeeklyReportAt(todayIso);
  else setLastMonthlyReportAt(todayIso);

  return text;
}

export async function checkAndGenerateAutoReports(profile: Profile): Promise<void> {
  const { lastWeeklyReportAt, lastMonthlyReportAt } = useAssistantStore.getState();

  if (shouldGenerateWeekly(lastWeeklyReportAt)) {
    await generateReport("weekly", profile).catch(() => undefined);
  }
  if (shouldGenerateMonthly(lastMonthlyReportAt)) {
    await generateReport("monthly", profile).catch(() => undefined);
  }
}

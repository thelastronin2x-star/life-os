import type { Insight } from "@/components/ui/AIInsightCard";

/** Already-computed pillar values, not raw store data — this module only
 *  looks for logical contradictions BETWEEN pillars (e.g. saving well but
 *  no safety net), not time-series correlations like health-insights.ts/
 *  the old finance-insights.ts did. A single MonthlyCheckIn a month is far
 *  too sparse a series for that kind of analysis to mean anything. */
export interface FinancePillars {
  savingsRate: number;
  emergencyFundMonths: number;
  investmentPct: number;
  hasInvestments: boolean;
  debtToIncome: number;
}

export function computeFinanceInsights(pillars: FinancePillars): Insight[] {
  const insights: Insight[] = [];

  if (pillars.savingsRate >= 0.2 && pillars.emergencyFundMonths < 1) {
    insights.push({
      id: "saving-well-no-cushion",
      text: `Заощаджуєш ${Math.round(pillars.savingsRate * 100)}% доходу — це чудово, але подушка безпеки лише ${pillars.emergencyFundMonths.toFixed(1)} міс. Варто напрямити частину заощаджень туди, перш ніж в інвестиції.`,
      color: "var(--gold)",
      sources: ["Норма заощаджень", "Подушка безпеки"],
    });
  }

  if (pillars.emergencyFundMonths >= 6 && !pillars.hasInvestments) {
    insights.push({
      id: "cushion-oversized",
      text: "Подушка безпеки вже перевищує рекомендовані 6 місяців — надлишок варто розглянути для інвестицій, а не тримати в готівці.",
      color: "var(--sky)",
      sources: ["Подушка безпеки", "Інвестиції"],
    });
  }

  if (pillars.debtToIncome > 0.36 && pillars.savingsRate < 0.1) {
    insights.push({
      id: "debt-vs-savings-priority",
      text: `Борги забирають ${Math.round(pillars.debtToIncome * 100)}% доходу, а заощаджується лише ${Math.round(pillars.savingsRate * 100)}% — пріоритет варто віддати скороченню боргу.`,
      color: "var(--clay)",
      sources: ["Борги", "Норма заощаджень"],
    });
  }

  return insights.slice(0, 2);
}

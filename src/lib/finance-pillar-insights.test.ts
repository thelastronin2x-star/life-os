import { describe, expect, it } from "vitest";
import { computeFinanceInsights, type FinancePillars } from "./finance-pillar-insights";

function pillars(overrides: Partial<FinancePillars> = {}): FinancePillars {
  return {
    savingsRate: 0,
    emergencyFundMonths: 3,
    investmentPct: 0.3,
    hasInvestments: true,
    debtToIncome: 0,
    ...overrides,
  };
}

describe("computeFinanceInsights", () => {
  it("returns nothing when nothing contradicts", () => {
    expect(computeFinanceInsights(pillars())).toEqual([]);
  });

  it("flags saving well with no safety net", () => {
    const insights = computeFinanceInsights(pillars({ savingsRate: 0.25, emergencyFundMonths: 0.5 }));
    expect(insights.some((i) => i.id === "saving-well-no-cushion")).toBe(true);
  });

  it("does not flag saving well once the cushion is adequate", () => {
    const insights = computeFinanceInsights(pillars({ savingsRate: 0.25, emergencyFundMonths: 3 }));
    expect(insights.some((i) => i.id === "saving-well-no-cushion")).toBe(false);
  });

  it("flags an oversized cushion with no investments", () => {
    const insights = computeFinanceInsights(pillars({ emergencyFundMonths: 7, hasInvestments: false }));
    expect(insights.some((i) => i.id === "cushion-oversized")).toBe(true);
  });

  it("does not flag an oversized cushion once there are investments", () => {
    const insights = computeFinanceInsights(pillars({ emergencyFundMonths: 7, hasInvestments: true }));
    expect(insights.some((i) => i.id === "cushion-oversized")).toBe(false);
  });

  it("flags heavy debt with low savings", () => {
    const insights = computeFinanceInsights(pillars({ debtToIncome: 0.4, savingsRate: 0.05 }));
    expect(insights.some((i) => i.id === "debt-vs-savings-priority")).toBe(true);
  });

  it("caps at 2 insights when multiple checks qualify at once", () => {
    // emergencyFundMonths>=6 + no investments (check 2) together with heavy
    // debt + low savings (check 3) — the only pair of checks whose
    // conditions aren't mutually exclusive with each other.
    const insights = computeFinanceInsights(
      pillars({ emergencyFundMonths: 7, hasInvestments: false, debtToIncome: 0.4, savingsRate: 0.05 })
    );
    expect(insights).toHaveLength(2);
  });
});

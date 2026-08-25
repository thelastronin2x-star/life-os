import { describe, expect, it } from "vitest";
import {
  computeEmergencyFundMonths,
  emergencyFundStatus,
  savingsRateStatus,
  computeDebtToIncome,
  debtStatus,
  investmentStatus,
  emergencyFundShortfall,
  debtPayoffMonths,
  investmentRebalanceAmount,
} from "./financial-health";

describe("emergency fund", () => {
  it("computes months of runway", () => {
    expect(computeEmergencyFundMonths(15000, 5000)).toBe(3);
  });
  it("returns 0 when there's no expense baseline", () => {
    expect(computeEmergencyFundMonths(15000, 0)).toBe(0);
  });
  it.each([
    [3, "good"],
    [6, "good"],
    [1, "warn"],
    [2.9, "warn"],
    [0.5, "bad"],
    [0, "bad"],
  ])("classifies %s months as %s", (months, status) => {
    expect(emergencyFundStatus(months as number)).toBe(status);
  });
});

describe("savingsRateStatus", () => {
  it.each([
    [0.2, "good"],
    [0.5, "good"],
    [0.1, "warn"],
    [0.19, "warn"],
    [0.05, "bad"],
    [-0.1, "bad"],
  ])("classifies rate %s as %s", (rate, status) => {
    expect(savingsRateStatus(rate as number)).toBe(status);
  });
});

describe("debt-to-income", () => {
  it("computes the ratio", () => {
    expect(computeDebtToIncome(3000, 20000)).toBe(0.15);
  });
  it("returns 0 with no income", () => {
    expect(computeDebtToIncome(3000, 0)).toBe(0);
  });
  it.each([
    [0.15, "good"],
    [0, "good"],
    [0.2, "warn"],
    [0.36, "warn"],
    [0.37, "bad"],
    [0.9, "bad"],
  ])("classifies ratio %s as %s", (ratio, status) => {
    expect(debtStatus(ratio as number)).toBe(status);
  });
});

describe("investmentStatus", () => {
  it("is bad with no investments regardless of pct", () => {
    expect(investmentStatus(false, 0)).toBe("bad");
  });
  it("is good above 20%", () => {
    expect(investmentStatus(true, 0.25)).toBe("good");
  });
  it("is warn at or below 20% but present", () => {
    expect(investmentStatus(true, 0.2)).toBe("warn");
    expect(investmentStatus(true, 0.01)).toBe("warn");
  });
});

describe("emergencyFundShortfall", () => {
  it("returns null once the 3-month goal is already met", () => {
    expect(emergencyFundShortfall(3, 5000, 15000)).toBeNull();
    expect(emergencyFundShortfall(4, 5000, 20000)).toBeNull();
  });
  it("returns null with no expense baseline", () => {
    expect(emergencyFundShortfall(0, 0, 1000)).toBeNull();
  });
  it("computes the shortfall and months-to-goal at 10%/month saving pace", () => {
    // 3 * 5000 - 10000 = 5000 shortfall; 5000 / (5000*0.1) = 10 months
    const result = emergencyFundShortfall(2, 5000, 10000);
    expect(result).toEqual({ shortfall: 5000, monthsToGoal: 10 });
  });
});

describe("debtPayoffMonths", () => {
  it("computes months to payoff, rounded up", () => {
    expect(debtPayoffMonths(10000, 4000)).toBe(3); // 2.5 -> 3
  });
  it("returns null for a zero payment", () => {
    expect(debtPayoffMonths(10000, 0)).toBeNull();
  });
});

describe("investmentRebalanceAmount", () => {
  it("computes the amount to move to reach 20%", () => {
    // pool = 20000, target = 4000, currently 0 invested -> move 4000
    expect(investmentRebalanceAmount(0, 20000)).toBe(4000);
  });
  it("returns 0 once already at or above 20%", () => {
    expect(investmentRebalanceAmount(5000, 15000)).toBe(0); // 25%
    expect(investmentRebalanceAmount(4000, 16000)).toBe(0); // exactly 20%
  });
  it("returns 0 with an empty pool", () => {
    expect(investmentRebalanceAmount(0, 0)).toBe(0);
  });
});

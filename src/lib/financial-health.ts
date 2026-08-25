/** Pure threshold/status functions for the 7 financial-health cards —
 *  deliberately not tied to any store shape, so each is trivially testable
 *  and the "what counts as good/warn/bad" thresholds live in exactly one
 *  place each, matching the values given in finance-manual-data-prompt.md. */

export type FinancialStatus = "good" | "warn" | "bad";

export function computeEmergencyFundMonths(liquidSavings: number, avgMonthlyExpenses: number): number {
  return avgMonthlyExpenses > 0 ? liquidSavings / avgMonthlyExpenses : 0;
}

export function emergencyFundStatus(months: number): FinancialStatus {
  if (months >= 3) return "good";
  if (months >= 1) return "warn";
  return "bad";
}

export function savingsRateStatus(rate: number): FinancialStatus {
  if (rate >= 0.2) return "good";
  if (rate >= 0.1) return "warn";
  return "bad";
}

export function computeDebtToIncome(totalMonthlyPayments: number, monthlyIncome: number): number {
  return monthlyIncome > 0 ? totalMonthlyPayments / monthlyIncome : 0;
}

export function debtStatus(ratio: number): FinancialStatus {
  if (ratio <= 0.15) return "good";
  if (ratio <= 0.36) return "warn";
  return "bad";
}

/** `hasInvestments` is checked separately from the percentage (rather than
 *  just treating a 0% split as "bad") so a genuinely tiny-but-real
 *  investment reads as "мало", not identically to having none at all. */
export function investmentStatus(hasInvestments: boolean, investmentPct: number): FinancialStatus {
  if (!hasInvestments) return "bad";
  return investmentPct > 0.2 ? "good" : "warn";
}

/** Numbers only, not a formatted sentence — the caller already has
 *  formatCurrency + the user's currency symbol in scope, so building the
 *  actual Ukrainian copy happens at the UI layer (same split as everywhere
 *  else in this codebase: lib functions return numbers, components render
 *  text). Returns null once the goal's already met (months >= 3) or when
 *  there's no expense baseline to size a target against at all — both
 *  render as "подушка в нормі" / no advice, not a nonsense number. */
export function emergencyFundShortfall(
  months: number,
  monthlyExpenses: number,
  savings: number
): { shortfall: number; monthsToGoal: number } | null {
  if (months >= 3 || monthlyExpenses <= 0) return null;
  const shortfall = monthlyExpenses * 3 - savings;
  const monthsToGoal = shortfall / (monthlyExpenses * 0.1);
  return { shortfall, monthsToGoal };
}

/** Months to fully pay off one debt at its current monthlyPayment — null
 *  for a payment of 0 (would otherwise divide to Infinity), which reads as
 *  "not actually being paid down", not "N months" for any N. */
export function debtPayoffMonths(remainingAmount: number, monthlyPayment: number): number | null {
  if (monthlyPayment <= 0) return null;
  return Math.ceil(remainingAmount / monthlyPayment);
}

/** How much to move from cash/savings into investments to reach a 20%
 *  portfolio split — moving money between the two doesn't change their
 *  combined pool, so the target is just 20% of (investments + savings)
 *  minus whatever's already invested. 0 once already at/above 20%. */
export function investmentRebalanceAmount(totalInvestments: number, liquidSavings: number): number {
  const pool = totalInvestments + liquidSavings;
  if (pool <= 0) return 0;
  return Math.max(0, pool * 0.2 - totalInvestments);
}

/**
 * Stückweise lineare Interpolation zwischen 5 Referenz-Stützpunkten
 */

import {
  TAX_REFERENCE_INCOME_LEVELS,
  taxAmountsToSortedPoints,
  type TaxAmountsByLevel,
} from "./types";

export function interpolateTaxFromBracketTable(
  income: number,
  taxAmounts: TaxAmountsByLevel,
): number {
  if (income <= 0) return 0;

  const points = taxAmountsToSortedPoints(taxAmounts);
  if (points.every((p) => p.tax === 0)) return 0;

  const first = points[0];
  if (income <= first.income) {
    if (first.income <= 0) return 0;
    return Math.round((income / first.income) * first.tax);
  }

  for (let i = 0; i < points.length - 1; i++) {
    const left = points[i];
    const right = points[i + 1];
    if (income <= right.income) {
      const span = right.income - left.income;
      if (span <= 0) return Math.round(right.tax);
      const t = (income - left.income) / span;
      return Math.round(left.tax + t * (right.tax - left.tax));
    }
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const span = last.income - prev.income;
  if (span <= 0) return Math.round(last.tax);

  const marginalRate = (last.tax - prev.tax) / span;
  const extrapolated = last.tax + (income - last.income) * marginalRate;
  return Math.round(Math.max(last.tax, extrapolated));
}

export function effectiveRateFromBracketTable(
  income: number,
  taxAmounts: TaxAmountsByLevel,
): number {
  if (income <= 0) return 0;
  return interpolateTaxFromBracketTable(income, taxAmounts) / income;
}

export function bracketTableComplete(amounts: TaxAmountsByLevel): boolean {
  return TAX_REFERENCE_INCOME_LEVELS.every(
    (level) => amounts[String(level)] != null,
  );
}

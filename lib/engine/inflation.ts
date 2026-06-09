import { normalizeDbRate } from "@/lib/format/numbers";

/** Profile inflation: decimal (0.02) or percent (2) in DB; null/0 = no inflation. */
export function inflationRateFromProfile(
  value: number | null | undefined,
): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, normalizeDbRate(value, 0));
}

/** Compound inflation: base × (1 + rate)^years. years = 0 returns base unchanged. */
export function inflateAmount(
  baseAmount: number,
  inflationRate: number,
  years: number,
): number {
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return 0;
  if (!Number.isFinite(inflationRate) || inflationRate <= 0 || years <= 0) {
    return Math.round(baseAmount);
  }
  return Math.round(baseAmount * Math.pow(1 + inflationRate, years));
}

export function formatInflationRatePercent(inflationRate: number): string {
  if (inflationRate <= 0) return "0 %";
  return `${(inflationRate * 100).toLocaleString("de-CH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}

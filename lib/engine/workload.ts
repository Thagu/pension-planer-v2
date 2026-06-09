/**
 * Arbeitspensum-Reduktionen (Teilpensionierung)
 * Bis zu 2 Stufen: ab Alter X gilt Y % Pensum (100 = Vollzeit).
 */

import { inflateAmount } from "./inflation";

export type WorkloadReduction = {
  fromAge: number;
  workloadPercent: number;
};

export const MAX_WORKLOAD_REDUCTIONS = 2;

export function normalizeWorkloadReductions(
  raw: WorkloadReduction[] | null | undefined,
): WorkloadReduction[] {
  if (!raw?.length) return [];

  const seen = new Set<number>();
  const normalized: WorkloadReduction[] = [];

  for (const entry of raw) {
    const fromAge = Math.round(Number(entry.fromAge));
    const workloadPercent = Math.round(Number(entry.workloadPercent));
    if (
      !Number.isFinite(fromAge) ||
      !Number.isFinite(workloadPercent) ||
      fromAge < 18 ||
      fromAge > 70 ||
      workloadPercent <= 0 ||
      workloadPercent > 100 ||
      seen.has(fromAge)
    ) {
      continue;
    }
    seen.add(fromAge);
    normalized.push({ fromAge, workloadPercent });
  }

  return normalized
    .sort((a, b) => a.fromAge - b.fromAge)
    .slice(0, MAX_WORKLOAD_REDUCTIONS);
}

/** Arbeitspensum-Faktor 0–1 für ein Alter (100 % bis zur ersten Reduktion). */
export function workloadFactorAtAge(
  reductions: WorkloadReduction[],
  age: number,
): number {
  if (reductions.length === 0) return 1;

  let factor = 1;
  for (const reduction of reductions) {
    if (age >= reduction.fromAge) {
      factor = reduction.workloadPercent / 100;
    }
  }
  return factor;
}

/**
 * Sparquote bei Teilpensionierung: sinkt um die volle Brutto-Einbusse
 * (nicht nur proportional zum Pensum).
 */
export function savingsAtWorkload(
  fullSalaryBrutto: number,
  fullAnnualSavings: number,
  workloadFactor: number,
): number {
  const baseSavings = Math.max(0, fullAnnualSavings);
  if (workloadFactor >= 1 || fullSalaryBrutto <= 0) {
    return Math.round(baseSavings);
  }
  const grossIncomeDrop = fullSalaryBrutto * (1 - workloadFactor);
  return Math.max(0, Math.round(baseSavings - grossIncomeDrop));
}

export function formatWorkloadReductions(
  reductions: WorkloadReduction[],
): string {
  const normalized = normalizeWorkloadReductions(reductions);
  if (normalized.length === 0) return "100 % (Vollzeit)";

  return normalized
    .map((r) => `ab ${r.fromAge} J.: ${r.workloadPercent} %`)
    .join(" · ");
}

export function projectedAverageIncome(
  fullSalary: number,
  currentAge: number,
  employmentEndAge: number,
  reductions: WorkloadReduction[],
  inflationRate = 0,
): number {
  const normalized = normalizeWorkloadReductions(reductions);
  if (employmentEndAge <= currentAge) {
    return fullSalary;
  }

  let sum = 0;
  let years = 0;
  for (let age = currentAge; age < employmentEndAge; age++) {
    const yearIndex = age - currentAge;
    const salaryAtYear = inflateAmount(fullSalary, inflationRate, yearIndex);
    const factor =
      normalized.length > 0 ? workloadFactorAtAge(normalized, age) : 1;
    sum += salaryAtYear * factor;
    years++;
  }

  return years > 0 ? Math.round(sum / years) : fullSalary;
}

export function parseWorkloadReductionsFromForm(
  formData: FormData,
): WorkloadReduction[] {
  const reductions: WorkloadReduction[] = [];

  for (let i = 1; i <= MAX_WORKLOAD_REDUCTIONS; i++) {
    const fromRaw = formData.get(`workloadReduction${i}FromAge`);
    const percentRaw = formData.get(`workloadReduction${i}Percent`);
    const fromAge =
      typeof fromRaw === "string" && fromRaw.trim()
        ? parseInt(fromRaw, 10)
        : NaN;
    const workloadPercent =
      typeof percentRaw === "string" && percentRaw.trim()
        ? parseInt(percentRaw, 10)
        : NaN;

    if (
      Number.isFinite(fromAge) &&
      Number.isFinite(workloadPercent) &&
      workloadPercent > 0
    ) {
      reductions.push({ fromAge, workloadPercent });
    }
  }

  return normalizeWorkloadReductions(reductions);
}

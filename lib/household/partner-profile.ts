import {
  BVG_CONVERSION_RATE,
  BVG_MIN_INTEREST_RATE,
} from "@/lib/engine/constants";
import type { ProfileForScenario } from "@/lib/engine/orchestrator";
import type { Pillar3aAccountRow } from "@/lib/pillar3a/accounts";
import { normalizeDbRate } from "@/lib/format/numbers";
import { normalizeWorkloadReductions } from "@/lib/engine/workload";
import type { TaxSettings } from "@/lib/tax/additional-income-tax";

import type { PartnerProfileData, PlanningMode } from "./types";
import { pillar3aRowsToScenarioAccounts } from "@/lib/scenarios/profile";

export function parsePartnerProfileData(raw: unknown): PartnerProfileData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as PartnerProfileData;
  return {
    birth_date: data.birth_date ?? null,
    gender: data.gender ?? null,
    employment_start_year: data.employment_start_year ?? null,
    retirement_age: data.retirement_age ?? null,
    current_salary_brutto: data.current_salary_brutto ?? null,
    bvg_current_capital: data.bvg_current_capital ?? null,
    free_assets: data.free_assets ?? null,
    bvg_interest_rate: data.bvg_interest_rate ?? null,
    bvg_conversion_rate: data.bvg_conversion_rate ?? null,
    bvg_contribution_rates: data.bvg_contribution_rates ?? null,
    bvg_coordinated_salary_override: data.bvg_coordinated_salary_override ?? null,
    free_assets_interest_rate: data.free_assets_interest_rate ?? null,
    annual_savings_to_free_assets: data.annual_savings_to_free_assets ?? null,
    workload_reductions: data.workload_reductions ?? null,
  };
}

export function partnerProfileFromForm(formData: FormData): PartnerProfileData {
  const ratesRaw = formData.get("partnerBvgContributionRates");
  let bvgContributionRates: Record<string, number> | null = null;
  if (typeof ratesRaw === "string" && ratesRaw.trim()) {
    try {
      const parsed = JSON.parse(ratesRaw) as Record<string, number>;
      bvgContributionRates = Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [
          k,
          v > 1 || v < -1 ? v / 100 : v,
        ]),
      );
    } catch {
      bvgContributionRates = null;
    }
  }

  const parsePercent = (key: string) => {
    const raw = formData.get(key);
    if (typeof raw !== "string" || !raw.trim()) return null;
    const n = parseFloat(raw.replace(",", ".").replace(/%/g, ""));
    if (!Number.isFinite(n)) return null;
    return n > 1 || n < -1 ? n / 100 : n;
  };

  const parseChf = (key: string) => {
    const raw = formData.get(key);
    if (typeof raw !== "string" || !raw.trim()) return null;
    const n = Number(raw.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const parseAge = (key: string) => {
    const raw = formData.get(key);
    if (typeof raw !== "string" || !raw.trim()) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  };

  const reductions: { fromAge: number; workloadPercent: number }[] = [];
  for (let i = 1; i <= 2; i++) {
    const fromAge = parseAge(`partnerWorkloadReduction${i}FromAge`);
    const percent = parseAge(`partnerWorkloadReduction${i}Percent`);
    if (fromAge != null && percent != null && percent > 0) {
      reductions.push({ fromAge, workloadPercent: percent });
    }
  }

  return {
    birth_date:
      typeof formData.get("partnerBirthDate") === "string"
        ? String(formData.get("partnerBirthDate")).trim() || null
        : null,
    gender:
      formData.get("partnerGender") === "male" ||
      formData.get("partnerGender") === "female"
        ? (formData.get("partnerGender") as "male" | "female")
        : null,
    employment_start_year: parseAge("partnerEmploymentStartYear"),
    retirement_age: parseAge("partnerRetirementAge"),
    current_salary_brutto: parseChf("partnerCurrentSalaryBrutto"),
    bvg_current_capital: parseChf("partnerBvgCurrentCapital"),
    free_assets: parseChf("partnerFreeAssets"),
    bvg_interest_rate: parsePercent("partnerBvgInterestRate"),
    bvg_conversion_rate: parsePercent("partnerBvgConversionRate"),
    bvg_contribution_rates: bvgContributionRates,
    bvg_coordinated_salary_override: parseChf("partnerBvgCoordinatedSalaryOverride"),
    free_assets_interest_rate: parsePercent("partnerFreeAssetsInterestRate"),
    annual_savings_to_free_assets: parseChf("partnerAnnualSavingsToFreeAssets"),
    workload_reductions: normalizeWorkloadReductions(reductions),
  };
}

export function partnerDataToProfileForScenario(
  data: PartnerProfileData | null,
  partnerPillar3a: Pillar3aAccountRow[],
  shared: {
    planningHorizonAge?: number | null;
    annualRetirementExpenses?: number | null;
    taxSettings?: TaxSettings;
    pillar3aDefaultReturnRate?: number | null;
    pillar3aAutoSplit?: ProfileForScenario["pillar3aAutoSplit"];
    inflationRate?: number | null;
  },
): ProfileForScenario | null {
  if (!data?.birth_date) return null;

  return {
    birthDate: data.birth_date,
    gender: data.gender ?? null,
    employmentStartYear: data.employment_start_year ?? null,
    retirementAge: data.retirement_age ?? 65,
    currentSalaryBrutto: Number(data.current_salary_brutto ?? 0),
    bvgCurrentCapital: Number(data.bvg_current_capital ?? 0),
    freeAssets: Number(data.free_assets ?? 0),
    bvgInterestRate:
      data.bvg_interest_rate != null
        ? normalizeDbRate(data.bvg_interest_rate, BVG_MIN_INTEREST_RATE)
        : null,
    bvgConversionRate:
      data.bvg_conversion_rate != null
        ? normalizeDbRate(data.bvg_conversion_rate, BVG_CONVERSION_RATE)
        : null,
    bvgContributionRates: data.bvg_contribution_rates
      ? Object.fromEntries(
          Object.entries(data.bvg_contribution_rates).map(([k, v]) => [
            k,
            normalizeDbRate(v, 0),
          ]),
        )
      : null,
    bvgCoordinatedSalaryOverride: data.bvg_coordinated_salary_override ?? null,
    freeAssetsInterestRate:
      data.free_assets_interest_rate != null
        ? normalizeDbRate(data.free_assets_interest_rate, 0.04)
        : null,
    annualSavingsToFreeAssets: Number(data.annual_savings_to_free_assets ?? 0),
    pillar3aDefaultReturnRate:
      shared.pillar3aDefaultReturnRate != null
        ? normalizeDbRate(shared.pillar3aDefaultReturnRate, 0.03)
        : null,
    planningHorizonAge: shared.planningHorizonAge ?? 90,
    annualRetirementExpenses: 0,
    workloadReductions: normalizeWorkloadReductions(data.workload_reductions),
    taxSettings: shared.taxSettings,
    pillar3aAccounts: pillar3aRowsToScenarioAccounts(partnerPillar3a),
    pillar3aAutoSplit: shared.pillar3aAutoSplit,
    inflationRate: shared.inflationRate ?? null,
  };
}

export function parsePlanningMode(value: unknown): PlanningMode {
  return value === "couple" ? "couple" : "single";
}

import type { ProfileForScenario, Pillar3aAccountForScenario } from "@/lib/engine";
import { normalizeWorkloadReductions, type WorkloadReduction } from "@/lib/engine/workload";
import { parseDbAmount } from "@/lib/format/db-numbers";
import {
  decimalRateToPercent,
  normalizeDbRate,
} from "@/lib/format/numbers";
import { inflationRateFromProfile } from "@/lib/engine/inflation";
import type { Pillar3aAccountRow } from "@/lib/pillar3a/accounts";
import {
  BVG_CONVERSION_RATE,
  BVG_MIN_INTEREST_RATE,
} from "@/lib/engine/constants";
import { taxSettingsFromProfile } from "@/lib/tax/profile-tax";

export type ProfileRow = {
  updated_at?: string | null;
  birth_date: string | null;
  gender: string | null;
  employment_start_year: number | null;
  retirement_age: number | null;
  current_salary_brutto: number | null;
  bvg_current_capital: number | null;
  pillar3a_current_capital: number | null;
  free_assets: number | null;
  bvg_interest_rate: number | null;
  bvg_conversion_rate: number | null;
  bvg_contribution_rates: Record<string, number> | null;
  bvg_coordinated_salary_override: number | null;
  pillar3a_interest_rate: number | null;
  free_assets_interest_rate: number | null;
  annual_savings_to_free_assets: number | null;
  planning_horizon_age: number | null;
  annual_retirement_expenses: number | null;
  annual_survivor_expenses?: number | null;
  pillar3a_auto_split_enabled: boolean | null;
  pillar3a_auto_split_threshold: number | null;
  pillar3a_auto_split_contribution_mode: string | null;
  pillar3a_auto_split_name_prefix: string | null;
  tax_canton: string | null;
  tax_postal_code: string | null;
  tax_municipality: string | null;
  tax_municipality_steuerfuss: number | null;
  marital_status: string | null;
  workload_reductions: WorkloadReduction[] | null;
  inflation_rate?: number | null;
};

/** DB-Dezimal (0.068) oder Prozent (6.8) → Anzeige in % */
export function profileRateToPercent(
  value: number | null | undefined,
  fallbackDecimal: number,
): number {
  return decimalRateToPercent(normalizeDbRate(value, fallbackDecimal));
}

export function profileContributionRatesToPercent(
  rates: Record<string, number> | null | undefined,
): Record<string, number> | null {
  if (!rates) return null;
  return Object.fromEntries(
    Object.entries(rates).map(([k, v]) => [
      k,
      decimalRateToPercent(normalizeDbRate(v, 0)),
    ]),
  );
}

export function pillar3aRowsToScenarioAccounts(
  rows: Pillar3aAccountRow[],
): Pillar3aAccountForScenario[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    currentCapital: parseDbAmount(row.current_value),
    annualContribution: parseDbAmount(row.annual_contribution),
    returnRate: row.return_rate != null ? normalizeDbRate(row.return_rate, 0.03) : null,
  }));
}

function parseWorkloadReductionsFromDb(
  raw: unknown,
): WorkloadReduction[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      return {
        fromAge: Number(item.fromAge),
        workloadPercent: Number(item.workloadPercent),
      };
    })
    .filter((entry): entry is WorkloadReduction => entry != null);
}

export function profileRowToScenarioInput(
  row: ProfileRow | null,
  pillar3aAccounts: Pillar3aAccountRow[] = [],
): ProfileForScenario | null {
  if (!row?.birth_date || !row.current_salary_brutto) return null;

  return {
    birthDate: row.birth_date,
    gender: row.gender as "male" | "female" | null,
    employmentStartYear: row.employment_start_year,
    retirementAge: row.retirement_age ?? 65,
    currentSalaryBrutto: Number(row.current_salary_brutto),
    bvgCurrentCapital: Number(row.bvg_current_capital ?? 0),
    freeAssets: Number(row.free_assets ?? 0),
    bvgInterestRate:
      row.bvg_interest_rate != null
        ? normalizeDbRate(row.bvg_interest_rate, BVG_MIN_INTEREST_RATE)
        : null,
    bvgConversionRate:
      row.bvg_conversion_rate != null
        ? normalizeDbRate(row.bvg_conversion_rate, BVG_CONVERSION_RATE)
        : null,
    bvgContributionRates: row.bvg_contribution_rates
      ? Object.fromEntries(
          Object.entries(row.bvg_contribution_rates).map(([k, v]) => [
            k,
            normalizeDbRate(v, 0),
          ]),
        )
      : null,
    bvgCoordinatedSalaryOverride: row.bvg_coordinated_salary_override,
    freeAssetsInterestRate:
      row.free_assets_interest_rate != null
        ? normalizeDbRate(row.free_assets_interest_rate, 0.04)
        : null,
    annualSavingsToFreeAssets: Number(row.annual_savings_to_free_assets ?? 0),
    pillar3aDefaultReturnRate:
      row.pillar3a_interest_rate != null
        ? normalizeDbRate(row.pillar3a_interest_rate, 0.03)
        : null,
    pillar3aAutoSplit: row.pillar3a_auto_split_enabled
      ? {
          enabled: true,
          threshold: parseDbAmount(row.pillar3a_auto_split_threshold),
          contributionMode:
            row.pillar3a_auto_split_contribution_mode === "last"
              ? "last"
              : "max",
          namePrefix:
            row.pillar3a_auto_split_name_prefix?.trim() || "3a-Konto",
        }
      : undefined,
    planningHorizonAge: row.planning_horizon_age ?? 95,
    annualRetirementExpenses: Number(row.annual_retirement_expenses ?? 0),
    annualSurvivorExpenses: Number(row.annual_survivor_expenses ?? 0),
    workloadReductions: normalizeWorkloadReductions(
      parseWorkloadReductionsFromDb(row.workload_reductions),
    ),
    taxSettings: taxSettingsFromProfile(row),
    pillar3aAccounts: pillar3aRowsToScenarioAccounts(pillar3aAccounts),
    inflationRate: inflationRateFromProfile(row.inflation_rate),
  };
}

export function isProfileCompleteForScenario(row: ProfileRow | null): boolean {
  return Boolean(
    row?.birth_date &&
      row.current_salary_brutto != null &&
      row.current_salary_brutto > 0,
  );
}

export function getProfileBvgDefaults(row: ProfileRow | null) {
  return {
    conversionRatePercent: profileRateToPercent(
      row?.bvg_conversion_rate,
      BVG_CONVERSION_RATE,
    ),
    interestRatePercent: profileRateToPercent(
      row?.bvg_interest_rate,
      BVG_MIN_INTEREST_RATE,
    ),
    contributionRatesPercent: profileContributionRatesToPercent(
      row?.bvg_contribution_rates,
    ),
    freeAssetsReturnPercent: profileRateToPercent(
      row?.free_assets_interest_rate,
      0.04,
    ),
  };
}

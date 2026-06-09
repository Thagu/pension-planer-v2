/**
 * Pension Planner Engine
 * Modulare, plattformunabhängige Berechnungslogik
 */

export type {
  UserProfile,
  CurrentSituation,
  ScenarioInput,
  Scenario,
  YearlyData,
  SimulationResult,
} from "./types";

export {
  calculateAhvPension,
  calculateFullPension,
  calculateContributionYears,
  calculateEarlyLateAdjustment,
} from "./modules/ahv";
export type { AhvInput, AhvResult, AhvExplanationStep } from "./modules/ahv";

export {
  calculateBvgPension,
  calculateCoordinatedSalary,
  getContributionRate,
} from "./modules/bvg";
export type {
  BvgInput,
  BvgResult,
  BvgYearProjection,
  BvgExplanationStep,
  BvgPayoutOptions,
  BvgPayoutResult,
  CoordinatedSalaryBreakdown,
} from "./modules/bvg";
export { calculateCoordinatedSalaryBreakdown } from "./modules/bvg";

export { calculateFreeAssetsPension } from "./modules/free-assets";
export type {
  FreeAssetsInput,
  FreeAssetsResult,
  FreeAssetsYearProjection,
  FreeAssetsExplanationStep,
  CapitalInjection,
  CapitalInjectionSource,
} from "./modules/free-assets";

export { calculatePillar3a } from "./modules/pillar3a";
export type {
  Pillar3aInput,
  Pillar3aResult,
  Pillar3aAccountInput,
  Pillar3aAccountResult,
  Pillar3aYearProjection,
  Pillar3aScheduledWithdrawal,
  Pillar3aExplanationStep,
} from "./modules/pillar3a";

export {
  calculateAdditionalIncomeTax,
  explainAdditionalIncomeTax,
} from "@/lib/tax/additional-income-tax";
export type { TaxSettings } from "@/lib/tax/additional-income-tax";
export { SWISS_CANTON_TAX_REFERENCE } from "@/lib/tax/canton-reference";

export {
  buildScenarioPensionInput,
  calculateScenarioPension,
  rateFromProfileDb,
  rateFromScenarioPercent,
  rateFromScenarioOverride,
  contributionRatesFromProfileDb,
  contributionRatesFromScenarioPercent,
  normalizeRate,
  normalizeContributionRates,
} from "./orchestrator";

export {
  optimizeCapitalWithdrawal,
  type CapitalWithdrawalOptimizationResult,
  type CapitalWithdrawalOptimizationSuggestion,
} from "./capital-withdrawal-optimizer";

export {
  calculateFinancialIndependence,
  calculateHouseholdFinancialIndependence,
  type FinancialIndependenceResult,
  type FinancialIndependenceTimeline,
} from "./financial-independence";

export {
  calculateHouseholdPension,
  combinedProjectionToFreeAssets,
  type HouseholdPensionResult,
} from "./household-orchestrator";

export {
  applyCoupleAhvPlafonierung,
  getCoupleAhvCapYearly,
  AHV_COUPLE_MAX_FACTOR,
  type CoupleAhvPlafonierungResult,
} from "./modules/ahv-couple";

export {
  getAhvReferenceAge,
  getAhvEarliestPensionAge,
  getPillar3aEarliestWithdrawalAge,
  BVG_EARLIEST_PENSION_AGE,
  resolveEmploymentEndAge,
  resolveAhvPensionStartAge,
  resolveBvgPensionStartAge,
  formatAhvReferenceAge,
  pillar3aWithdrawalOffsetBounds,
  clampPillar3aWithdrawalOffset,
} from "./legal-ages";

export {
  BVG_CONTRIBUTION_BUCKETS,
  BVG_CONTRIBUTION_RATES,
  BVG_CONVERSION_RATE,
  BVG_MIN_INTEREST_RATE,
  BVG_MIN_CONTRIBUTION_AGE,
  BVG_GUIDANCE_MAX_CAPITAL_WITHDRAWAL,
  BVG_MAX_CAPITAL_WITHDRAWAL_TRANCHES,
  DEFAULT_ASSUMPTIONS,
  PILLAR_3A_MAX_CONTRIBUTION,
  PILLAR_3A_MAX_ACCOUNTS,
  PILLAR_3A_MIN_WITHDRAWAL_OFFSET,
  PILLAR_3A_MAX_WITHDRAWAL_OFFSET,
} from "./constants";
export type {
  ScenarioOverrides,
  ProfileForScenario,
  ScenarioPensionResult,
  Pillar3aAccountForScenario,
} from "./orchestrator";

export {
  normalizeWorkloadReductions,
  workloadFactorAtAge,
  savingsAtWorkload,
  formatWorkloadReductions,
  projectedAverageIncome,
  parseWorkloadReductionsFromForm,
  MAX_WORKLOAD_REDUCTIONS,
} from "./workload";
export type { WorkloadReduction } from "./workload";

export {
  inflateAmount,
  inflationRateFromProfile,
  formatInflationRatePercent,
} from "./inflation";

export function formatCHF(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function calculateAge(
  birthDate: string,
  referenceDate?: string,
): number {
  const birth = new Date(birthDate);
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function yearsUntilRetirement(
  birthDate: string,
  retirementAge: number,
): number {
  const age = calculateAge(birthDate);
  return Math.max(0, retirementAge - age);
}

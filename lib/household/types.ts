import type { ProfileForScenario } from "@/lib/engine/orchestrator";
import type { WorkloadReduction } from "@/lib/engine/workload";

export type PlanningMode = "single" | "couple";
export type PersonRole = "primary" | "partner";

/** Partner-Stammdaten (JSON in profiles.partner_profile) */
export type PartnerProfileData = {
  birth_date?: string | null;
  gender?: "male" | "female" | null;
  employment_start_year?: number | null;
  retirement_age?: number | null;
  current_salary_brutto?: number | null;
  bvg_current_capital?: number | null;
  free_assets?: number | null;
  bvg_interest_rate?: number | null;
  bvg_conversion_rate?: number | null;
  bvg_contribution_rates?: Record<string, number> | null;
  bvg_coordinated_salary_override?: number | null;
  free_assets_interest_rate?: number | null;
  annual_savings_to_free_assets?: number | null;
  workload_reductions?: WorkloadReduction[] | null;
};

export type HouseholdProfileForScenario = {
  planningMode: PlanningMode;
  primary: ProfileForScenario;
  partner: ProfileForScenario | null;
};

export type InheritanceEvent = {
  /** Alter Person 1 (Referenz) beim Zufluss */
  atAge: number;
  amount: number;
  /** Ziel-Vermögen (Standard: gemeinsames Haushaltsvermögen) */
  recipient?: "household" | "primary" | "partner";
};

export type CombinedWealthYearProjection = {
  year: number;
  primaryAge: number;
  partnerAge: number | null;
  capitalStart: number;
  capitalEnd: number;
  primaryCapitalEnd: number;
  partnerCapitalEnd: number;
  savingsContribution: number;
  interest: number;
  capitalInjection: number;
  annualPensionIncome: number;
  annualTotalIncome: number;
  annualTotalExpenses: number;
  annualGrossExpenses: number;
  annualWithdrawal: number;
  annualTotalTax: number;
  cumulativeIncome: number;
  cumulativeExpenses: number;
  inheritanceInjection: number;
  bvgCapitalInjection: number;
  pillar3aCapitalInjection: number;
  primaryBvgCapitalInjection: number;
  partnerBvgCapitalInjection: number;
  primaryPillar3aCapitalInjection: number;
  partnerPillar3aCapitalInjection: number;
  /** Vermögen von Person 1 → Person 2 beim Planungshorizont von Person 1 */
  survivorWealthTransfer?: number;
};

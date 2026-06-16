/**
 * Haushalts-Cashflow: Netto-Lebenshaltung, Phasen (Paarmodus)
 */

import type { BvgResult } from "./modules/bvg";
import type { Pillar3aResult } from "./modules/pillar3a";
import {
  rateFromProfileDb,
  rateFromScenarioOverride,
  type ProfileForScenario,
  type ScenarioOverrides,
} from "./orchestrator";
import { DEFAULT_ASSUMPTIONS } from "./constants";
import { inflateAmount } from "./inflation";
import {
  normalizeWorkloadReductions,
  type WorkloadReduction,
} from "./workload";
import type { CombinedWealthYearProjection } from "@/lib/household/types";

export type HouseholdCashflowPhase =
  | "accumulation"
  | "mixed"
  | "full_retirement"
  | "survivor";

export type HouseholdYearCashflow = {
  phase: HouseholdCashflowPhase;
  netLiving: number;
  employmentIncomeNet: number;
  pensionIncome: number;
  pillar3aContribution: number;
  bvgEmployeeContribution: number;
  retirementTax: number;
  grossCashNeed: number;
  netWithdrawal: number;
};

export type HouseholdPersonCashflowInput = {
  profile: ProfileForScenario;
  employmentEndAge: number;
  currentAge: number;
  bvg: BvgResult;
  pillar3a: Pillar3aResult;
  /** Aufgelöstes Arbeitspensum (Profil oder Szenario-Override). */
  workloadReductions: WorkloadReduction[];
};

export function portfolioReturnRateFromProfile(
  profile: ProfileForScenario,
): number {
  if (profile.freeAssetsInterestRate != null) {
    return rateFromProfileDb(
      profile.freeAssetsInterestRate,
      DEFAULT_ASSUMPTIONS.returnRateFreeAssets,
    );
  }
  return DEFAULT_ASSUMPTIONS.returnRateFreeAssets;
}

export function blendedPortfolioReturnRate(
  primary: ProfileForScenario,
  partner: ProfileForScenario | null,
  overrides?: Pick<ScenarioOverrides, "freeAssets"> | null,
): number {
  if (!partner) return portfolioReturnRateFromProfile(primary);
  const primaryRate = portfolioReturnRateFromProfile(primary);
  const partnerRate = portfolioReturnRateFromProfile(partner);
  const primaryValue =
    overrides?.freeAssets?.currentValueOverride ?? primary.freeAssets ?? 0;
  const partnerValue = partner.freeAssets ?? 0;
  const total = primaryValue + partnerValue;
  if (total <= 0) return (primaryRate + partnerRate) / 2;
  return (primaryRate * primaryValue + partnerRate * partnerValue) / total;
}

/** Profil-Rendite oder Szenario-Override für gepooltes Haushaltsvermögen. */
export function portfolioReturnRateFromScenario(
  primary: ProfileForScenario,
  partner: ProfileForScenario | null,
  overrides?: Pick<ScenarioOverrides, "freeAssets"> | null,
): number {
  const profileBlended = blendedPortfolioReturnRate(primary, partner, overrides);
  const override = overrides?.freeAssets?.returnRateOverride;
  if (override != null) {
    const rate = rateFromScenarioOverride(override);
    if (rate != null && Math.abs(rate - profileBlended) > 1e-6) {
      return rate;
    }
  }
  return profileBlended;
}

export type HouseholdCashflowContext = {
  baseNetLiving: number;
  /** Netto-Lebenshaltung nach Tod des ersten Partners (heutige Kaufkraft) */
  baseSurvivorLiving: number;
  inflationRate: number;
  /** Gewichtete Rendite für gepooltes freies Vermögen */
  portfolioReturnRate: number;
  primaryEmploymentEnd: number;
  partnerEmploymentEnd?: number;
  primaryHorizonAge: number;
  partnerHorizonAge?: number;
  primary: HouseholdPersonCashflowInput;
  partner?: HouseholdPersonCashflowInput;
};

/** Jahre seit Beginn der Haushaltsausgaben (ab erster Pensionierung im Haushalt). */
export function yearsSinceHouseholdExpenseStart(
  row: Pick<CombinedWealthYearProjection, "primaryAge" | "partnerAge">,
  opts: {
    primaryEmploymentEnd: number;
    partnerEmploymentEnd?: number;
  },
): number {
  const primaryStarted = row.primaryAge >= opts.primaryEmploymentEnd;
  const partnerStarted =
    opts.partnerEmploymentEnd != null &&
    row.partnerAge != null &&
    row.partnerAge >= opts.partnerEmploymentEnd;

  if (!primaryStarted && !partnerStarted) return 0;

  const candidates: number[] = [];
  if (primaryStarted) {
    candidates.push(row.primaryAge - opts.primaryEmploymentEnd);
  }
  if (partnerStarted && row.partnerAge != null) {
    candidates.push(row.partnerAge - opts.partnerEmploymentEnd!);
  }
  return Math.max(...candidates);
}

export function isInSurvivorPhase(
  row: Pick<CombinedWealthYearProjection, "primaryAge" | "partnerAge">,
  primaryHorizonAge: number,
  partnerHorizonAge?: number,
): boolean {
  if (partnerHorizonAge == null || row.partnerAge == null) return false;
  return (
    row.primaryAge >= primaryHorizonAge || row.partnerAge >= partnerHorizonAge
  );
}

export function computeNetLivingExpenses(
  row: Pick<CombinedWealthYearProjection, "primaryAge" | "partnerAge">,
  baseNetLiving: number,
  inflationRate: number,
  primaryEmploymentEnd: number,
  partnerEmploymentEnd?: number,
  options?: {
    baseSurvivorLiving?: number;
    primaryHorizonAge?: number;
    partnerHorizonAge?: number;
  },
): number {
  const primaryRetired = row.primaryAge >= primaryEmploymentEnd;
  const partnerRetired =
    partnerEmploymentEnd != null &&
    row.partnerAge != null &&
    row.partnerAge >= partnerEmploymentEnd;
  if (!primaryRetired && !partnerRetired) return 0;

  const yearsSinceStart = yearsSinceHouseholdExpenseStart(row, {
    primaryEmploymentEnd,
    partnerEmploymentEnd,
  });

  const inSurvivor =
    options?.primaryHorizonAge != null &&
    options?.partnerHorizonAge != null &&
    row.partnerAge != null &&
    isInSurvivorPhase(row, options.primaryHorizonAge, options.partnerHorizonAge);

  // Inflation anchor: first household retirement for both couple and survivor
  // expenses (same nominal reference year as annual_retirement_expenses).
  const base =
    inSurvivor && (options?.baseSurvivorLiving ?? 0) > 0
      ? options!.baseSurvivorLiving!
      : baseNetLiving;

  if (base <= 0) return 0;
  return inflateAmount(base, inflationRate, yearsSinceStart);
}

function resolveCashflowPhase(
  primaryRetired: boolean,
  partnerRetired: boolean,
  inSurvivorPhase: boolean,
): HouseholdCashflowPhase {
  if (inSurvivorPhase) return "survivor";
  if (!primaryRetired && !partnerRetired) return "accumulation";
  if (primaryRetired && partnerRetired) return "full_retirement";
  return "mixed";
}

function bvgContributionAtAge(bvg: BvgResult, age: number): number {
  const row = bvg.projection.find((entry) => entry.age === age);
  return row?.contribution ?? 0;
}

function pillar3aContributionAtAge(pillar3a: Pillar3aResult, age: number): number {
  return pillar3a.accounts.reduce((sum, account) => {
    const row = account.projection.find((entry) => entry.age === age);
    return sum + (row?.contribution ?? 0);
  }, 0);
}

function activePersonContributions(
  person: HouseholdPersonCashflowInput,
  age: number,
  employmentEndAge: number,
): { pillar3a: number; bvg: number } {
  if (age >= employmentEndAge) {
    return { pillar3a: 0, bvg: 0 };
  }
  return {
    pillar3a: pillar3aContributionAtAge(person.pillar3a, age),
    bvg: bvgContributionAtAge(person.bvg, age),
  };
}

export function computeHouseholdYearCashflow(
  row: CombinedWealthYearProjection,
  ctx: HouseholdCashflowContext,
  pensionIncome: number,
  retirementTax: number,
): HouseholdYearCashflow {
  const primaryRetired = row.primaryAge >= ctx.primaryEmploymentEnd;
  const partnerRetired =
    ctx.partnerEmploymentEnd != null &&
    row.partnerAge != null &&
    row.partnerAge >= ctx.partnerEmploymentEnd;

  const primaryDeceased = row.primaryAge >= ctx.primaryHorizonAge;
  const partnerDeceased =
    ctx.partnerHorizonAge != null &&
    row.partnerAge != null &&
    row.partnerAge >= ctx.partnerHorizonAge;

  const inSurvivorPhase = isInSurvivorPhase(
    row,
    ctx.primaryHorizonAge,
    ctx.partnerHorizonAge,
  );

  const phase = resolveCashflowPhase(
    primaryRetired,
    partnerRetired,
    inSurvivorPhase,
  );
  const netLiving = computeNetLivingExpenses(
    row,
    ctx.baseNetLiving,
    ctx.inflationRate,
    ctx.primaryEmploymentEnd,
    ctx.partnerEmploymentEnd,
    {
      baseSurvivorLiving: ctx.baseSurvivorLiving,
      primaryHorizonAge: ctx.primaryHorizonAge,
      partnerHorizonAge: ctx.partnerHorizonAge,
    },
  );

  let pillar3aContribution = 0;
  let bvgEmployeeContribution = 0;

  if (!primaryRetired && !primaryDeceased) {
    const c = activePersonContributions(
      ctx.primary,
      row.primaryAge,
      ctx.primaryEmploymentEnd,
    );
    pillar3aContribution += c.pillar3a;
    bvgEmployeeContribution += c.bvg;
  }

  if (
    ctx.partner &&
    row.partnerAge != null &&
    !partnerRetired &&
    !partnerDeceased
  ) {
    const c = activePersonContributions(
      ctx.partner,
      row.partnerAge,
      ctx.partnerEmploymentEnd ?? ctx.primaryEmploymentEnd,
    );
    pillar3aContribution += c.pillar3a;
    bvgEmployeeContribution += c.bvg;
  }

  const grossCashNeed = netLiving + retirementTax;
  const netWithdrawal = Math.max(0, grossCashNeed - pensionIncome);

  return {
    phase,
    netLiving,
    employmentIncomeNet: 0,
    pensionIncome,
    pillar3aContribution,
    bvgEmployeeContribution,
    retirementTax,
    grossCashNeed,
    netWithdrawal,
  };
}

function currentAgeFromBirthDate(birthDate: string): number {
  const birth = new Date(birthDate);
  const ref = new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function buildHouseholdCashflowContext(
  household: {
    primary: ProfileForScenario;
    partner: ProfileForScenario | null;
  },
  primaryResult: {
    summary: { employmentEndAge: number };
    bvg: BvgResult;
    pillar3a: Pillar3aResult;
  },
  partnerResult: {
    summary: { employmentEndAge: number };
    bvg: BvgResult;
    pillar3a: Pillar3aResult;
  } | null,
  inflationRate: number,
  resolvedWorkloads?: {
    primary: WorkloadReduction[];
    partner?: WorkloadReduction[];
  },
  overrides?: Pick<ScenarioOverrides, "freeAssets"> | null,
): HouseholdCashflowContext {
  const primaryHorizonAge = household.primary.planningHorizonAge ?? 95;
  const partnerHorizonAge =
    household.partner?.planningHorizonAge ?? primaryHorizonAge;

  return {
    baseNetLiving: household.primary.annualRetirementExpenses ?? 0,
    baseSurvivorLiving: household.primary.annualSurvivorExpenses ?? 0,
    inflationRate,
    portfolioReturnRate: portfolioReturnRateFromScenario(
      household.primary,
      household.partner,
      overrides,
    ),
    primaryEmploymentEnd: primaryResult.summary.employmentEndAge,
    partnerEmploymentEnd: partnerResult?.summary.employmentEndAge,
    primaryHorizonAge,
    partnerHorizonAge: household.partner ? partnerHorizonAge : undefined,
    primary: {
      profile: household.primary,
      employmentEndAge: primaryResult.summary.employmentEndAge,
      currentAge: currentAgeFromBirthDate(household.primary.birthDate),
      bvg: primaryResult.bvg,
      pillar3a: primaryResult.pillar3a,
      workloadReductions:
        resolvedWorkloads?.primary ??
        normalizeWorkloadReductions(household.primary.workloadReductions),
    },
    partner:
      household.partner && partnerResult
        ? {
            profile: household.partner,
            employmentEndAge: partnerResult.summary.employmentEndAge,
            currentAge: currentAgeFromBirthDate(household.partner.birthDate),
            bvg: partnerResult.bvg,
            pillar3a: partnerResult.pillar3a,
            workloadReductions:
              resolvedWorkloads?.partner ??
              normalizeWorkloadReductions(household.partner.workloadReductions),
          }
        : undefined,
  };
}

export function cashflowPhaseLabel(phase: HouseholdCashflowPhase): string {
  switch (phase) {
    case "accumulation":
      return "Erwerbsphase";
    case "mixed":
      return "Mischphase";
    case "full_retirement":
      return "Vollpension";
    case "survivor":
      return "Hinterbliebenenphase";
  }
}

export const computeInflatedNetLiving = computeNetLivingExpenses;

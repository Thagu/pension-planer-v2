/**
 * Haushalt / Paar-Orchestrierung
 */

import type { FreeAssetsYearProjection } from "./modules/free-assets";
import { applyCoupleAhvPlafonierung } from "./modules/ahv-couple";
import {
  buildHouseholdCashflowContext,
  computeHouseholdYearCashflow,
  type HouseholdCashflowContext,
} from "./household-cashflow";
import {
  applyWealthYearCashflow,
  calculatePortfolioInterestFromRate,
} from "./wealth-cashflow";
import {
  calculateScenarioPension,
  recalculateScenarioPensionFreeAssets,
  resolveWorkloadReductions,
  type ScenarioOverrides,
  type ScenarioPensionResult,
} from "./orchestrator";
import type {
  CombinedWealthYearProjection,
  HouseholdProfileForScenario,
} from "@/lib/household/types";
import { normalizeInheritanceEvents } from "./inheritance";
import { inflationRateFromProfile } from "./inflation";
import { normalizeMaritalStatus } from "@/lib/tax/types";

export type HouseholdPensionResult = {
  planningMode: "single" | "couple";
  primary: ScenarioPensionResult;
  partner: ScenarioPensionResult | null;
  combinedProjection: CombinedWealthYearProjection[];
  householdRetirementAge: number;
  ahvCouplePlafonierungApplied?: boolean;
  ahvCoupleCapYearly?: number;
};

function ageFromBirth(birthDate: string, year: number): number {
  const birth = new Date(birthDate);
  let age = year - birth.getFullYear();
  const ref = new Date(year, birth.getMonth(), birth.getDate());
  const now = new Date(year, 0, 1);
  if (ref > now) age--;
  return age;
}

function stripHouseholdExpenses(
  profile: HouseholdProfileForScenario["primary"],
): typeof profile {
  return { ...profile, annualRetirementExpenses: 0 };
}

function inheritanceForPerson(
  events: ReturnType<typeof normalizeInheritanceEvents>,
  role: "primary" | "partner",
): typeof events {
  if (role === "primary") {
    return events.filter(
      (event) =>
        (event.recipient ?? "household") === "household" ||
        event.recipient === "primary",
    );
  }
  return events.filter((event) => event.recipient === "partner");
}

function emptyProjection(age: number, year: number): FreeAssetsYearProjection {
  return {
    age,
    year,
    capitalStart: 0,
    capitalEnd: 0,
    savingsContribution: 0,
    interest: 0,
    capitalInjection: 0,
    bvgCapitalInjection: 0,
    pillar3aCapitalInjection: 0,
    inheritanceInjection: 0,
    annualGrossExpenses: 0,
    annualPensionOffset: 0,
    annualWithdrawal: 0,
    annualPensionIncome: 0,
    annualTotalIncome: 0,
    annualTotalExpenses: 0,
    cumulativeIncome: 0,
    cumulativeExpenses: 0,
    annualTaxableAdditionalIncome: 0,
    annualFederalTax: 0,
    annualCantonalTax: 0,
    annualMunicipalTax: 0,
    annualTotalTax: 0,
  };
}

function inheritanceFromProjection(row: FreeAssetsYearProjection): number {
  if (row.inheritanceInjection > 0) return row.inheritanceInjection;
  const other =
    row.capitalInjection -
    row.bvgCapitalInjection -
    row.pillar3aCapitalInjection;
  return Math.max(0, other);
}

function resolvePersonProjection(
  row: FreeAssetsYearProjection | undefined,
  age: number,
  year: number,
  horizonAge?: number,
): FreeAssetsYearProjection {
  if (horizonAge != null && age >= horizonAge) {
    return emptyProjection(age, year);
  }
  return row ?? emptyProjection(age, year);
}

function combineYearRows(
  primaryBirth: string,
  partnerBirth: string | null,
  primaryRow: FreeAssetsYearProjection | undefined,
  partnerRow: FreeAssetsYearProjection | undefined,
  year: number,
  options?: {
    primaryHorizonAge?: number;
    partnerHorizonAge?: number;
  },
): CombinedWealthYearProjection {
  const primaryAge =
    primaryRow?.age ?? ageFromBirth(primaryBirth, year);
  const partnerAge =
    partnerRow?.age ??
    (partnerBirth ? ageFromBirth(partnerBirth, year) : null);
  const primary = resolvePersonProjection(
    primaryRow,
    primaryAge,
    year,
    options?.primaryHorizonAge,
  );
  const partner =
    partnerAge != null
      ? resolvePersonProjection(
          partnerRow,
          partnerAge,
          year,
          options?.partnerHorizonAge,
        )
      : emptyProjection(0, year);

  const inheritanceInjection =
    inheritanceFromProjection(primary) + inheritanceFromProjection(partner);

  return {
    year,
    primaryAge,
    partnerAge,
    capitalStart: primary.capitalStart + partner.capitalStart,
    capitalEnd: primary.capitalEnd + partner.capitalEnd,
    primaryCapitalEnd: primary.capitalEnd,
    partnerCapitalEnd: partner.capitalEnd,
    savingsContribution:
      primary.savingsContribution + partner.savingsContribution,
    interest: primary.interest + partner.interest,
    capitalInjection: primary.capitalInjection + partner.capitalInjection,
    annualPensionIncome:
      primary.annualPensionIncome + partner.annualPensionIncome,
    annualTotalIncome: primary.annualTotalIncome + partner.annualTotalIncome,
    annualTotalExpenses:
      primary.annualTotalExpenses + partner.annualTotalExpenses,
    annualGrossExpenses:
      primary.annualGrossExpenses + partner.annualGrossExpenses,
    annualWithdrawal: primary.annualWithdrawal + partner.annualWithdrawal,
    annualTotalTax: primary.annualTotalTax + partner.annualTotalTax,
    cumulativeIncome: primary.cumulativeIncome + partner.cumulativeIncome,
    cumulativeExpenses:
      primary.cumulativeExpenses + partner.cumulativeExpenses,
    inheritanceInjection,
    bvgCapitalInjection:
      primary.bvgCapitalInjection + partner.bvgCapitalInjection,
    pillar3aCapitalInjection:
      primary.pillar3aCapitalInjection + partner.pillar3aCapitalInjection,
    primaryBvgCapitalInjection: primary.bvgCapitalInjection,
    partnerBvgCapitalInjection: partner.bvgCapitalInjection,
    primaryPillar3aCapitalInjection: primary.pillar3aCapitalInjection,
    partnerPillar3aCapitalInjection: partner.pillar3aCapitalInjection,
  };
}

function isPartnerYounger(
  primaryBirth: string,
  partnerBirth: string,
): boolean {
  return new Date(partnerBirth) > new Date(primaryBirth);
}

function horizonEndYear(
  birthDate: string,
  horizonAge: number,
): number {
  return new Date(birthDate).getFullYear() + horizonAge;
}

type FirstDeathEvent = {
  deceased: "primary" | "partner";
  deathYear: number;
  horizonAge: number;
};

/** First partner to reach planning horizon age is modeled as deceased. */
function firstDeathEvent(
  primaryBirth: string,
  partnerBirth: string,
  primaryHorizonAge: number,
  partnerHorizonAge: number,
): FirstDeathEvent {
  const primaryDeathYear = horizonEndYear(primaryBirth, primaryHorizonAge);
  const partnerDeathYear = horizonEndYear(partnerBirth, partnerHorizonAge);

  if (primaryDeathYear <= partnerDeathYear) {
    return {
      deceased: "primary",
      deathYear: primaryDeathYear,
      horizonAge: primaryHorizonAge,
    };
  }
  return {
    deceased: "partner",
    deathYear: partnerDeathYear,
    horizonAge: partnerHorizonAge,
  };
}

/** Vermögen des Verstorbenen geht an den überlebenden Partner. */
function applySurvivorWealthTransfer(
  rows: CombinedWealthYearProjection[],
  primaryBirth: string,
  partnerBirth: string,
  primaryHorizonAge: number,
  partnerHorizonAge: number,
): CombinedWealthYearProjection[] {
  if (rows.length === 0) return rows;

  const death = firstDeathEvent(
    primaryBirth,
    partnerBirth,
    primaryHorizonAge,
    partnerHorizonAge,
  );
  const horizonIdx = rows.findIndex((row) => row.year >= death.deathYear);
  if (horizonIdx < 0) return rows;

  const deceasedIsPrimary = death.deceased === "primary";
  const transferAmount = deceasedIsPrimary
    ? rows[horizonIdx].primaryCapitalEnd
    : rows[horizonIdx].partnerCapitalEnd;
  if (transferAmount <= 0) return rows;

  return rows.map((row, index) => {
    if (index < horizonIdx) return row;

    const primaryCapitalEnd = deceasedIsPrimary
      ? 0
      : row.primaryCapitalEnd + transferAmount;
    const partnerCapitalEnd = deceasedIsPrimary
      ? row.partnerCapitalEnd + transferAmount
      : 0;
    const capitalEnd = primaryCapitalEnd + partnerCapitalEnd;
    const survivorWealthTransfer =
      index === horizonIdx ? transferAmount : undefined;

    let capitalStart = row.capitalStart;
    if (index === horizonIdx) {
      capitalStart = rows[horizonIdx - 1]?.capitalEnd ?? row.capitalStart;
    } else if (index > horizonIdx) {
      capitalStart = rows[index - 1]?.capitalEnd ?? row.capitalStart;
    }

    return {
      ...row,
      capitalStart,
      primaryCapitalEnd,
      partnerCapitalEnd,
      capitalEnd,
      survivorWealthTransfer,
      inheritanceInjection:
        row.inheritanceInjection + (survivorWealthTransfer ?? 0),
    };
  });
}

function applyHouseholdCashflowToRow(
  row: CombinedWealthYearProjection,
  cashflow: ReturnType<typeof computeHouseholdYearCashflow>,
  poolStart: number,
  portfolioReturnRate: number,
): CombinedWealthYearProjection {
  const portfolioInterest = calculatePortfolioInterestFromRate(
    poolStart,
    row.savingsContribution,
    portfolioReturnRate,
  );

  if (cashflow.phase === "accumulation") {
    const { capitalEnd } = applyWealthYearCashflow({
      poolStart,
      savingsContribution: row.savingsContribution,
      portfolioInterest,
      capitalInjection: row.capitalInjection,
      netWithdrawal: 0,
      annualTotalTax: row.annualTotalTax,
    });
    return {
      ...row,
      capitalStart: poolStart,
      interest: portfolioInterest,
      capitalEnd,
    };
  }

  const { capitalEnd, withdrawalFromPrincipal } = applyWealthYearCashflow({
    poolStart,
    savingsContribution: row.savingsContribution,
    portfolioInterest,
    capitalInjection: row.capitalInjection,
    netWithdrawal: cashflow.netWithdrawal,
    annualTotalTax: row.annualTotalTax,
  });

  return {
    ...row,
    capitalStart: poolStart,
    interest: portfolioInterest,
    capitalEnd,
    annualGrossExpenses: cashflow.grossCashNeed,
    annualWithdrawal: withdrawalFromPrincipal,
    annualTotalExpenses: cashflow.grossCashNeed,
    netLivingExpenses: cashflow.netLiving,
    employmentIncomeNet: cashflow.employmentIncomeNet,
    cashflowPhase: cashflow.phase,
    pillar3aContributionActive: cashflow.pillar3aContribution,
    bvgEmployeeContributionActive: cashflow.bvgEmployeeContribution,
  };
}

export function mergeWealthProjections(
  primaryBirth: string,
  partnerBirth: string | null,
  primaryProj: FreeAssetsYearProjection[],
  partnerProj: FreeAssetsYearProjection[] | null,
  householdExpenses: number,
  householdRetirementAge: number,
  options?: {
    primaryHorizonAge?: number;
    partnerHorizonAge?: number;
    applySurvivorTransfer?: boolean;
    householdCashflowContext?: HouseholdCashflowContext;
  },
): CombinedWealthYearProjection[] {
  const primaryByYear = new Map(primaryProj.map((row) => [row.year, row]));
  const partnerByYear = new Map(
    (partnerProj ?? []).map((row) => [row.year, row]),
  );

  const allYears = [
    ...new Set([
      ...primaryByYear.keys(),
      ...partnerByYear.keys(),
    ]),
  ].sort((a, b) => a - b);

  if (allYears.length === 0) return [];

  const minYear = allYears[0];
  let maxYear = allYears[allYears.length - 1];

  if (partnerBirth && options?.partnerHorizonAge != null) {
    const youngerEndYear =
      isPartnerYounger(primaryBirth, partnerBirth)
        ? horizonEndYear(partnerBirth, options.partnerHorizonAge)
        : horizonEndYear(primaryBirth, options.primaryHorizonAge ?? options.partnerHorizonAge);
    maxYear = Math.max(maxYear, youngerEndYear);
  } else if (options?.primaryHorizonAge != null) {
    maxYear = Math.max(
      maxYear,
      horizonEndYear(primaryBirth, options.primaryHorizonAge),
    );
  }

  const years: number[] = [];
  for (let year = minYear; year <= maxYear; year++) {
    years.push(year);
  }

  let poolCapital: number | null = null;

  const merged = years.map((year) => {
    const row = combineYearRows(
      primaryBirth,
      partnerBirth,
      primaryByYear.get(year),
      partnerByYear.get(year),
      year,
      {
        primaryHorizonAge: options?.primaryHorizonAge,
        partnerHorizonAge: options?.partnerHorizonAge,
      },
    );

    if (options?.householdCashflowContext) {
      const poolStart = poolCapital ?? row.capitalStart;
      const cashflow = computeHouseholdYearCashflow(
        row,
        options.householdCashflowContext,
        row.annualPensionIncome,
        row.annualTotalTax,
      );
      const adjusted = applyHouseholdCashflowToRow(
        row,
        cashflow,
        poolStart,
        options.householdCashflowContext.portfolioReturnRate,
      );
      poolCapital = adjusted.capitalEnd;
      return adjusted;
    }

    if (
      householdExpenses > 0 &&
      row.primaryAge >= householdRetirementAge
    ) {
      const withdrawal = Math.max(
        0,
        householdExpenses - row.annualPensionIncome,
      );
      row.annualWithdrawal = withdrawal;
      row.annualGrossExpenses = householdExpenses;
      row.annualTotalExpenses = householdExpenses + row.annualTotalTax;
    }

    return row;
  });

  if (
    options?.applySurvivorTransfer &&
    !options?.householdCashflowContext &&
    partnerBirth &&
    options.primaryHorizonAge != null &&
    options.partnerHorizonAge != null
  ) {
    return applySurvivorWealthTransfer(
      merged,
      primaryBirth,
      partnerBirth,
      options.primaryHorizonAge,
      options.partnerHorizonAge,
    );
  }

  return merged;
}

function shouldApplyCoupleAhvPlafonierung(
  household: HouseholdProfileForScenario,
): boolean {
  if (household.planningMode !== "couple" || !household.partner) return false;
  return (
    normalizeMaritalStatus(household.primary.taxSettings?.maritalStatus) ===
    "married"
  );
}

function applyCoupleAhvToResults(
  household: HouseholdProfileForScenario,
  primaryResult: ScenarioPensionResult,
  partnerResult: ScenarioPensionResult,
  primaryOverrides: ScenarioOverrides,
  partnerOverrides: ScenarioOverrides,
): {
  primary: ScenarioPensionResult;
  partner: ScenarioPensionResult;
  plafonierung: ReturnType<typeof applyCoupleAhvPlafonierung>;
} {
  const plafonierung = applyCoupleAhvPlafonierung(
    primaryResult.ahv.yearlyPension,
    partnerResult.ahv.yearlyPension,
  );

  const primary = recalculateScenarioPensionFreeAssets(
    household.primary,
    primaryOverrides,
    primaryResult,
    plafonierung.primaryYearly,
  );
  const partner = recalculateScenarioPensionFreeAssets(
    stripHouseholdExpenses(household.partner!),
    partnerOverrides,
    partnerResult,
    plafonierung.partnerYearly,
  );

  return { primary, partner, plafonierung };
}

export function calculateHouseholdPension(
  household: HouseholdProfileForScenario,
  overrides: ScenarioOverrides = {},
): HouseholdPensionResult {
  const { partner: partnerOverrides, inheritance, ...primaryOverrides } =
    overrides;

  const sharedInheritance = normalizeInheritanceEvents(inheritance);
  const coupleMode =
    household.planningMode === "couple" && household.partner != null;

  let primaryResult = calculateScenarioPension(
    coupleMode
      ? stripHouseholdExpenses(household.primary)
      : household.primary,
    {
      ...primaryOverrides,
      inheritance: inheritanceForPerson(sharedInheritance, "primary"),
    },
  );

  let partnerResult: ScenarioPensionResult | null = null;
  let ahvCouplePlafonierungApplied = false;
  let ahvCoupleCapYearly: number | undefined;

  if (coupleMode) {
    partnerResult = calculateScenarioPension(
      stripHouseholdExpenses(household.partner!),
      {
        ...(partnerOverrides ?? {}),
        inheritance: inheritanceForPerson(sharedInheritance, "partner"),
      },
    );

    if (shouldApplyCoupleAhvPlafonierung(household)) {
      const adjusted = applyCoupleAhvToResults(
        household,
        primaryResult,
        partnerResult,
        { ...primaryOverrides, inheritance: inheritanceForPerson(sharedInheritance, "primary") },
        {
          ...(partnerOverrides ?? {}),
          inheritance: inheritanceForPerson(sharedInheritance, "partner"),
        },
      );
      primaryResult = adjusted.primary;
      partnerResult = adjusted.partner;
      ahvCouplePlafonierungApplied = adjusted.plafonierung.capApplied;
      ahvCoupleCapYearly = adjusted.plafonierung.capYearly;
    }
  }

  const householdRetirementAge = Math.max(
    primaryResult.summary.employmentEndAge,
    partnerResult?.summary.employmentEndAge ?? 0,
  );

  const primaryHorizonAge = household.primary.planningHorizonAge ?? 95;
  const partnerHorizonAge =
    household.partner?.planningHorizonAge ?? primaryHorizonAge;

  const householdInflation = inflationRateFromProfile(
    household.primary.inflationRate,
  );

  const householdCashflowContext = coupleMode
    ? buildHouseholdCashflowContext(
        household,
        primaryResult,
        partnerResult,
        householdInflation,
        {
          primary: resolveWorkloadReductions(
            household.primary,
            primaryOverrides,
          ),
          partner: household.partner
            ? resolveWorkloadReductions(
                household.partner,
                partnerOverrides ?? {},
              )
            : undefined,
        },
        primaryOverrides,
      )
    : undefined;

  const combinedProjection = mergeWealthProjections(
    household.primary.birthDate,
    household.partner?.birthDate ?? null,
    primaryResult.freeAssets?.projection ?? [],
    partnerResult?.freeAssets?.projection ?? [],
    household.primary.annualRetirementExpenses ?? 0,
    householdRetirementAge,
    coupleMode
      ? {
          primaryHorizonAge,
          partnerHorizonAge,
          applySurvivorTransfer: true,
          householdCashflowContext,
        }
      : { primaryHorizonAge },
  );

  return {
    planningMode: household.planningMode,
    primary: primaryResult,
    partner: partnerResult,
    combinedProjection,
    householdRetirementAge,
    ahvCouplePlafonierungApplied,
    ahvCoupleCapYearly,
  };
}

export function combinedProjectionToFreeAssets(
  rows: CombinedWealthYearProjection[],
): FreeAssetsYearProjection[] {
  return rows.map((row) => ({
    age: row.primaryAge,
    year: row.year,
    capitalStart: row.capitalStart,
    capitalEnd: row.capitalEnd,
    savingsContribution: row.savingsContribution,
    interest: row.interest,
    capitalInjection: row.capitalInjection,
    bvgCapitalInjection: row.bvgCapitalInjection,
    pillar3aCapitalInjection: row.pillar3aCapitalInjection,
    inheritanceInjection: row.inheritanceInjection,
    annualGrossExpenses: row.annualGrossExpenses,
    annualPensionOffset: Math.min(
      row.netLivingExpenses ?? row.annualGrossExpenses,
      row.annualPensionIncome,
    ),
    annualWithdrawal: row.annualWithdrawal,
    annualPensionIncome: row.annualPensionIncome,
    annualTotalIncome: row.annualTotalIncome,
    annualTotalExpenses: row.annualTotalExpenses,
    cumulativeIncome: row.cumulativeIncome,
    cumulativeExpenses: row.cumulativeExpenses,
    annualTaxableAdditionalIncome: 0,
    annualFederalTax: 0,
    annualCantonalTax: 0,
    annualMunicipalTax: 0,
    annualTotalTax: row.annualTotalTax,
  }));
}

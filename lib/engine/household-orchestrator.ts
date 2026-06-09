/**
 * Haushalt / Paar-Orchestrierung
 */

import type { FreeAssetsYearProjection } from "./modules/free-assets";
import { applyCoupleAhvPlafonierung } from "./modules/ahv-couple";
import {
  calculateScenarioPension,
  recalculateScenarioPensionFreeAssets,
  type ScenarioOverrides,
  type ScenarioPensionResult,
} from "./orchestrator";
import type {
  CombinedWealthYearProjection,
  HouseholdProfileForScenario,
} from "@/lib/household/types";
import { normalizeInheritanceEvents } from "./inheritance";
import { inflateAmount, inflationRateFromProfile } from "./inflation";
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
  const other =
    row.capitalInjection -
    row.bvgCapitalInjection -
    row.pillar3aCapitalInjection;
  return Math.max(0, other);
}

function combineYearRows(
  primaryBirth: string,
  partnerBirth: string | null,
  primaryRow: FreeAssetsYearProjection | undefined,
  partnerRow: FreeAssetsYearProjection | undefined,
  year: number,
): CombinedWealthYearProjection {
  const primaryAge =
    primaryRow?.age ?? ageFromBirth(primaryBirth, year);
  const partnerAge =
    partnerRow?.age ??
    (partnerBirth ? ageFromBirth(partnerBirth, year) : null);
  const primary = primaryRow ?? emptyProjection(primaryAge, year);
  const partner =
    partnerRow ??
    (partnerAge != null ? emptyProjection(partnerAge, year) : emptyProjection(0, year));

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

/** Vermögen von Person 1 geht an Person 2 beim Planungshorizont von Person 1 */
function applySurvivorWealthTransfer(
  rows: CombinedWealthYearProjection[],
  primaryHorizonAge: number,
  partnerIsYounger: boolean,
): CombinedWealthYearProjection[] {
  if (!partnerIsYounger || rows.length === 0) return rows;

  const horizonIdx = rows.findIndex((row) => row.primaryAge >= primaryHorizonAge);
  if (horizonIdx < 0) return rows;

  const transferAmount = rows[horizonIdx].primaryCapitalEnd;
  if (transferAmount <= 0) return rows;

  return rows.map((row, index) => {
    if (index < horizonIdx) return row;

    const primaryCapitalEnd = 0;
    const partnerCapitalEnd = row.partnerCapitalEnd + transferAmount;
    const capitalEnd = partnerCapitalEnd;
    const survivorWealthTransfer =
      index === horizonIdx ? transferAmount : undefined;

    let capitalStart = row.capitalStart;
    if (index === horizonIdx) {
      capitalStart =
        rows[horizonIdx - 1]?.capitalEnd ??
        row.capitalStart - transferAmount + partnerCapitalEnd;
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

function yearsSinceHouseholdExpenseStart(
  row: CombinedWealthYearProjection,
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
  return Math.min(...candidates);
}

function householdGrossExpenses(
  row: CombinedWealthYearProjection,
  opts: {
    baseExpenses: number;
    primaryEmploymentEnd: number;
    partnerEmploymentEnd?: number;
    primaryPillar3aContribution: number;
    partnerPillar3aContribution?: number;
    inflationRate?: number;
    primaryCurrentAge: number;
    partnerCurrentAge?: number;
  },
): number {
  if (!opts || opts.baseExpenses <= 0) return 0;
  const primaryRetired = row.primaryAge >= opts.primaryEmploymentEnd;
  const partnerRetired =
    opts.partnerEmploymentEnd != null &&
    row.partnerAge != null &&
    row.partnerAge >= opts.partnerEmploymentEnd;
  if (!primaryRetired && !partnerRetired) return 0;

  const inflationRate = opts.inflationRate ?? 0;
  const yearsSinceRetirement = yearsSinceHouseholdExpenseStart(row, opts);
  let expenses = inflateAmount(
    opts.baseExpenses,
    inflationRate,
    yearsSinceRetirement,
  );

  const primaryYearIndex = Math.max(0, row.primaryAge - opts.primaryCurrentAge);
  if (primaryRetired) {
    expenses -= inflateAmount(
      opts.primaryPillar3aContribution,
      inflationRate,
      primaryYearIndex,
    );
  }
  if (partnerRetired && row.partnerAge != null) {
    const partnerYearIndex =
      opts.partnerCurrentAge != null
        ? Math.max(0, row.partnerAge - opts.partnerCurrentAge)
        : primaryYearIndex;
    expenses -= inflateAmount(
      opts.partnerPillar3aContribution ?? 0,
      inflationRate,
      partnerYearIndex,
    );
  }
  return Math.max(0, expenses);
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
    householdExpenseOptions?: {
      baseExpenses: number;
      primaryEmploymentEnd: number;
      partnerEmploymentEnd?: number;
      primaryPillar3aContribution: number;
      partnerPillar3aContribution?: number;
      inflationRate?: number;
      primaryCurrentAge: number;
      partnerCurrentAge?: number;
    };
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

  const merged = years.map((year) => {
    const row = combineYearRows(
      primaryBirth,
      partnerBirth,
      primaryByYear.get(year),
      partnerByYear.get(year),
      year,
    );

    if (options?.householdExpenseOptions) {
      const grossExpenses = householdGrossExpenses(
        row,
        options.householdExpenseOptions,
      );
      if (grossExpenses > 0) {
        const withdrawal = Math.max(0, grossExpenses - row.annualPensionIncome);
        row.annualWithdrawal = withdrawal;
        row.annualGrossExpenses = grossExpenses;
        row.annualTotalExpenses = grossExpenses + row.annualTotalTax;
      }
    } else if (
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
    partnerBirth &&
    options.primaryHorizonAge != null &&
    isPartnerYounger(primaryBirth, partnerBirth)
  ) {
    return applySurvivorWealthTransfer(
      merged,
      options.primaryHorizonAge,
      true,
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

  let primaryResult = calculateScenarioPension(household.primary, {
    ...primaryOverrides,
    inheritance: inheritanceForPerson(sharedInheritance, "primary"),
  });

  let partnerResult: ScenarioPensionResult | null = null;
  let ahvCouplePlafonierungApplied = false;
  let ahvCoupleCapYearly: number | undefined;

  if (household.planningMode === "couple" && household.partner) {
    partnerResult = calculateScenarioPension(
      stripHouseholdExpenses(household.partner),
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

  const primaryHorizonAge = household.primary.planningHorizonAge ?? 90;
  const partnerHorizonAge =
    household.partner?.planningHorizonAge ?? primaryHorizonAge;

  const primaryCurrentAge = ageFromBirth(
    household.primary.birthDate,
    new Date().getFullYear(),
  );
  const householdInflation = inflationRateFromProfile(
    household.primary.inflationRate,
  );
  const partnerCurrentAge =
    household.partner != null
      ? ageFromBirth(
          household.partner.birthDate,
          new Date().getFullYear(),
        )
      : undefined;

  const combinedProjection = mergeWealthProjections(
    household.primary.birthDate,
    household.partner?.birthDate ?? null,
    primaryResult.freeAssets?.projection ?? [],
    partnerResult?.freeAssets?.projection ?? null,
    household.primary.annualRetirementExpenses ?? 0,
    householdRetirementAge,
    household.planningMode === "couple" && household.partner
      ? {
          primaryHorizonAge,
          partnerHorizonAge,
          applySurvivorTransfer: true,
          householdExpenseOptions: {
            baseExpenses: household.primary.annualRetirementExpenses ?? 0,
            primaryEmploymentEnd: primaryResult.summary.employmentEndAge,
            partnerEmploymentEnd:
              partnerResult?.summary.employmentEndAge ?? undefined,
            primaryPillar3aContribution:
              primaryResult.pillar3a.totalAnnualContribution,
            partnerPillar3aContribution:
              partnerResult?.pillar3a.totalAnnualContribution ?? 0,
            inflationRate: householdInflation,
            primaryCurrentAge,
            partnerCurrentAge,
          },
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
    annualGrossExpenses: row.annualGrossExpenses,
    annualPensionOffset: Math.min(
      row.annualGrossExpenses,
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

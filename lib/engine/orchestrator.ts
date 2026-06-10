/**
 * Szenario-Orchestrator
 * =====================
 * Kombiniert die modularen Berechnungen (AHV, BVG, 3a, freies Vermögen)
 * zu einem Gesamtergebnis. Jedes Modul bleibt einzeln aufrufbar/testbar.
 */

import {
  BVG_CONVERSION_RATE,
  BVG_MIN_INTEREST_RATE,
  DEFAULT_ASSUMPTIONS,
} from "./constants";
import { calculateAhvPension, type AhvInput, type AhvResult } from "./modules/ahv";
import { calculateBvgPension, type BvgInput, type BvgResult } from "./modules/bvg";
import {
  calculateFreeAssetsPension,
  type CapitalInjection,
  type FreeAssetsInput,
  type FreeAssetsResult,
} from "./modules/free-assets";
import {
  calculatePillar3a,
  type Pillar3aAccountInput,
  type Pillar3aInput,
  type Pillar3aResult,
} from "./modules/pillar3a";
import { defaultWithdrawalSchedule } from "@/lib/pillar3a/accounts";
import { taxSettingsFromScenarioProfile } from "@/lib/tax/profile-tax";
import { normalizeDbRate } from "@/lib/format/numbers";
import { parseDbAmount } from "@/lib/format/db-numbers";
import {
  resolveAhvPensionStartAge,
  resolveBvgPensionStartAge,
  resolveEmploymentEndAge,
} from "./legal-ages";
import {
  normalizeWorkloadReductions,
  projectedAverageIncome,
  type WorkloadReduction,
} from "./workload";
import {
  normalizeInheritanceEvents,
} from "./inheritance";
import { inflationRateFromProfile } from "./inflation";
import type { InheritanceEvent } from "@/lib/household/types";

function currentAgeFromBirthDate(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function resolveWorkloadReductions(
  profile: ProfileForScenario,
  overrides: ScenarioOverrides,
): WorkloadReduction[] {
  if (overrides.workloadReductions !== undefined) {
    return normalizeWorkloadReductions(overrides.workloadReductions);
  }
  return normalizeWorkloadReductions(profile.workloadReductions);
}

export interface Pillar3aAccountForScenario {
  id: string;
  name: string;
  currentCapital: number;
  annualContribution: number;
  returnRate?: number | null;
}

export interface ScenarioOverrides {
  description?: string;
  ahv?: {
    /** Erwerbsaufgabe (Ende Erwerbstätigkeit) */
    employmentEndAgeOverride?: number | null;
    /** @deprecated Alias für employmentEndAgeOverride */
    retirementAgeOverride?: number | null;
    /** AHV-Rentenbeginn (Standard: Referenzalter, z. B. 65) */
    pensionStartAgeOverride?: number | null;
    missingContributionYears?: number;
    averageIncomeOverride?: number | null;
  };
  bvg?: {
    /** BVG-Leistungsbeginn (Standard: max(Erwerbsaufgabe, 58)) */
    pensionStartAgeOverride?: number | null;
    conversionRateOverride?: number | null;
    interestRateOverride?: number | null;
    coordinationDeductionMode?: "standard" | "none" | "custom" | null;
    customContributionRates?: Record<string, number> | null;
    /** Kapitalbezug 0–100 (Prozent des Alterskapitals) */
    capitalWithdrawalPercent?: number | null;
    /** Anzahl Tranchen für Kapitalbezug (1–5) */
    capitalWithdrawalTranches?: number | null;
  };
  pillar3a?: {
    /** Bezugsplan: Jahre nach BVG-Leistungsbeginn pro Konto */
    withdrawalSchedule?: Record<string, number>;
    /** Festes Bezugsalter pro Konto (optional) */
    withdrawalAgeOverrides?: Record<string, number | null>;
    /** Optionale Annahmen-Overrides pro Konto */
    accountOverrides?: Record<
      string,
      {
        currentCapitalOverride?: number | null;
        annualContributionOverride?: number | null;
        returnRateOverride?: number | null;
      }
    >;
  };
  freeAssets?: {
    currentValueOverride?: number | null;
    returnRateOverride?: number | null;
  };
  /** Ersetzt Profil-Reduktionen wenn gesetzt (Szenario) */
  workloadReductions?: WorkloadReduction[] | null;
  /** Erbschaft / Schenkung – Zufluss ins freie Vermögen */
  inheritance?: InheritanceEvent[] | null;
  /** Partner-Szenario-Overrides (Paarmodus) */
  partner?: ScenarioOverrides | null;
}

export interface ProfileForScenario {
  birthDate: string;
  gender?: "male" | "female" | null;
  employmentStartYear?: number | null;
  retirementAge: number;
  currentSalaryBrutto: number;
  bvgCurrentCapital: number;
  freeAssets: number;
  bvgInterestRate?: number | null;
  bvgConversionRate?: number | null;
  bvgContributionRates?: Record<string, number> | null;
  bvgCoordinatedSalaryOverride?: number | null;
  freeAssetsInterestRate?: number | null;
  annualSavingsToFreeAssets?: number | null;
  pillar3aDefaultReturnRate?: number | null;
  pillar3aAccounts?: Pillar3aAccountForScenario[];
  pillar3aAutoSplit?: {
    enabled: boolean;
    threshold: number;
    contributionMode: "max" | "last";
    namePrefix: string;
  };
  planningHorizonAge?: number | null;
  annualRetirementExpenses?: number | null;
  /** Netto-Lebenshaltung wenn nur ein Partner lebt (Paarmodus, heutige Kaufkraft) */
  annualSurvivorExpenses?: number | null;
  /** Bis zu 2 Arbeitspensum-Reduktionen ab Alter */
  workloadReductions?: WorkloadReduction[];
  taxSettings?: import("@/lib/tax/additional-income-tax").TaxSettings;
  /** Annual inflation (decimal); master data only */
  inflationRate?: number | null;
}

export interface ScenarioPensionResult {
  ahv: AhvResult;
  bvg: BvgResult;
  pillar3a: Pillar3aResult;
  freeAssets: FreeAssetsResult | null;
  summary: {
    monthlyAhv: number;
    monthlyBvg: number;
    monthlyFreeAssets: number;
    monthlyTotal: number;
    yearlyTotal: number;
    projectedCapitalBvg: number;
    projectedCapitalPillar3a: number;
    projectedCapitalFreeAssets: number;
    totalCapitalInjectionsToFreeAssets: number;
    bvgCapitalToFreeAssets: number;
    pillar3aCapitalToFreeAssets: number;
    employmentEndAge: number;
    ahvPensionStartAge: number;
    bvgPensionStartAge: number;
    /** Monatliches Einkommen ab Erwerbsaufgabe */
    monthlyTotalAtEmploymentEnd: number;
    /** Monatliches Einkommen wenn alle Renten aktiv (Planungshorizont) */
    monthlyTotalAtHorizon: number;
  };
}

export function rateFromProfileDb(
  value: number | null | undefined,
  fallbackDecimal: number,
): number {
  return normalizeDbRate(value, fallbackDecimal);
}

/** Szenario-Formular: Kapitalbezug etc. als 0–100 (Prozent) */
export function rateFromScenarioPercent(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value / 100;
}

/**
 * Szenario-Override für Zinssatz/UWS/Rendite: Formular liefert meist Prozent (6.8),
 * gespeicherte JSON-Werte können Dezimal (0.068) sein – wie bei Stammdaten normalisieren.
 */
export function rateFromScenarioOverride(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return normalizeDbRate(value, 0);
}

/** @deprecated Verwende rateFromProfileDb oder rateFromScenarioPercent */
export function normalizeRate(
  value: number | null | undefined,
  fallback: number,
): number {
  return rateFromProfileDb(value, fallback);
}

export function contributionRatesFromProfileDb(
  rates: Record<string, number> | null | undefined,
): Record<string, number> | undefined {
  if (!rates) return undefined;
  return Object.fromEntries(
    Object.entries(rates).map(([k, v]) => [k, normalizeDbRate(v, 0)]),
  );
}

export function contributionRatesFromScenarioPercent(
  rates: Record<string, number> | null | undefined,
): Record<string, number> | undefined {
  if (!rates) return undefined;
  return Object.fromEntries(
    Object.entries(rates).map(([k, v]) => [k, v / 100]),
  );
}

/** BVG-Beitragssätze: JSON kann % (7) oder Dezimal (0.07) enthalten */
export function normalizeContributionRates(
  rates: Record<string, number> | null | undefined,
): Record<string, number> | undefined {
  return contributionRatesFromProfileDb(rates);
}

function buildPillar3aAccountInputs(
  profile: ProfileForScenario,
  overrides: ScenarioOverrides,
): Pillar3aAccountInput[] {
  const accounts = profile.pillar3aAccounts ?? [];
  const accountOverrides = overrides.pillar3a?.accountOverrides ?? {};
  const defaultReturn = rateFromProfileDb(
    profile.pillar3aDefaultReturnRate,
    DEFAULT_ASSUMPTIONS.returnRate3a,
  );

  const accountIds = accounts.map((a) => a.id);
  const schedule = defaultWithdrawalSchedule(
    accountIds,
    overrides.pillar3a?.withdrawalSchedule,
  );

  return accounts.map((account) => {
    const ov = accountOverrides[account.id] ?? {};

    return {
      id: account.id,
      name: account.name,
      currentCapital:
        ov.currentCapitalOverride != null
          ? ov.currentCapitalOverride
          : parseDbAmount(account.currentCapital),
      annualContribution:
        ov.annualContributionOverride != null
          ? ov.annualContributionOverride
          : parseDbAmount(account.annualContribution),
      returnRate:
        ov.returnRateOverride != null
          ? rateFromScenarioOverride(ov.returnRateOverride) ?? defaultReturn
          : account.returnRate != null
            ? rateFromProfileDb(account.returnRate, defaultReturn)
            : defaultReturn,
      withdrawalYearOffset: schedule[account.id] ?? 0,
    };
  });
}

function resolveScenarioAges(
  profile: ProfileForScenario,
  overrides: ScenarioOverrides,
) {
  const employmentEndAge = resolveEmploymentEndAge(
    profile.retirementAge,
    overrides.ahv?.employmentEndAgeOverride ??
      overrides.ahv?.retirementAgeOverride,
  );
  const ahvPensionStartAge = resolveAhvPensionStartAge(
    profile.birthDate,
    profile.gender,
    employmentEndAge,
    overrides.ahv?.pensionStartAgeOverride,
  );
  const bvgPensionStartAge = resolveBvgPensionStartAge(
    employmentEndAge,
    overrides.bvg?.pensionStartAgeOverride,
  );
  return { employmentEndAge, ahvPensionStartAge, bvgPensionStartAge };
}

function buildBvgScheduledInjections(
  bvg: BvgResult,
  bvgPensionStartAge: number,
): CapitalInjection[] {
  const { payout } = bvg;
  if (payout.totalCapitalWithdrawn <= 0 || payout.yearlyWithdrawalPerTranche <= 0) {
    return [];
  }

  const injections: CapitalInjection[] = [];
  for (let i = 0; i < payout.capitalWithdrawalTranches; i++) {
    injections.push({
      atAge: bvgPensionStartAge + i,
      yearOffset: i,
      amount: payout.yearlyWithdrawalPerTranche,
      label: `BVG Kapitalbezug ${i + 1}/${payout.capitalWithdrawalTranches}`,
      source: "bvg",
    });
  }
  return injections;
}

function buildPillar3aScheduledInjections(
  pillar3a: Pillar3aResult,
): CapitalInjection[] {
  return pillar3a.scheduledWithdrawals.map((w) => ({
    atAge: w.withdrawalAge,
    yearOffset: w.yearOffset,
    amount: w.amount,
    label: `3a ${w.accountName}`,
    source: "pillar3a" as const,
  }));
}

function monthlyIncomeAtAge(
  age: number,
  ahv: AhvResult,
  bvg: BvgResult,
  freeAssetsMonthly: number,
): { ahv: number; bvg: number; total: number } {
  const monthlyAhv =
    age >= ahv.pensionStartAge ? ahv.monthlyPension : 0;
  const monthlyBvg =
    age >= bvg.pensionStartAge ? bvg.monthlyPension : 0;
  return {
    ahv: monthlyAhv,
    bvg: monthlyBvg,
    total: monthlyAhv + monthlyBvg + freeAssetsMonthly,
  };
}

export function buildScenarioPensionInput(
  profile: ProfileForScenario,
  overrides: ScenarioOverrides = {},
): {
  ahvInput: AhvInput;
  bvgInput: BvgInput;
  pillar3aInput: Pillar3aInput;
  freeAssetsInput: FreeAssetsInput | null;
  effectiveRetirementAge: number;
  employmentEndAge: number;
  ahvPensionStartAge: number;
  bvgPensionStartAge: number;
} {
  const { employmentEndAge, ahvPensionStartAge, bvgPensionStartAge } =
    resolveScenarioAges(profile, overrides);

  const inflationRate = inflationRateFromProfile(profile.inflationRate);

  const effectiveIncome =
    overrides.ahv?.averageIncomeOverride ?? profile.currentSalaryBrutto;

  const workloadReductions = resolveWorkloadReductions(profile, overrides);
  const currentAge = currentAgeFromBirthDate(profile.birthDate);

  const ahvAverageIncome =
    overrides.ahv?.averageIncomeOverride ??
    projectedAverageIncome(
      profile.currentSalaryBrutto,
      currentAge,
      employmentEndAge,
      workloadReductions,
      inflationRate,
    );

  const ahvInput: AhvInput = {
    birthDate: profile.birthDate,
    gender: profile.gender ?? undefined,
    averageAnnualIncome: ahvAverageIncome,
    employmentEndAge,
    pensionStartAge: ahvPensionStartAge,
    missingContributionYears: overrides.ahv?.missingContributionYears ?? 0,
    inflationRate,
  };

  const bvgInput: BvgInput = {
    birthDate: profile.birthDate,
    currentSalaryBrutto: effectiveIncome,
    currentCapital: profile.bvgCurrentCapital,
    pensionStartAge: bvgPensionStartAge,
    employmentEndAge,
    coordinationDeductionMode:
      overrides.bvg?.coordinationDeductionMode ?? "standard",
    interestRate: overrides.bvg?.interestRateOverride != null
      ? rateFromScenarioOverride(overrides.bvg.interestRateOverride) ?? undefined
      : profile.bvgInterestRate != null
        ? rateFromProfileDb(profile.bvgInterestRate, BVG_MIN_INTEREST_RATE)
        : undefined,
    conversionRate: overrides.bvg?.conversionRateOverride != null
      ? rateFromScenarioOverride(overrides.bvg.conversionRateOverride) ?? undefined
      : profile.bvgConversionRate != null
        ? rateFromProfileDb(profile.bvgConversionRate, BVG_CONVERSION_RATE)
        : undefined,
    customContributionRates:
      overrides.bvg?.customContributionRates != null
        ? contributionRatesFromScenarioPercent(
            overrides.bvg.customContributionRates,
          )
        : contributionRatesFromProfileDb(profile.bvgContributionRates ?? undefined),
    coordinatedSalaryOverride: profile.bvgCoordinatedSalaryOverride ?? null,
    workloadReductions,
    inflationRate,
    payout: {
      capitalWithdrawalPercent:
        rateFromScenarioPercent(overrides.bvg?.capitalWithdrawalPercent ?? 0) ??
        0,
      capitalWithdrawalTranches:
        overrides.bvg?.capitalWithdrawalTranches ?? 1,
    },
  };

  const pillar3aInput: Pillar3aInput = {
    birthDate: profile.birthDate,
    gender: profile.gender,
    employmentEndAge,
    bvgPensionStartAge,
    ahvPensionStartAge,
    accounts: buildPillar3aAccountInputs(profile, overrides),
    autoSplit: profile.pillar3aAutoSplit?.enabled
      ? profile.pillar3aAutoSplit
      : undefined,
    withdrawalSchedule: overrides.pillar3a?.withdrawalSchedule,
    withdrawalAgeOverrides: overrides.pillar3a?.withdrawalAgeOverrides,
    workloadReductions,
    inflationRate,
  };

  const freeAssetsValue =
    overrides.freeAssets?.currentValueOverride ?? profile.freeAssets;

  const annualSavings = profile.annualSavingsToFreeAssets ?? 0;

  const freeAssetsInput: FreeAssetsInput | null =
    freeAssetsValue > 0 || profile.freeAssets > 0 || annualSavings > 0
      ? {
          birthDate: profile.birthDate,
          currentValue: freeAssetsValue,
          retirementAge: employmentEndAge,
          annualSavingsContribution: annualSavings,
          workloadReductions,
          referenceSalaryBrutto: effectiveIncome,
          returnRate:
            overrides.freeAssets?.returnRateOverride != null
              ? rateFromScenarioOverride(overrides.freeAssets.returnRateOverride) ??
                undefined
              : profile.freeAssetsInterestRate != null
                ? rateFromProfileDb(profile.freeAssetsInterestRate, 0)
                : undefined,
        }
      : null;

  return {
    ahvInput,
    bvgInput,
    pillar3aInput,
    freeAssetsInput,
    effectiveRetirementAge: employmentEndAge,
    employmentEndAge,
    ahvPensionStartAge,
    bvgPensionStartAge,
  };
}

export function calculateScenarioPension(
  profile: ProfileForScenario,
  overrides: ScenarioOverrides = {},
): ScenarioPensionResult {
  const {
    ahvInput,
    bvgInput,
    pillar3aInput,
    freeAssetsInput,
    employmentEndAge,
    ahvPensionStartAge,
    bvgPensionStartAge,
  } = buildScenarioPensionInput(profile, overrides);

  const ahv = calculateAhvPension(ahvInput);
  const bvg = calculateBvgPension(bvgInput);
  const pillar3a = calculatePillar3a(pillar3aInput);

  const inheritanceInjections = normalizeInheritanceEvents(
    overrides.inheritance,
  ).map((event) => ({
    atAge: event.atAge,
    amount: event.amount,
    label: "Erbschaft / Schenkung",
    source: "other" as const,
  }));

  const scheduledInjections = [
    ...buildBvgScheduledInjections(bvg, bvgPensionStartAge),
    ...buildPillar3aScheduledInjections(pillar3a),
    ...inheritanceInjections,
  ];

  const planningHorizonAge =
    profile.planningHorizonAge ?? Math.max(employmentEndAge + 10, ahvPensionStartAge);

  const workloadReductions = resolveWorkloadReductions(profile, overrides);

  const referenceSalaryBrutto =
    overrides.ahv?.averageIncomeOverride ?? profile.currentSalaryBrutto;

  const freeAssetsBaseValue =
    freeAssetsInput?.currentValue ?? profile.freeAssets ?? 0;
  const annualSavings = profile.annualSavingsToFreeAssets ?? 0;
  const annualRetirementExpenses = profile.annualRetirementExpenses ?? 0;
  const hasInjections = scheduledInjections.some((i) => i.amount > 0);

  const freeAssets =
    freeAssetsBaseValue > 0 ||
    annualSavings > 0 ||
    hasInjections ||
    annualRetirementExpenses > 0 ||
    planningHorizonAge > employmentEndAge
      ? calculateFreeAssetsPension({
          birthDate: profile.birthDate,
          currentValue: freeAssetsBaseValue,
          retirementAge: employmentEndAge,
          returnRate: freeAssetsInput?.returnRate,
          annualSavingsContribution: annualSavings,
          workloadReductions,
          referenceSalaryBrutto,
          annualPillar3aContribution: pillar3a.totalAnnualContribution,
          scheduledInjections,
          planningHorizonAge,
          annualRetirementExpenses,
          ahvPensionStartAge,
          bvgPensionStartAge,
          ahvYearlyPension: ahv.yearlyPension,
          bvgYearlyPension: bvg.yearlyPension,
          taxSettings: taxSettingsFromScenarioProfile(profile),
          inflationRate: inflationRateFromProfile(profile.inflationRate),
        })
      : null;

  const monthlyFreeAssets = freeAssets?.monthlyIncome ?? 0;
  const atEmploymentEnd = monthlyIncomeAtAge(
    employmentEndAge,
    ahv,
    bvg,
    monthlyFreeAssets,
  );
  const atHorizon = monthlyIncomeAtAge(
    planningHorizonAge,
    ahv,
    bvg,
    monthlyFreeAssets,
  );

  const bvgCapitalToFreeAssets = bvg.payout.totalCapitalWithdrawn;
  const pillar3aCapitalToFreeAssets = pillar3a.totalProjectedCapital;
  const totalCapitalInjectionsToFreeAssets =
    bvgCapitalToFreeAssets + pillar3aCapitalToFreeAssets;

  return {
    ahv,
    bvg,
    pillar3a,
    freeAssets,
    summary: {
      monthlyAhv: atHorizon.ahv,
      monthlyBvg: atHorizon.bvg,
      monthlyFreeAssets,
      monthlyTotal: atHorizon.total,
      yearlyTotal: atHorizon.total * 12,
      projectedCapitalBvg: bvg.projectedCapital,
      projectedCapitalPillar3a: pillar3a.totalProjectedCapital,
      projectedCapitalFreeAssets: freeAssets?.projectedCapital ?? 0,
      totalCapitalInjectionsToFreeAssets,
      bvgCapitalToFreeAssets,
      pillar3aCapitalToFreeAssets,
      employmentEndAge,
      ahvPensionStartAge,
      bvgPensionStartAge,
      monthlyTotalAtEmploymentEnd: atEmploymentEnd.total,
      monthlyTotalAtHorizon: atHorizon.total,
    },
  };
}

/** Freie-Vermögen-Projektion mit angepasster AHV-Rente (z. B. Paar-Plafonierung) */
export function recalculateScenarioPensionFreeAssets(
  profile: ProfileForScenario,
  overrides: ScenarioOverrides,
  previous: ScenarioPensionResult,
  ahvYearlyPension: number,
): ScenarioPensionResult {
  const { bvg, pillar3a } = previous;
  const employmentEndAge = previous.summary.employmentEndAge;
  const ahvPensionStartAge = previous.summary.ahvPensionStartAge;
  const bvgPensionStartAge = previous.summary.bvgPensionStartAge;
  const planningHorizonAge =
    profile.planningHorizonAge ??
    Math.max(employmentEndAge + 10, ahvPensionStartAge);

  const ahv = {
    ...previous.ahv,
    yearlyPension: ahvYearlyPension,
    monthlyPension: Math.round(ahvYearlyPension / 12),
  };

  const inheritanceInjections = normalizeInheritanceEvents(
    overrides.inheritance,
  ).map((event) => ({
    atAge: event.atAge,
    amount: event.amount,
    label: "Erbschaft / Schenkung",
    source: "other" as const,
  }));

  const scheduledInjections = [
    ...buildBvgScheduledInjections(bvg, bvgPensionStartAge),
    ...buildPillar3aScheduledInjections(pillar3a),
    ...inheritanceInjections,
  ];

  const workloadReductions = resolveWorkloadReductions(profile, overrides);
  const referenceSalaryBrutto =
    overrides.ahv?.averageIncomeOverride ?? profile.currentSalaryBrutto;
  const freeAssetsBaseValue = profile.freeAssets ?? 0;
  const annualSavings = profile.annualSavingsToFreeAssets ?? 0;
  const annualRetirementExpenses = profile.annualRetirementExpenses ?? 0;
  const hasInjections = scheduledInjections.some((i) => i.amount > 0);

  const freeAssets =
    freeAssetsBaseValue > 0 ||
    annualSavings > 0 ||
    hasInjections ||
    annualRetirementExpenses > 0 ||
    planningHorizonAge > employmentEndAge
      ? calculateFreeAssetsPension({
          birthDate: profile.birthDate,
          currentValue: freeAssetsBaseValue,
          retirementAge: employmentEndAge,
          returnRate:
            overrides.freeAssets?.returnRateOverride != null
              ? (rateFromScenarioOverride(
                  overrides.freeAssets.returnRateOverride,
                ) ?? undefined)
              : profile.freeAssetsInterestRate != null
                ? profile.freeAssetsInterestRate
                : undefined,
          annualSavingsContribution: annualSavings,
          workloadReductions,
          referenceSalaryBrutto,
          annualPillar3aContribution: pillar3a.totalAnnualContribution,
          scheduledInjections,
          planningHorizonAge,
          annualRetirementExpenses,
          ahvPensionStartAge,
          bvgPensionStartAge,
          ahvYearlyPension: ahv.yearlyPension,
          bvgYearlyPension: bvg.yearlyPension,
          taxSettings: taxSettingsFromScenarioProfile(profile),
          inflationRate: inflationRateFromProfile(profile.inflationRate),
        })
      : null;

  const monthlyFreeAssets = freeAssets?.monthlyIncome ?? 0;
  const atEmploymentEnd = monthlyIncomeAtAge(
    employmentEndAge,
    ahv,
    bvg,
    monthlyFreeAssets,
  );
  const atHorizon = monthlyIncomeAtAge(
    planningHorizonAge,
    ahv,
    bvg,
    monthlyFreeAssets,
  );

  return {
    ahv,
    bvg,
    pillar3a,
    freeAssets,
    summary: {
      ...previous.summary,
      monthlyAhv: atHorizon.ahv,
      monthlyBvg: atHorizon.bvg,
      monthlyFreeAssets,
      monthlyTotal: atHorizon.total,
      yearlyTotal: atHorizon.total * 12,
      projectedCapitalFreeAssets: freeAssets?.projectedCapital ?? 0,
      monthlyTotalAtEmploymentEnd: atEmploymentEnd.total,
      monthlyTotalAtHorizon: atHorizon.total,
    },
  };
}

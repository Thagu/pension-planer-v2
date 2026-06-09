/**
 * BVG-Berechnungsmodul (2. Säule / Pensionskasse)
 */

import {
  BVG_COORDINATION_DEDUCTION,
  BVG_ENTRY_THRESHOLD,
  BVG_MIN_INSURED_SALARY,
  BVG_MAX_INSURED_SALARY,
  BVG_CONTRIBUTION_RATES,
  BVG_MIN_INTEREST_RATE,
  BVG_CONVERSION_RATE,
  BVG_MIN_CONTRIBUTION_AGE,
} from "../constants";
import { BVG_EARLIEST_PENSION_AGE } from "../legal-ages";
import { inflateAmount, formatInflationRatePercent } from "../inflation";
import {
  formatWorkloadReductions,
  type WorkloadReduction,
  workloadFactorAtAge,
} from "../workload";

export interface BvgPayoutOptions {
  /** Anteil des Alterskapitals als Kapitalbezug (0–1), Rest wird verrentet */
  capitalWithdrawalPercent: number;
  /** Anzahl Tranchen (1 = sofortiger Bezug, >1 = gleichmässige Auszahlung über N Jahre) */
  capitalWithdrawalTranches?: number;
}

export interface CoordinatedSalaryBreakdown {
  grossSalary: number;
  coordinationDeduction: number;
  salaryAfterDeduction: number;
  coordinatedSalary: number;
  cappedAtMinimum: boolean;
  cappedAtMaximum: boolean;
  mode: "standard" | "none" | "custom";
}

export interface BvgInput {
  birthDate: string;
  currentSalaryBrutto: number;
  currentCapital: number;
  /** Alter bei Leistungsbeginn (Rente / Kapitalbezug) */
  pensionStartAge: number;
  /** Ende Erwerbstätigkeit – Beiträge enden hier (Standard: pensionStartAge) */
  employmentEndAge?: number;
  coordinationDeductionMode?: "standard" | "none" | "custom";
  coordinationDeductionCustom?: number;
  interestRate?: number;
  conversionRate?: number;
  customContributionRates?: Record<string, number>;
  payout?: BvgPayoutOptions;
  /** Stammdaten: fester koordinierter Lohn (CHF), ersetzt Berechnung wenn gesetzt */
  coordinatedSalaryOverride?: number | null;
  /** Teilpensionierung: bis zu 2 Pensum-Reduktionen ab Alter */
  workloadReductions?: WorkloadReduction[];
  /** Annual inflation (decimal); salary for contributions grows each projection year */
  inflationRate?: number;
}

export interface BvgYearProjection {
  age: number;
  year: number;
  capitalStart: number;
  contribution: number;
  interest: number;
  capitalEnd: number;
  contributionRate: number;
}

export interface BvgPayoutResult {
  capitalWithdrawalPercent: number;
  capitalWithdrawalTranches: number;
  totalCapitalWithdrawn: number;
  capitalConvertedToPension: number;
  immediateWithdrawalToFreeAssets: number;
  yearlyWithdrawalPerTranche: number;
}

export interface BvgResult {
  projectedCapital: number;
  yearlyPension: number;
  monthlyPension: number;
  pensionStartAge: number;
  employmentEndAge: number;
  earliestPensionAge: number;
  conversionRate: number;
  interestRate: number;
  coordinatedSalary: number;
  salaryBreakdown: CoordinatedSalaryBreakdown;
  yearsToRetirement: number;
  projection: BvgYearProjection[];
  payout: BvgPayoutResult;
  explanation: BvgExplanationStep[];
}

export interface BvgExplanationStep {
  label: string;
  value: string;
  detail?: string;
}

export function calculateCoordinatedSalaryBreakdown(
  bruttolohn: number,
  mode: "standard" | "none" | "custom" = "standard",
  customDeduction?: number,
): CoordinatedSalaryBreakdown {
  if (bruttolohn < BVG_ENTRY_THRESHOLD) {
    return {
      grossSalary: bruttolohn,
      coordinationDeduction: 0,
      salaryAfterDeduction: 0,
      coordinatedSalary: 0,
      cappedAtMinimum: false,
      cappedAtMaximum: false,
      mode,
    };
  }

  let deduction = 0;
  switch (mode) {
    case "none":
      deduction = 0;
      break;
    case "custom":
      deduction = customDeduction ?? BVG_COORDINATION_DEDUCTION;
      break;
    default:
      deduction = BVG_COORDINATION_DEDUCTION;
  }

  const salaryAfterDeduction = bruttolohn - deduction;
  const beforeCap = salaryAfterDeduction;
  const coordinated = Math.max(
    BVG_MIN_INSURED_SALARY,
    Math.min(beforeCap, BVG_MAX_INSURED_SALARY),
  );

  return {
    grossSalary: bruttolohn,
    coordinationDeduction: deduction,
    salaryAfterDeduction: beforeCap,
    coordinatedSalary: coordinated,
    cappedAtMinimum: beforeCap < BVG_MIN_INSURED_SALARY,
    cappedAtMaximum: beforeCap > BVG_MAX_INSURED_SALARY,
    mode,
  };
}

export function calculateCoordinatedSalary(
  bruttolohn: number,
  mode: "standard" | "none" | "custom" = "standard",
  customDeduction?: number,
): number {
  return calculateCoordinatedSalaryBreakdown(bruttolohn, mode, customDeduction)
    .coordinatedSalary;
}

function formatCoordinationDetail(b: CoordinatedSalaryBreakdown): string {
  if (b.coordinatedSalary === 0) {
    return `Bruttolohn unter Eintrittsschwelle CHF ${BVG_ENTRY_THRESHOLD.toLocaleString("de-CH")}`;
  }

  const parts = [
    `Bruttolohn CHF ${b.grossSalary.toLocaleString("de-CH")}`,
    b.coordinationDeduction > 0
      ? `− Koordinationsabzug CHF ${b.coordinationDeduction.toLocaleString("de-CH")}`
      : "ohne Koordinationsabzug",
    `= CHF ${b.salaryAfterDeduction.toLocaleString("de-CH")}`,
  ];

  if (b.cappedAtMaximum) {
    parts.push(`→ gedeckelt auf max. CHF ${BVG_MAX_INSURED_SALARY.toLocaleString("de-CH")}`);
  } else if (b.cappedAtMinimum) {
    parts.push(`→ Mindestlohn CHF ${BVG_MIN_INSURED_SALARY.toLocaleString("de-CH")}`);
  }

  return parts.join(" ");
}

export function getContributionRate(
  age: number,
  customRates?: Record<string, number>,
  retirementAge?: number,
): number {
  const rates = customRates ?? BVG_CONTRIBUTION_RATES;
  if (age < BVG_MIN_CONTRIBUTION_AGE || age > 65) return 0;
  if (retirementAge != null && age >= retirementAge) return 0;
  if (age <= 34) return rates["20-34"] ?? BVG_CONTRIBUTION_RATES["20-34"];
  if (age <= 44) return rates["35-44"] ?? BVG_CONTRIBUTION_RATES["35-44"];
  if (age <= 54) return rates["45-54"] ?? BVG_CONTRIBUTION_RATES["45-54"];
  return rates["55-65"] ?? BVG_CONTRIBUTION_RATES["55-65"];
}

function applyBvgPayout(
  projectedCapital: number,
  conversionRate: number,
  payout?: BvgPayoutOptions,
): Pick<BvgResult, "yearlyPension" | "monthlyPension" | "payout"> {
  const withdrawalPercent = Math.min(
    1,
    Math.max(0, payout?.capitalWithdrawalPercent ?? 0),
  );
  const tranches = Math.max(
    1,
    Math.min(5, Math.round(payout?.capitalWithdrawalTranches ?? 1)),
  );

  const totalCapitalWithdrawn = Math.round(projectedCapital * withdrawalPercent);
  const capitalConvertedToPension = projectedCapital - totalCapitalWithdrawn;
  const yearlyWithdrawalPerTranche =
    tranches > 0 ? Math.round(totalCapitalWithdrawn / tranches) : 0;
  const immediateWithdrawalToFreeAssets = yearlyWithdrawalPerTranche;

  const yearlyPension = Math.round(capitalConvertedToPension * conversionRate);
  const monthlyPension = Math.round(yearlyPension / 12);

  return {
    yearlyPension,
    monthlyPension,
    payout: {
      capitalWithdrawalPercent: withdrawalPercent,
      capitalWithdrawalTranches: tranches,
      totalCapitalWithdrawn,
      capitalConvertedToPension,
      immediateWithdrawalToFreeAssets,
      yearlyWithdrawalPerTranche,
    },
  };
}

export function calculateBvgPension(input: BvgInput): BvgResult {
  const {
    birthDate,
    currentSalaryBrutto,
    currentCapital,
    pensionStartAge,
    employmentEndAge: employmentEndAgeInput,
    coordinationDeductionMode = "standard",
    coordinationDeductionCustom,
    interestRate = BVG_MIN_INTEREST_RATE,
    conversionRate = BVG_CONVERSION_RATE,
    customContributionRates,
    payout,
    coordinatedSalaryOverride,
    workloadReductions = [],
    inflationRate = 0,
  } = input;

  const employmentEndAge = employmentEndAgeInput ?? pensionStartAge;

  const explanation: BvgExplanationStep[] = [];
  const projection: BvgYearProjection[] = [];

  const birth = new Date(birthDate);
  const now = new Date();
  let currentAge = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    currentAge--;
  }

  const salaryBreakdown = calculateCoordinatedSalaryBreakdown(
    currentSalaryBrutto,
    coordinationDeductionMode,
    coordinationDeductionCustom,
  );
  const calculatedCoordinated = salaryBreakdown.coordinatedSalary;
  const fullTimeCoordinatedSalary =
    coordinatedSalaryOverride != null && coordinatedSalaryOverride > 0
      ? Math.round(coordinatedSalaryOverride)
      : calculatedCoordinated;

  explanation.push({
    label: "Koordinierter Lohn",
    value: `CHF ${fullTimeCoordinatedSalary.toLocaleString("de-CH")}`,
    detail:
      coordinatedSalaryOverride != null && coordinatedSalaryOverride > 0
        ? `Stammdaten-Override. Berechnet: ${formatCoordinationDetail(salaryBreakdown)}`
        : formatCoordinationDetail(salaryBreakdown),
  });

  if (workloadReductions.length > 0) {
    explanation.push({
      label: "Arbeitspensum-Reduktion",
      value: formatWorkloadReductions(workloadReductions),
      detail: "BVG-Beiträge werden ab den Stichtagen proportional reduziert",
    });
  }

  if (inflationRate > 0) {
    explanation.push({
      label: "Inflation (Lohn)",
      value: formatInflationRatePercent(inflationRate),
      detail: "Bruttolohn und koordinierter Lohn steigen jährlich für die Beitragsprojektion",
    });
  }

  const yearsToPension = Math.max(0, pensionStartAge - currentAge);

  explanation.push({
    label: "BVG-Leistungsbeginn",
    value: `${pensionStartAge} Jahre`,
    detail: `Frühestens ${BVG_EARLIEST_PENSION_AGE} J. bei Erwerbsaufgabe (Art. 14 BVG)`,
  });

  if (employmentEndAge < pensionStartAge) {
    explanation.push({
      label: "Erwerbsaufgabe",
      value: `${employmentEndAge} Jahre`,
      detail: "Keine PK-Beiträge danach; Kapital wächst bis Leistungsbeginn weiter",
    });
  }

  explanation.push({
    label: "Aktuelles Guthaben",
    value: `CHF ${currentCapital.toLocaleString("de-CH")}`,
  });

  explanation.push({
    label: "Jahre bis Leistungsbeginn",
    value: `${yearsToPension} Jahre`,
    detail: `Alter ${currentAge} → ${pensionStartAge}`,
  });

  let capital = currentCapital;
  const startYear = now.getFullYear();

  for (let i = 0; i < yearsToPension; i++) {
    const age = currentAge + i;
    const year = startYear + i;
    const capitalStart = capital;
    const stillContributing = age < employmentEndAge;
    const workload = workloadFactorAtAge(workloadReductions, age);
    const inflatedGross =
      coordinatedSalaryOverride != null && coordinatedSalaryOverride > 0
        ? currentSalaryBrutto
        : inflateAmount(currentSalaryBrutto, inflationRate, i);
    const yearCoordinatedSalary =
      coordinatedSalaryOverride != null && coordinatedSalaryOverride > 0
        ? Math.round(fullTimeCoordinatedSalary * workload)
        : calculateCoordinatedSalaryBreakdown(
            inflatedGross * workload,
            coordinationDeductionMode,
            coordinationDeductionCustom,
          ).coordinatedSalary;
    const contributionRate = getContributionRate(
      age,
      customContributionRates,
      employmentEndAge,
    );
    const contribution =
      stillContributing &&
      yearCoordinatedSalary > 0 &&
      age >= BVG_MIN_CONTRIBUTION_AGE
        ? Math.round(yearCoordinatedSalary * contributionRate)
        : 0;
    const interest = Math.round((capitalStart + contribution / 2) * interestRate);
    capital = capitalStart + contribution + interest;

    projection.push({
      age,
      year,
      capitalStart: Math.round(capitalStart),
      contribution,
      interest,
      capitalEnd: Math.round(capital),
      contributionRate,
    });
  }

  const projectedCapital = Math.round(capital);

  explanation.push({
    label: "Zinssatz",
    value: `${(interestRate * 100).toFixed(2)}%`,
    detail:
      interestRate === BVG_MIN_INTEREST_RATE
        ? "BVG-Mindestzinssatz"
        : "Benutzerdefiniert",
  });

  explanation.push({
    label: "Projiziertes Guthaben",
    value: `CHF ${projectedCapital.toLocaleString("de-CH")}`,
    detail: `Bei Alter ${pensionStartAge}`,
  });

  const payoutResult = applyBvgPayout(projectedCapital, conversionRate, payout);

  if (payoutResult.payout.capitalWithdrawalPercent > 0) {
    explanation.push({
      label: "Kapitalbezug",
      value: `${(payoutResult.payout.capitalWithdrawalPercent * 100).toFixed(0)}% · ${payoutResult.payout.capitalWithdrawalTranches} Tranche(n)`,
      detail: `CHF ${payoutResult.payout.totalCapitalWithdrawn.toLocaleString("de-CH")} ins freie Vermögen (sofort CHF ${payoutResult.payout.immediateWithdrawalToFreeAssets.toLocaleString("de-CH")})`,
    });
    explanation.push({
      label: "Verbleibendes Kapital (Rente)",
      value: `CHF ${payoutResult.payout.capitalConvertedToPension.toLocaleString("de-CH")}`,
      detail: `Umwandlung mit ${(conversionRate * 100).toFixed(1)}%`,
    });
  }

  explanation.push({
    label: "Umwandlungssatz",
    value: `${(conversionRate * 100).toFixed(1)}%`,
    detail:
      conversionRate === BVG_CONVERSION_RATE
        ? "BVG-Mindestumwandlungssatz"
        : "Benutzerdefiniert",
  });

  explanation.push({
    label: "BVG-Rente",
    value: `CHF ${payoutResult.monthlyPension.toLocaleString("de-CH")}/Monat`,
    detail: `CHF ${payoutResult.yearlyPension.toLocaleString("de-CH")}/Jahr`,
  });

  return {
    projectedCapital,
    yearlyPension: payoutResult.yearlyPension,
    monthlyPension: payoutResult.monthlyPension,
    pensionStartAge,
    employmentEndAge,
    earliestPensionAge: BVG_EARLIEST_PENSION_AGE,
    conversionRate,
    interestRate,
    coordinatedSalary: fullTimeCoordinatedSalary,
    salaryBreakdown,
    yearsToRetirement: yearsToPension,
    projection,
    payout: payoutResult.payout,
    explanation,
  };
}

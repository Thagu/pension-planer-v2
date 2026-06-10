/**
 * Freies Vermögen – Berechnungsmodul
 */

import { DEFAULT_ASSUMPTIONS } from "../constants";
import { annualPensionIncomeAtAge } from "../legal-ages";
import { formatInflationRatePercent, inflateAmount } from "../inflation";
import {
  calculateAdditionalIncomeTax,
  type TaxSettings,
} from "@/lib/tax/additional-income-tax";
import {
  formatWorkloadReductions,
  savingsAtWorkload,
  type WorkloadReduction,
  workloadFactorAtAge,
} from "../workload";

export type CapitalInjectionSource = "bvg" | "pillar3a" | "other";

export interface CapitalInjection {
  /** Jahre nach Erwerbsaufgabe (Legacy) */
  yearOffset?: number;
  /** Absolutes Alter beim Zufluss (bevorzugt) */
  atAge?: number;
  amount: number;
  label?: string;
  source?: CapitalInjectionSource;
}

export interface FreeAssetsInput {
  birthDate: string;
  currentValue: number;
  retirementAge: number;
  returnRate?: number;
  /** Jährliche Sparquote (CHF) vom Lohn ins freie Vermögen */
  annualSavingsContribution?: number;
  /** Einmaliger Zufluss bei Pensionierung (Legacy / 1. Tranche) */
  capitalInjectionAtRetirement?: number;
  /** Gestaffelte Kapitalzuflüsse (BVG-Tranchen, 3a-Bezüge, …) */
  scheduledInjections?: CapitalInjection[];
  /** Alter bis wohin die Projektion reicht (z. B. 90) */
  planningHorizonAge?: number;
  /** Jährliche Ausgaben ab Pensionierung */
  annualRetirementExpenses?: number;
  /** Jährliche AHV- + BVG-Rente (ab jeweiligem Bezugsalter) */
  annualFixedPensionIncome?: number;
  ahvPensionStartAge?: number;
  bvgPensionStartAge?: number;
  ahvYearlyPension?: number;
  bvgYearlyPension?: number;
  taxSettings?: TaxSettings;
  /** Teilpensionierung: Sparquote proportional zum Pensum */
  workloadReductions?: WorkloadReduction[];
  /** Bruttojahreslohn bei 100 % Pensum (Basis für Sparquote-Einbusse) */
  referenceSalaryBrutto?: number;
  /** Jährliche 3a-Einzahlung (Info; läuft separat, kein Abzug vom Netto-Leben) */
  annualPillar3aContribution?: number;
  /** Annual inflation (decimal); savings, salary base, expenses, 3a offset */
  inflationRate?: number;
}

export interface FreeAssetsYearProjection {
  age: number;
  year: number;
  capitalStart: number;
  savingsContribution: number;
  interest: number;
  capitalInjection: number;
  bvgCapitalInjection: number;
  pillar3aCapitalInjection: number;
  /** Brutto-Ausgaben ab Pensionierung */
  annualGrossExpenses: number;
  /** Davon gedeckt durch AHV/BVG-Rente */
  annualPensionOffset: number;
  /** Netto-Entnahme aus freiem Vermögen */
  annualWithdrawal: number;
  /** AHV/BVG-Rente im Jahr (voller Betrag) */
  annualPensionIncome: number;
  /** Einnahmen im Jahr (Sparquote, Zins, Kapitalzuflüsse, Renten) */
  annualTotalIncome: number;
  /** Ausgaben im Jahr */
  annualTotalExpenses: number;
  /** Kumulierte Einnahmen seit Projektionsstart */
  cumulativeIncome: number;
  /** Kumulierte Ausgaben seit Projektionsstart */
  cumulativeExpenses: number;
  /** Steuerpflichtiges Zusatzeinkommen (Kapital + Renten, ohne Lohn) */
  annualTaxableAdditionalIncome: number;
  annualFederalTax: number;
  annualCantonalTax: number;
  annualMunicipalTax: number;
  annualTotalTax: number;
  capitalEnd: number;
}

export interface FreeAssetsExplanationStep {
  label: string;
  value: string;
  detail?: string;
}

export interface FreeAssetsResult {
  projectedCapital: number;
  yearlyIncome: number;
  monthlyIncome: number;
  returnRate: number;
  yearsToRetirement: number;
  planningHorizonAge: number;
  annualRetirementExpenses: number;
  annualFixedPensionIncome: number;
  annualNetExpenseGap: number;
  projection: FreeAssetsYearProjection[];
  explanation: FreeAssetsExplanationStep[];
}

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

export function calculateFreeAssetsPension(input: FreeAssetsInput): FreeAssetsResult {
  const {
    birthDate,
    currentValue,
    retirementAge,
    returnRate = DEFAULT_ASSUMPTIONS.returnRateFreeAssets,
    annualSavingsContribution = 0,
    planningHorizonAge,
    annualRetirementExpenses = 0,
    ahvPensionStartAge = 65,
    bvgPensionStartAge = 65,
    ahvYearlyPension = 0,
    bvgYearlyPension = 0,
    taxSettings,
    workloadReductions = [],
    referenceSalaryBrutto = 0,
    annualPillar3aContribution = 0,
    inflationRate = 0,
  } = input;

  const explanation: FreeAssetsExplanationStep[] = [];
  const projection: FreeAssetsYearProjection[] = [];
  const allInjections: CapitalInjection[] = [...(input.scheduledInjections ?? [])];
  if (input.capitalInjectionAtRetirement && input.capitalInjectionAtRetirement > 0) {
    allInjections.push({
      yearOffset: 0,
      amount: input.capitalInjectionAtRetirement,
      label: "Kapitalbezug",
      source: "other",
    });
  }

  const currentAge = currentAgeFromBirthDate(birthDate);
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const maxInjectionOffset =
    allInjections.length > 0
      ? Math.max(
          ...allInjections.map((i) =>
            i.atAge != null
              ? Math.max(0, i.atAge - retirementAge)
              : (i.yearOffset ?? 0),
          ),
        )
      : 0;
  const horizonAge = Math.max(
    planningHorizonAge ?? retirementAge + maxInjectionOffset,
    retirementAge,
    currentAge,
  );
  const totalProjectionYears = Math.max(0, horizonAge - currentAge);
  const startYear = new Date().getFullYear();
  const annualSavings = Math.max(0, annualSavingsContribution);
  const annualExpenses = Math.max(0, annualRetirementExpenses);
  const employmentEndAge = retirementAge;

  explanation.push({
    label: "Aktuelles Vermögen",
    value: `CHF ${Math.round(currentValue).toLocaleString("de-CH")}`,
  });

  if (annualSavings > 0) {
    explanation.push({
      label: "Jährliche Sparquote",
      value: `CHF ${Math.round(annualSavings).toLocaleString("de-CH")}`,
      detail:
        workloadReductions.length > 0
          ? `Bei 100 % Pensum · Reduktion = volle Sparquote minus Brutto-Einbusse · ${formatWorkloadReductions(workloadReductions)}`
          : "Zufluss vom Lohn ins freie Vermögen bis zur Pensionierung",
    });
  }

  explanation.push({
    label: "Jahre bis Pensionierung",
    value: `${yearsToRetirement} Jahre`,
    detail: `Alter ${currentAge} → ${retirementAge}`,
  });

  if (horizonAge > retirementAge) {
    explanation.push({
      label: "Planungshorizont",
      value: `${horizonAge} Jahre`,
      detail: `Projektion bis Alter ${horizonAge}`,
    });
  }

  if (annualExpenses > 0) {
    explanation.push({
      label: "Jährliche Ausgaben (Pensionierung)",
      value: `CHF ${Math.round(annualExpenses).toLocaleString("de-CH")}`,
      detail:
        inflationRate > 0
          ? `Netto-Lebenshaltung im ersten Pensionsjahr · jährliche Teuerung ${formatInflationRatePercent(inflationRate)}`
          : `Netto-Lebenshaltung ab Erwerbsaufgabe (${employmentEndAge} J.); AHV ab ${ahvPensionStartAge} J., BVG ab ${bvgPensionStartAge} J. mindern den Kapitalbedarf`,
    });
  }

  if (inflationRate > 0 && annualSavings > 0) {
    explanation.push({
      label: "Inflation (Sparquote & Lohn)",
      value: formatInflationRatePercent(inflationRate),
      detail: "Sparquote und Referenzlohn für Teilpensionierung steigen jährlich bis zur Erwerbsaufgabe",
    });
  }

  if (taxSettings?.cantonCode) {
    const status =
      taxSettings.maritalStatus === "married" ? "verheiratet" : "ledig";
    explanation.push({
      label: "Steuerdomizil",
      value: `${taxSettings.cantonCode} · ${status}`,
      detail:
        taxSettings.federalFromDb || taxSettings.localFromDb
          ? "Globale Referenztabelle (5 Stützpunkte)"
          : "Fallback-Referenz (5 Stützpunkte)",
    });
  }

  if (ahvYearlyPension > 0 || bvgYearlyPension > 0) {
    explanation.push({
      label: "Renten (AHV/BVG)",
      value: `AHV ab ${ahvPensionStartAge} J. · BVG ab ${bvgPensionStartAge} J.`,
      detail: `CHF ${Math.round(ahvYearlyPension + bvgYearlyPension).toLocaleString("de-CH")}/J. wenn beide aktiv`,
    });
  }

  let capital = currentValue;
  let cumulativeIncome = 0;
  let cumulativeExpenses = 0;

  for (let i = 0; i <= totalProjectionYears; i++) {
    const age = currentAge + i;
    const year = startYear + i;
    const capitalStart = capital;
    const beforeRetirement = age < retirementAge;
    const workload = workloadFactorAtAge(workloadReductions, age);
    const yearSalary = inflateAmount(referenceSalaryBrutto, inflationRate, i);
    const yearSavingsBase = inflateAmount(annualSavings, inflationRate, i);
    const savings = beforeRetirement
      ? savingsAtWorkload(yearSalary, yearSavingsBase, workload)
      : 0;
    const interest =
      capitalStart > 0
        ? Math.round((capitalStart + savings / 2) * returnRate)
        : 0;
    capital = capitalStart + savings + interest;

    const yearOffsetFromRetirement = i - yearsToRetirement;
    let capitalInjection = 0;
    let bvgCapitalInjection = 0;
    let pillar3aCapitalInjection = 0;
    for (const inj of allInjections) {
      const matches =
        inj.atAge != null
          ? inj.atAge === age
          : inj.yearOffset != null &&
            yearOffsetFromRetirement >= 0 &&
            inj.yearOffset === yearOffsetFromRetirement;
      if (!matches) continue;

      capitalInjection += inj.amount;
      if (inj.source === "bvg") {
        bvgCapitalInjection += inj.amount;
      } else if (inj.source === "pillar3a") {
        pillar3aCapitalInjection += inj.amount;
      } else if (inj.label?.startsWith("BVG")) {
        bvgCapitalInjection += inj.amount;
      } else if (inj.label?.includes("3a")) {
        pillar3aCapitalInjection += inj.amount;
      }
    }
    if (capitalInjection > 0) {
      capital += capitalInjection;
    }

    const yearsRetired = Math.max(0, age - retirementAge);
    const annualGrossExpenses = beforeRetirement
      ? 0
      : inflateAmount(annualExpenses, inflationRate, yearsRetired);
    const pensionAtAge = beforeRetirement
      ? 0
      : annualPensionIncomeAtAge(
          age,
          ahvYearlyPension,
          bvgYearlyPension,
          ahvPensionStartAge,
          bvgPensionStartAge,
        );
    const annualPensionOffset = Math.min(annualGrossExpenses, pensionAtAge);
    const annualWithdrawal = Math.max(0, annualGrossExpenses - pensionAtAge);
    const annualPensionIncome = pensionAtAge;
    const annualTaxableAdditionalIncome =
      capitalInjection + annualPensionIncome;
    const taxBreakdown = calculateAdditionalIncomeTax(
      annualTaxableAdditionalIncome,
      taxSettings,
    );
    const annualFederalTax = taxBreakdown.federal;
    const annualCantonalTax = taxBreakdown.canton;
    const annualMunicipalTax = taxBreakdown.municipal;
    const annualTotalTax = taxBreakdown.total;

    const annualTotalIncome =
      savings + interest + capitalInjection + annualPensionIncome;
    const annualTotalExpenses = annualGrossExpenses + annualTotalTax;
    cumulativeIncome += annualTotalIncome;
    cumulativeExpenses += annualTotalExpenses;
    // Defizit akkumulieren (negatives Vermögen), nicht bei 0 stoppen
    capital = capital - annualWithdrawal - annualTotalTax;

    projection.push({
      age,
      year,
      capitalStart: Math.round(capitalStart),
      savingsContribution: Math.round(savings),
      interest,
      capitalInjection: Math.round(capitalInjection),
      bvgCapitalInjection: Math.round(bvgCapitalInjection),
      pillar3aCapitalInjection: Math.round(pillar3aCapitalInjection),
      annualGrossExpenses: Math.round(annualGrossExpenses),
      annualPensionOffset: Math.round(annualPensionOffset),
      annualWithdrawal: Math.round(annualWithdrawal),
      annualPensionIncome: Math.round(annualPensionIncome),
      annualTotalIncome: Math.round(annualTotalIncome),
      annualTotalExpenses: Math.round(annualTotalExpenses),
      cumulativeIncome: Math.round(cumulativeIncome),
      cumulativeExpenses: Math.round(cumulativeExpenses),
      annualTaxableAdditionalIncome: Math.round(annualTaxableAdditionalIncome),
      annualFederalTax,
      annualCantonalTax,
      annualMunicipalTax,
      annualTotalTax,
      capitalEnd: Math.round(capital),
    });
  }

  const taxYears = projection.filter((p) => p.annualTotalTax > 0);
  if (taxYears.length > 0) {
    const totalTax = taxYears.reduce((sum, p) => sum + p.annualTotalTax, 0);
    const totalFederal = taxYears.reduce((sum, p) => sum + p.annualFederalTax, 0);
    const totalCantonal = taxYears.reduce((sum, p) => sum + p.annualCantonalTax, 0);
    const totalMunicipal = taxYears.reduce(
      (sum, p) => sum + p.annualMunicipalTax,
      0,
    );
    explanation.push({
      label: "Steuer auf Zusatzeinkommen (total)",
      value: `CHF ${totalTax.toLocaleString("de-CH")}`,
      detail: `Bund CHF ${totalFederal.toLocaleString("de-CH")} · Kanton CHF ${totalCantonal.toLocaleString("de-CH")} · Gemeinde CHF ${totalMunicipal.toLocaleString("de-CH")} · ${taxYears.length} Steuerjahre`,
    });
  }

  for (const inj of allInjections) {
    if (inj.amount <= 0) continue;
    const sourceLabel =
      inj.source === "bvg" ? " · BVG" : inj.source === "pillar3a" ? " · 3a" : "";
    let detail: string;
    if (inj.atAge != null) {
      const relative = inj.atAge - retirementAge;
      if (relative === 0) {
        detail = `Im Pensionsjahr ins freie Vermögen${sourceLabel}`;
      } else if (relative < 0) {
        detail = `${Math.abs(relative)} Jahr(e) vor Erwerbsaufgabe (Alter ${inj.atAge})${sourceLabel}`;
      } else {
        detail = `${relative} Jahr(e) nach Erwerbsaufgabe (Alter ${inj.atAge})${sourceLabel}`;
      }
    } else if (inj.yearOffset === 0) {
      detail = `Im Pensionsjahr ins freie Vermögen${sourceLabel}`;
    } else {
      detail = `${inj.yearOffset} Jahr(e) nach Pensionierung${sourceLabel}`;
    }
    explanation.push({
      label: inj.label ?? `Kapitalzufluss (+${inj.yearOffset} J.)`,
      value: `CHF ${Math.round(inj.amount).toLocaleString("de-CH")}`,
      detail,
    });
  }

  const projectedCapital = Math.round(capital);
  const grossYearlyIncome = Math.round(projectedCapital * returnRate);
  const pensionAtHorizon = annualPensionIncomeAtAge(
    horizonAge,
    ahvYearlyPension,
    bvgYearlyPension,
    ahvPensionStartAge,
    bvgPensionStartAge,
  );
  const annualNetExpenseGap = Math.max(0, annualExpenses - pensionAtHorizon);
  const netYearlyIncome = Math.max(0, grossYearlyIncome - annualNetExpenseGap);
  const monthlyIncome = Math.round(netYearlyIncome / 12);

  explanation.push({
    label: "Erwartete Rendite",
    value: `${(returnRate * 100).toFixed(2)}%`,
    detail: "Jährliche Verzinsung",
  });

  explanation.push({
    label: "Projiziertes Vermögen",
    value: `CHF ${projectedCapital.toLocaleString("de-CH")}`,
    detail: `Bei Alter ${horizonAge}${annualExpenses > 0 ? " (nach laufenden Ausgaben abzgl. AHV/BVG)" : ""}`,
  });

  explanation.push({
    label: "Entnahmeeinkommen (netto)",
    value: `CHF ${monthlyIncome.toLocaleString("de-CH")}/Monat`,
    detail:
      annualExpenses > 0
        ? pensionAtHorizon > 0
          ? `Brutto CHF ${grossYearlyIncome.toLocaleString("de-CH")}/J. abzgl. Ausgabenlücke CHF ${Math.round(annualNetExpenseGap).toLocaleString("de-CH")}/J. (nach AHV/BVG)`
          : `Brutto CHF ${grossYearlyIncome.toLocaleString("de-CH")}/J. abzgl. Ausgaben CHF ${Math.round(annualExpenses).toLocaleString("de-CH")}/J.`
        : `CHF ${grossYearlyIncome.toLocaleString("de-CH")}/Jahr (Rendite auf Kapital)`,
  });

  return {
    projectedCapital,
    yearlyIncome: netYearlyIncome,
    monthlyIncome,
    returnRate,
    yearsToRetirement,
    planningHorizonAge: horizonAge,
    annualRetirementExpenses: annualExpenses,
    annualFixedPensionIncome: pensionAtHorizon,
    annualNetExpenseGap,
    projection,
    explanation,
  };
}

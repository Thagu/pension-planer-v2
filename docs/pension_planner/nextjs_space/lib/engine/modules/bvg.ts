/**
 * BVG-Berechnungsmodul (2. Säule / Pensionskasse)
 * =================================================
 * Berechnet die voraussichtliche BVG-Altersleistung basierend auf:
 * - Aktuellem BVG-Altersguthaben
 * - Koordiniertem Lohn und altersabhängigen Altersgutschriften
 * - Verzinsung (BVG-Mindestzins oder benutzerdefiniert)
 * - Umwandlungssatz zur Rentenberechnung
 *
 * Vereinfachungen für MVP:
 * - Lohn konstant über gesamte Erwerbszeit (keine Lohnentwicklung)
 * - BVG-Obligatorium (keine überobligatorischen Leistungen)
 * - Standardmässiger Koordinationsabzug (Override möglich)
 *
 * Platform-agnostic: Keine Browser-APIs
 */

import {
  BVG_COORDINATION_DEDUCTION,
  BVG_ENTRY_THRESHOLD,
  BVG_MIN_INSURED_SALARY,
  BVG_MAX_INSURED_SALARY,
  BVG_CONTRIBUTION_RATES,
  BVG_MIN_INTEREST_RATE,
  BVG_CONVERSION_RATE,
} from '../constants';

// ============================================================
// Types
// ============================================================

export interface BvgInput {
  /** Geburtsdatum (ISO 8601) */
  birthDate: string;
  /** Aktueller Bruttolohn pro Jahr */
  currentSalaryBrutto: number;
  /** Aktuelles BVG-Altersguthaben */
  currentCapital: number;
  /** Geplantes Pensionsalter */
  retirementAge: number;
  /** Koordinationsabzug Modus */
  coordinationDeductionMode?: 'standard' | 'none' | 'custom';
  /** Benutzerdefinierter Koordinationsabzug (nur bei mode='custom') */
  coordinationDeductionCustom?: number;
  /** BVG-Zinssatz (default: BVG-Mindestzins) */
  interestRate?: number;
  /** Umwandlungssatz (default: 6.8%) */
  conversionRate?: number;
  /** Benutzerdefinierte Altersgutschriften pro Bucket (z.B. { '20-34': 0.07, ... }) */
  customContributionRates?: Record<string, number>;
}

export interface BvgYearProjection {
  /** Alter am Jahresende */
  age: number;
  /** Kalenderjahr */
  year: number;
  /** Altersguthaben zu Jahresbeginn */
  capitalStart: number;
  /** Altersgutschrift in diesem Jahr */
  contribution: number;
  /** Zinsen in diesem Jahr */
  interest: number;
  /** Altersguthaben am Jahresende */
  capitalEnd: number;
  /** Angewandter Gutschriftensatz */
  contributionRate: number;
}

export interface BvgResult {
  /** Projiziertes Altersguthaben bei Pensionierung */
  projectedCapital: number;
  /** Jährliche BVG-Rente (Kapital × Umwandlungssatz) */
  yearlyPension: number;
  /** Monatliche BVG-Rente */
  monthlyPension: number;
  /** Angewandter Umwandlungssatz */
  conversionRate: number;
  /** Angewandter Zinssatz */
  interestRate: number;
  /** Koordinierter Lohn (versicherter Lohn) */
  coordinatedSalary: number;
  /** Jahre bis Pensionierung */
  yearsToRetirement: number;
  /** Projizierte Jahresübersicht */
  projection: BvgYearProjection[];
  /** Erklärung der Berechnung */
  explanation: BvgExplanationStep[];
}

export interface BvgExplanationStep {
  label: string;
  value: string;
  detail?: string;
}

// ============================================================
// Hilfsfunktionen
// ============================================================

/**
 * Berechnet den koordinierten Lohn (BVG-versicherter Lohn).
 * Formel: Bruttolohn - Koordinationsabzug, begrenzt auf [Min, Max]
 */
export function calculateCoordinatedSalary(
  bruttolohn: number,
  mode: 'standard' | 'none' | 'custom' = 'standard',
  customDeduction?: number
): number {
  // Unter Eintrittsschwelle: kein BVG
  if (bruttolohn < BVG_ENTRY_THRESHOLD) return 0;

  let deduction: number;
  switch (mode) {
    case 'none':
      deduction = 0;
      break;
    case 'custom':
      deduction = customDeduction ?? BVG_COORDINATION_DEDUCTION;
      break;
    default:
      deduction = BVG_COORDINATION_DEDUCTION;
  }

  const coordinated = bruttolohn - deduction;

  // Minimum versicherter Lohn und Maximum
  return Math.max(
    BVG_MIN_INSURED_SALARY,
    Math.min(coordinated, BVG_MAX_INSURED_SALARY)
  );
}

/**
 * Gibt den Altersgutschriftensatz für ein bestimmtes Alter zurück.
 * - 25-34: 7%
 * - 35-44: 10%
 * - 45-54: 15%
 * - 55-65: 18%
 * - < 25 oder > 65: 0% (keine BVG-Beiträge)
 */
export function getContributionRate(age: number, customRates?: Record<string, number>): number {
  const rates = customRates ?? BVG_CONTRIBUTION_RATES;
  if (age < 20 || age > 65) return 0;
  if (age <= 34) return rates['20-34'] ?? BVG_CONTRIBUTION_RATES['20-34'];
  if (age <= 44) return rates['35-44'] ?? BVG_CONTRIBUTION_RATES['35-44'];
  if (age <= 54) return rates['45-54'] ?? BVG_CONTRIBUTION_RATES['45-54'];
  return rates['55-65'] ?? BVG_CONTRIBUTION_RATES['55-65'];
}

// ============================================================
// Hauptberechnung
// ============================================================

/**
 * Projiziert das BVG-Altersguthaben Jahr für Jahr
 * und berechnet die resultierende Rente.
 */
export function calculateBvgPension(input: BvgInput): BvgResult {
  const {
    birthDate,
    currentSalaryBrutto,
    currentCapital,
    retirementAge,
    coordinationDeductionMode = 'standard',
    coordinationDeductionCustom,
    interestRate = BVG_MIN_INTEREST_RATE,
    conversionRate = BVG_CONVERSION_RATE,
    customContributionRates,
  } = input;

  const explanation: BvgExplanationStep[] = [];
  const projection: BvgYearProjection[] = [];

  // Aktuelles Alter berechnen
  const birth = new Date(birthDate);
  const now = new Date();
  let currentAge = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    currentAge--;
  }

  // Koordinierter Lohn
  const coordinatedSalary = calculateCoordinatedSalary(
    currentSalaryBrutto,
    coordinationDeductionMode,
    coordinationDeductionCustom
  );

  explanation.push({
    label: 'Koordinierter Lohn',
    value: `CHF ${coordinatedSalary.toLocaleString('de-CH')}`,
    detail: coordinationDeductionMode === 'standard'
      ? `Bruttolohn CHF ${currentSalaryBrutto.toLocaleString('de-CH')} − Koordinationsabzug CHF ${BVG_COORDINATION_DEDUCTION.toLocaleString('de-CH')}`
      : coordinationDeductionMode === 'none'
        ? 'Ohne Koordinationsabzug'
        : `Benutzerdefinierter Abzug: CHF ${(coordinationDeductionCustom ?? 0).toLocaleString('de-CH')}`,
  });

  // Jahre bis Pensionierung
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);

  explanation.push({
    label: 'Aktuelles Guthaben',
    value: `CHF ${currentCapital.toLocaleString('de-CH')}`,
  });

  explanation.push({
    label: 'Jahre bis Pensionierung',
    value: `${yearsToRetirement} Jahre`,
    detail: `Alter ${currentAge} → ${retirementAge}`,
  });

  // Jahr-für-Jahr Projektion
  let capital = currentCapital;
  const startYear = now.getFullYear();

  for (let i = 0; i < yearsToRetirement; i++) {
    const age = currentAge + i;
    const year = startYear + i;
    const capitalStart = capital;

    // Altersgutschrift: nur wenn Alter ≥ 25 und Lohn über Schwelle
    const contributionRate = getContributionRate(age, customContributionRates);
    const contribution = coordinatedSalary > 0 ? Math.round(coordinatedSalary * contributionRate) : 0;

    // Zinsen auf Guthaben (Anfang des Jahres + halbe Gutschrift)
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
    label: 'Zinssatz',
    value: `${(interestRate * 100).toFixed(2)}%`,
    detail: interestRate === BVG_MIN_INTEREST_RATE
      ? 'BVG-Mindestzinssatz'
      : 'Benutzerdefiniert',
  });

  explanation.push({
    label: 'Projiziertes Guthaben',
    value: `CHF ${projectedCapital.toLocaleString('de-CH')}`,
    detail: `Bei Alter ${retirementAge}`,
  });

  // Rente berechnen
  const yearlyPension = Math.round(projectedCapital * conversionRate);
  const monthlyPension = Math.round(yearlyPension / 12);

  explanation.push({
    label: 'Umwandlungssatz',
    value: `${(conversionRate * 100).toFixed(1)}%`,
    detail: conversionRate === BVG_CONVERSION_RATE
      ? 'BVG-Mindestumwandlungssatz'
      : 'Benutzerdefiniert',
  });

  explanation.push({
    label: 'Resultat',
    value: `CHF ${monthlyPension.toLocaleString('de-CH')}/Monat`,
    detail: `CHF ${yearlyPension.toLocaleString('de-CH')}/Jahr · Kapital: CHF ${projectedCapital.toLocaleString('de-CH')}`,
  });

  return {
    projectedCapital,
    yearlyPension,
    monthlyPension,
    conversionRate,
    interestRate,
    coordinatedSalary,
    yearsToRetirement,
    projection,
    explanation,
  };
}

/**
 * AHV-Berechnungsmodul (1. Säule)
 * ================================
 * Berechnet die voraussichtliche AHV-Altersrente basierend auf:
 * - Massgebendes durchschnittliches Jahreseinkommen (MDJE)
 * - Beitragsjahre (Lücken reduzieren die Rente)
 * - Vorbezug/Aufschub
 *
 * Vereinfachungen für MVP:
 * - MDJE = aktueller Bruttolohn (konstant über gesamte Erwerbszeit)
 * - Keine Erziehungs-/Betreuungsgutschriften
 * - Keine Einkommenssplitting bei Verheirateten
 * - Lineare Interpolation der Rentenskala (statt exakter BSV-Tabellen)
 *
 * Platform-agnostic: Keine Browser-APIs
 */

import {
  getAhvEarliestPensionAge,
  getAhvReferenceAge,
} from '../legal-ages';
import {
  AHV_FULL_CONTRIBUTION_YEARS,
  AHV_CONTRIBUTION_START_AGE,
  AHV_RETIREMENT_AGE_MALE,
  AHV_MAX_YEARLY_PENSION,
  AHV_MIN_YEARLY_PENSION,
  AHV_SCALE_INCOME_LOWER,
  AHV_SCALE_INCOME_UPPER,
  AHV_EARLY_WITHDRAWAL_REDUCTION_PER_YEAR,
  AHV_DEFERRAL_SURCHARGE,
} from '../constants';
import { formatInflationRatePercent } from '../inflation';

// ============================================================
// Types
// ============================================================

export interface AhvInput {
  /** Geburtsdatum (ISO 8601: "1985-03-15") */
  birthDate: string;
  /** Geschlecht (Referenzalter / Vorbezug) */
  gender?: 'male' | 'female';
  /** Durchschnittliches Jahreseinkommen (Bruttolohn, AHV-pflichtig) */
  averageAnnualIncome: number;
  /** Ende der Erwerbstätigkeit (für Beitragsjahre) */
  employmentEndAge: number;
  /** Alter beim Beginn der AHV-Altersrente (≥ frühester Vorbezug, Standard: Referenzalter) */
  pensionStartAge: number;
  /** Fehlende Beitragsjahre (z.B. durch Zuzug aus Ausland) */
  missingContributionYears?: number;
  /** Optional: for explanation when MDJE uses inflated salary projection */
  inflationRate?: number;
}

export interface AhvResult {
  /** Jährliche AHV-Rente in CHF (ab pensionStartAge) */
  yearlyPension: number;
  /** Monatliche AHV-Rente in CHF */
  monthlyPension: number;
  /** AHV-Referenzalter (volle Rente ohne Vorbezug) */
  referenceAge: number;
  /** Frühester gesetzlicher Rentenbeginn (Vorbezug) */
  earliestPensionAge: number;
  /** Tatsächlicher Rentenbeginn in diesem Szenario */
  pensionStartAge: number;
  /** Ende Erwerbstätigkeit */
  employmentEndAge: number;
  /** Volle Beitragsrente (ohne Kürzungen durch fehlende Jahre) */
  fullPensionYearly: number;
  /** Tatsächliche Beitragsjahre */
  contributionYears: number;
  /** Maximale Beitragsjahre */
  maxContributionYears: number;
  /** Anteil der Beitragsjahre (0-1) */
  contributionRatio: number;
  /** Abzug/Zuschlag durch Vorbezug oder Aufschub */
  earlyLateAdjustment: number;
  /** Erklärung der Berechnung (für UI-Transparenz) */
  explanation: AhvExplanationStep[];
}

export interface AhvExplanationStep {
  label: string;
  value: string;
  detail?: string;
}

// ============================================================
// Berechnungslogik
// ============================================================

/**
 * Berechnet die Beitragsjahre basierend auf Geburtsdatum und Pensionsalter.
 * Beitragspflicht beginnt ab 1. Januar nach dem 20. Geburtstag.
 */
export function calculateContributionYears(
  birthDate: string,
  retirementAge: number,
  missingYears: number = 0
): number {
  const birth = new Date(birthDate);
  const contributionStartYear = birth.getFullYear() + AHV_CONTRIBUTION_START_AGE;
  const retirementYear = birth.getFullYear() + retirementAge;
  const potentialYears = Math.max(0, retirementYear - contributionStartYear);
  const effectiveYears = Math.max(0, potentialYears - missingYears);
  // Kann nie mehr als die volle Beitragsdauer sein
  return Math.min(effectiveYears, AHV_FULL_CONTRIBUTION_YEARS);
}

/**
 * Berechnet die volle AHV-Rente basierend auf dem MDJE.
 * Lineare Interpolation zwischen Minimal- und Maximalrente.
 *
 * Offizielle Logik (vereinfacht):
 * - MDJE ≤ 14'700 → Minimalrente
 * - MDJE ≥ 88'200 → Maximalrente
 * - Dazwischen: lineare Interpolation
 */
export function calculateFullPension(averageAnnualIncome: number): number {
  if (averageAnnualIncome <= 0) return 0;
  if (averageAnnualIncome <= AHV_SCALE_INCOME_LOWER) return AHV_MIN_YEARLY_PENSION;
  if (averageAnnualIncome >= AHV_SCALE_INCOME_UPPER) return AHV_MAX_YEARLY_PENSION;

  // Lineare Interpolation
  const ratio = (averageAnnualIncome - AHV_SCALE_INCOME_LOWER) /
    (AHV_SCALE_INCOME_UPPER - AHV_SCALE_INCOME_LOWER);
  return Math.round(AHV_MIN_YEARLY_PENSION + ratio * (AHV_MAX_YEARLY_PENSION - AHV_MIN_YEARLY_PENSION));
}

/**
 * Berechnet den Vorbezug-/Aufschub-Faktor.
 * - Vorbezug (retirementAge < 65): Kürzung von 6.8% pro Jahr
 * - Aufschub (retirementAge > 65): Zuschlag gemäss Tabelle (1-5 Jahre)
 * - Ordentlich (65): Faktor 0 (keine Anpassung)
 */
export function calculateEarlyLateAdjustment(
  pensionStartAge: number,
  referenceAge: number = AHV_RETIREMENT_AGE_MALE,
  earliestPensionAge: number = 63,
): number {
  const diff = pensionStartAge - referenceAge;

  if (diff === 0) return 0;

  if (diff < 0) {
    const yearsEarly = Math.abs(diff);
    const maxEarlyYears = Math.max(1, referenceAge - earliestPensionAge);
    const cappedYears = Math.min(yearsEarly, maxEarlyYears);
    return -(cappedYears * AHV_EARLY_WITHDRAWAL_REDUCTION_PER_YEAR);
  }

  const yearsDeferred = Math.min(diff, 5);
  return AHV_DEFERRAL_SURCHARGE[yearsDeferred] ?? 0;
}

/**
 * Hauptfunktion: Berechnet die voraussichtliche AHV-Altersrente.
 */
export function calculateAhvPension(input: AhvInput): AhvResult {
  const {
    birthDate,
    gender,
    averageAnnualIncome,
    employmentEndAge,
    pensionStartAge,
    missingContributionYears = 0,
    inflationRate = 0,
  } = input;

  const referenceAge = getAhvReferenceAge(birthDate, gender);
  const earliestPensionAge = getAhvEarliestPensionAge(birthDate, gender);

  const explanation: AhvExplanationStep[] = [];

  explanation.push({
    label: 'AHV-Referenzalter',
    value: `${referenceAge % 1 === 0 ? referenceAge : referenceAge.toFixed(2).replace(/\.?0+$/, '')} Jahre`,
    detail:
      gender === 'female'
        ? 'AHV 21 – Übergangsregelung Frauen'
        : 'Ordentliches Rentenalter (Männer)',
  });

  if (employmentEndAge < pensionStartAge) {
    explanation.push({
      label: 'Erwerbsaufgabe',
      value: `${employmentEndAge} Jahre`,
      detail: `AHV-Rente beginnt erst mit ${pensionStartAge} Jahren (kein Anspruch davor)`,
    });
  }

  explanation.push({
    label: 'AHV-Rentenbeginn',
    value: `${pensionStartAge} Jahre`,
    detail:
      pensionStartAge < referenceAge
        ? `Vorbezug (frühestens ${earliestPensionAge} J.)`
        : pensionStartAge > referenceAge
          ? 'Aufschub'
          : 'Ordentlicher Bezug',
  });

  // 1. Beitragsjahre bis Erwerbsaufgabe
  const contributionYears = calculateContributionYears(
    birthDate,
    employmentEndAge,
    missingContributionYears
  );
  const maxContributionYears = AHV_FULL_CONTRIBUTION_YEARS;
  const contributionRatio = maxContributionYears > 0
    ? Math.min(1, contributionYears / maxContributionYears)
    : 0;

  explanation.push({
    label: 'Beitragsjahre',
    value: `${contributionYears} von ${maxContributionYears} Jahren`,
    detail: contributionRatio < 1
      ? `Rentenkürzung wegen ${maxContributionYears - contributionYears} fehlenden Jahren`
      : 'Volle Beitragsdauer erreicht',
  });

  // 2. Volle Rente basierend auf Einkommen berechnen
  const fullPensionYearly = calculateFullPension(averageAnnualIncome);

  explanation.push({
    label: 'Massgebendes Einkommen',
    value: `CHF ${averageAnnualIncome.toLocaleString('de-CH')}/Jahr`,
    detail: averageAnnualIncome >= AHV_SCALE_INCOME_UPPER
      ? 'Maximalrente erreicht'
      : averageAnnualIncome <= AHV_SCALE_INCOME_LOWER
        ? 'Minimalrente'
        : 'Teilrente (zwischen Min. und Max.)',
  });

  if (inflationRate > 0) {
    explanation.push({
      label: 'Inflation (MDJE)',
      value: formatInflationRatePercent(inflationRate),
      detail:
        'Durchschnittseinkommen aus inflationsbereinigter Lohnprojektion bis Erwerbsaufgabe',
    });
  }

  explanation.push({
    label: 'Volle Jahresrente',
    value: `CHF ${fullPensionYearly.toLocaleString('de-CH')}`,
    detail: 'Bei voller Beitragsdauer',
  });

  // 3. Rente nach Beitragsjahren
  let yearlyPension = Math.round(fullPensionYearly * contributionRatio);

  if (contributionRatio < 1) {
    explanation.push({
      label: 'Nach Beitragskürzung',
      value: `CHF ${yearlyPension.toLocaleString('de-CH')}/Jahr`,
      detail: `${Math.round(contributionRatio * 100)}% der vollen Rente`,
    });
  }

  // 4. Vorbezug/Aufschub anwenden (bezogen auf Referenzalter)
  const earlyLateAdjustment = calculateEarlyLateAdjustment(
    pensionStartAge,
    referenceAge,
    earliestPensionAge,
  );

  if (earlyLateAdjustment !== 0) {
    const adjustedPension = Math.round(yearlyPension * (1 + earlyLateAdjustment));
    explanation.push({
      label: earlyLateAdjustment < 0 ? 'Vorbezug-Kürzung' : 'Aufschub-Zuschlag',
      value: `${earlyLateAdjustment > 0 ? '+' : ''}${(earlyLateAdjustment * 100).toFixed(1)}%`,
      detail: `Rente: CHF ${yearlyPension.toLocaleString('de-CH')} → CHF ${adjustedPension.toLocaleString('de-CH')}/Jahr`,
    });
    yearlyPension = adjustedPension;
  }

  const monthlyPension = Math.round(yearlyPension / 12);

  explanation.push({
    label: 'Resultat',
    value: `CHF ${monthlyPension.toLocaleString('de-CH')}/Monat`,
    detail: `CHF ${yearlyPension.toLocaleString('de-CH')}/Jahr`,
  });

  return {
    yearlyPension,
    monthlyPension,
    referenceAge,
    earliestPensionAge,
    pensionStartAge,
    employmentEndAge,
    fullPensionYearly,
    contributionYears,
    maxContributionYears,
    contributionRatio,
    earlyLateAdjustment,
    explanation,
  };
}

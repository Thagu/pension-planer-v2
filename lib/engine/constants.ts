/**
 * Swiss Pension System Constants
 * Platform-agnostic, no browser APIs
 * Werte basierend auf Stand 2024/2025
 */

// ============================================================
// AHV (1. Säule)
// ============================================================

// Referenz-Rentenalter (seit AHV 21)
export const AHV_RETIREMENT_AGE_MALE = 65;
export const AHV_RETIREMENT_AGE_FEMALE = 65; // ab 2028 schrittweise angehoben

// Volle Beitragsdauer = 44 Jahre (Beitragspflicht ab 21 bis 65)
export const AHV_FULL_CONTRIBUTION_YEARS = 44;

// Beitragspflicht beginnt ab dem 1. Januar nach dem 20. Geburtstag
export const AHV_CONTRIBUTION_START_AGE = 21;

// AHV-Beitragssatz (Arbeitnehmer + Arbeitgeber = 8.7% auf AHV-pflichtigem Lohn)
export const AHV_CONTRIBUTION_RATE = 0.087;

// Maximale und minimale jährliche Altersrente (Einzelperson, 2024)
export const AHV_MAX_YEARLY_PENSION = 29400; // CHF 2'450/Mt.
export const AHV_MIN_YEARLY_PENSION = 14700; // CHF 1'225/Mt.

// Maximale monatliche Altersrente
export const AHV_MAX_MONTHLY_PENSION = 2450;
export const AHV_MIN_MONTHLY_PENSION = 1225;

/**
 * AHV Rentenskala (vereinfacht)
 * Die AHV-Rente wird anhand des massgebenden durchschnittlichen
 * Jahreseinkommens (MDJE) berechnet. Bei vollem Beitragsdauer:
 * - MDJE ≤ CHF 14'700  → Minimalrente CHF 14'700/J.
 * - MDJE ≥ CHF 88'200  → Maximalrente CHF 29'400/J.
 * - Dazwischen: Teilrente gemäss Rentenskala (hier linear interpoliert)
 *
 * Für den MVP verwenden wir die offizielle Formel:
 * Rente = Minimalrente + (MDJE - untere Grenze) / (obere Grenze - untere Grenze) * (Maximalrente - Minimalrente)
 * begrenzt auf [Minimalrente, Maximalrente]
 */
export const AHV_SCALE_INCOME_LOWER = 14700;  // Untere Einkommensgrenze für Rentenskala
export const AHV_SCALE_INCOME_UPPER = 88200;  // Obere Einkommensgrenze für Rentenskala

/**
 * AHV Vorbezug / Aufschub
 * - Vorbezug: 1 oder 2 Jahre, Kürzung 6.8% pro Jahr
 * - Aufschub: 1 bis 5 Jahre, Zuschlag je nach Dauer
 */
export const AHV_EARLY_WITHDRAWAL_REDUCTION_PER_YEAR = 0.068; // 6.8%
export const AHV_DEFERRAL_SURCHARGE: Record<number, number> = {
  1: 0.058,  // 5.8%
  2: 0.119,  // 11.9%
  3: 0.183,  // 18.3%
  4: 0.252,  // 25.2%
  5: 0.315,  // 31.5%
};

// ============================================================
// BVG (2. Säule / Pensionskasse)
// ============================================================

export const BVG_COORDINATION_DEDUCTION = 25725; // 2024
export const BVG_ENTRY_THRESHOLD = 22050; // 2024
export const BVG_MIN_INSURED_SALARY = 3675; // 2024
export const BVG_MAX_INSURED_SALARY = 62475; // 2024 Obergrenze koordinierter Lohn

// Altersgutschriften (Arbeitnehmer + Arbeitgeber, BVG-Minimum)
export const BVG_CONTRIBUTION_RATES: Record<string, number> = {
  '20-34': 0.07,
  '35-44': 0.10,
  '45-54': 0.15,
  '55-65': 0.18,
};

// Bucket-Definitionen für UI und Engine
export const BVG_CONTRIBUTION_BUCKETS = [
  { key: '20-34', label: '20–34 Jahre', minAge: 20, maxAge: 34 },
  { key: '35-44', label: '35–44 Jahre', minAge: 35, maxAge: 44 },
  { key: '45-54', label: '45–54 Jahre', minAge: 45, maxAge: 54 },
  { key: '55-65', label: '55–65 Jahre', minAge: 55, maxAge: 65 },
] as const;

export const BVG_MIN_INTEREST_RATE = 0.0125; // 1.25% (2024)
export const BVG_CONVERSION_RATE = 0.068; // 6.8%

/** BVG-Beiträge ab diesem Alter (obligatorischer Teil, Art. 13 BVG) */
export const BVG_MIN_CONTRIBUTION_AGE = 25;

/**
 * Hinweis Kapitalbezug: beim obligatorischen Teil oft max. 50 % auszahlbar,
 * Überobligatorium kann höher sein – im MVP als UI-Orientierung.
 */
export const BVG_GUIDANCE_MAX_CAPITAL_WITHDRAWAL = 0.5;
export const BVG_MAX_CAPITAL_WITHDRAWAL_TRANCHES = 5;

// ============================================================
// Säule 3a
// ============================================================

export const PILLAR_3A_MAX_CONTRIBUTION = 7056; // 2024 (mit PK)
export const PILLAR_3A_MAX_ACCOUNTS = 5;
/** Jahre relativ zum BVG-Leistungsbeginn (negativ = vor BVG, max. 5 J. früher) */
export const PILLAR_3A_MIN_WITHDRAWAL_OFFSET = -5;
export const PILLAR_3A_MAX_WITHDRAWAL_OFFSET = 5;

// ============================================================
// Default-Annahmen
// ============================================================

export const DEFAULT_ASSUMPTIONS = {
  inflationRate: 0.01,
  returnRateBvg: 0.0125,
  returnRate3a: 0.03,
  returnRateFreeAssets: 0.04,
};

/** Geschätzter Netto-Anteil vom Bruttolohn (Mischphase, v1 ohne Lohnsteuer-Rechner) */
export const SALARY_NET_ESTIMATE_FACTOR = 0.78;
export const NET_SALARY_ESTIMATE_FACTOR = SALARY_NET_ESTIMATE_FACTOR;

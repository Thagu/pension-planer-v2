/**
 * Pension Planner Engine
 * Entry point for the portable calculation engine.
 * Modules werden schrittweise hinzugefügt (Pipe-Prinzip).
 */

export type {
  UserProfile,
  CurrentSituation,
  ScenarioInput,
  Scenario,
  YearlyData,
  SimulationResult,
} from './types';

// Module
export {
  calculateAhvPension,
  calculateFullPension,
  calculateContributionYears,
  calculateEarlyLateAdjustment,
} from './modules/ahv';
export type { AhvInput, AhvResult, AhvExplanationStep } from './modules/ahv';

export {
  calculateBvgPension,
  calculateCoordinatedSalary,
  getContributionRate,
} from './modules/bvg';
export type { BvgInput, BvgResult, BvgYearProjection, BvgExplanationStep } from './modules/bvg';

/**
 * Format CHF amount for display
 * Platform-agnostic: uses Intl.NumberFormat (available in all JS runtimes)
 */
export function formatCHF(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Calculate age from birth date
 * Platform-agnostic: pure date math
 */
export function calculateAge(birthDate: string, referenceDate?: string): number {
  const birth = new Date(birthDate);
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Calculate years until retirement
 */
export function yearsUntilRetirement(birthDate: string, retirementAge: number): number {
  const age = calculateAge(birthDate);
  return Math.max(0, retirementAge - age);
}

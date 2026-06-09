/**
 * Pension Planner Engine Types
 * Platform-agnostic: No DOM/Browser APIs
 * Portable: Can run in Browser, Node.js, or React Native
 */

export interface UserProfile {
  id: string;
  email: string;
  birthDate: string | null; // ISO 8601: "1985-03-15"
  gender: 'male' | 'female' | null;
  employmentStartYear: number | null;
  retirementAge: number | null;
  currentSalaryBrutto: number | null;
  bvgCurrentCapital: number | null;
  pillar3aCurrentCapital: number | null;
  freeAssets: number | null;
  createdAt: string;
}

export interface CurrentSituation {
  // Persönliche Daten
  birthDate: string;
  retirementAge: number;

  // Aktuelles Einkommen
  currentSalaryBrutto: number;

  // Bestehende Vorsorge
  bvgCurrentCapital: number;
  pillar3aCurrentCapital: number;
  freeAssets: number;
}

export interface ScenarioInput {
  birthDate: string;
  gender: 'male' | 'female';
  employmentStartYear: number;
  retirementAge: number;
  currentSalaryBrutto: number;
  salaryOverrides?: Record<number, number>;
  plannedCareerBreaks?: number[];

  bvg: {
    currentCapital: number;
    coordinationDeductionMode: 'standard' | 'none' | 'custom';
    coordinationDeductionCustom?: number;
    conversionRate: number;
  };

  pillar3a?: {
    currentCapital: number;
    annualContribution: number;
  };

  freeAssets?: {
    currentValue: number;
  };

  assumptions: {
    inflationRate: number;
    returnRateBvg: number;
    returnRate3a: number;
    returnRateFreeAssets: number;
  };
}

export interface Scenario {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: CurrentSituation;
}

export interface YearlyData {
  year: number;
  age: number;
  isRetired: boolean;
  salaryBrutto: number;
  ahvRente: number;
  bvgRente: number;
  investmentIncome: number;
  bvgCapital: number;
  pillar3aCapital: number;
  freeAssets: number;
  bvgContribution: number;
  pillar3aContribution: number;
  rates: {
    inflation: number;
    returnBvg: number;
    return3a: number;
    returnFreeAssets: number;
  };
}

export interface SimulationResult {
  timeline: YearlyData[];
  summary: {
    capitalAtRetirement: {
      bvg: number;
      pillar3a: number;
      freeAssets: number;
      total: number;
    };
    monthlyIncomeAtRetirement: {
      ahv: number;
      bvg: number;
      total: number;
    };
    retirementGap?: {
      monthly: number;
      percentage: number;
    };
  };
}

import { defaultBvgContributionRatesJson } from "@/lib/bvg/default-contribution-json";
import {
  BVG_CONVERSION_RATE,
  BVG_MIN_INTEREST_RATE,
} from "@/lib/engine/constants";
import {
  decimalRateToPercent,
  formatSwissNumber,
} from "@/lib/format/numbers";
import { DEFAULT_TAX_CANTON_CODE } from "@/lib/tax/canton-reference";

export type OnboardingPersonState = {
  birthDate: string;
  gender: "male" | "female" | "";
  employmentStartYear: string;
  retirementAge: string;
  currentSalaryBrutto: string;
  bvgCurrentCapital: string;
  freeAssets: string;
  freeAssetsInterestRate: string;
  annualSavingsToFreeAssets: string;
};

export type OnboardingState = {
  planningMode: "single" | "couple";
  primary: OnboardingPersonState;
  partner: OnboardingPersonState;
  partnerEmploymentEndOffsetYears: string;
  planningHorizonAge: string;
  annualRetirementExpenses: string;
  annualSurvivorExpenses: string;
  inflationRate: string;
  maritalStatus: "single" | "married";
  taxCanton: string;
  taxPostalCode: string;
  taxMunicipality: string;
  scenarioName: string;
};

export function defaultPersonState(): OnboardingPersonState {
  return {
    birthDate: "",
    gender: "",
    employmentStartYear: "",
    retirementAge: "65",
    currentSalaryBrutto: "",
    bvgCurrentCapital: "",
    freeAssets: "",
    freeAssetsInterestRate: "4",
    annualSavingsToFreeAssets: "",
  };
}

export function defaultOnboardingState(): OnboardingState {
  return {
    planningMode: "single",
    primary: defaultPersonState(),
    partner: defaultPersonState(),
    partnerEmploymentEndOffsetYears: "0",
    planningHorizonAge: "95",
    annualRetirementExpenses: "",
    annualSurvivorExpenses: "",
    inflationRate: "1.5",
    maritalStatus: "single",
    taxCanton: DEFAULT_TAX_CANTON_CODE,
    taxPostalCode: "",
    taxMunicipality: "",
    scenarioName: "Basis-Szenario",
  };
}

export function onboardingStateFromProfile(row: {
  birth_date?: string | null;
  gender?: string | null;
  employment_start_year?: number | null;
  retirement_age?: number | null;
  current_salary_brutto?: number | null;
  bvg_current_capital?: number | null;
  free_assets?: number | null;
  free_assets_interest_rate?: number | null;
  annual_savings_to_free_assets?: number | null;
  planning_horizon_age?: number | null;
  annual_retirement_expenses?: number | null;
  annual_survivor_expenses?: number | null;
  inflation_rate?: number | null;
  marital_status?: string | null;
  tax_canton?: string | null;
  tax_postal_code?: string | null;
  tax_municipality?: string | null;
  planning_mode?: string | null;
  partner_profile?: unknown;
} | null): OnboardingState {
  const base = defaultOnboardingState();
  if (!row) return base;

  const partnerRaw = row.partner_profile as Record<string, unknown> | null;

  const personFromRow = (
    p: Record<string, unknown> | null | undefined,
  ): OnboardingPersonState => {
    if (!p) return defaultPersonState();

    return {
      birthDate: String(p.birth_date ?? "").slice(0, 10),
      gender:
        p.gender === "male" || p.gender === "female"
          ? (p.gender as "male" | "female")
          : "",
      employmentStartYear:
        p.employment_start_year != null ? String(p.employment_start_year) : "",
      retirementAge:
        p.retirement_age != null ? String(p.retirement_age) : "65",
      currentSalaryBrutto:
        p.current_salary_brutto != null
          ? formatSwissNumber(Number(p.current_salary_brutto))
          : "",
      bvgCurrentCapital:
        p.bvg_current_capital != null
          ? formatSwissNumber(Number(p.bvg_current_capital))
          : "",
      freeAssets:
        p.free_assets != null ? formatSwissNumber(Number(p.free_assets)) : "",
      freeAssetsInterestRate:
        p.free_assets_interest_rate != null
          ? String(decimalRateToPercent(Number(p.free_assets_interest_rate)))
          : "4",
      annualSavingsToFreeAssets:
        p.annual_savings_to_free_assets != null
          ? formatSwissNumber(Number(p.annual_savings_to_free_assets))
          : "",
    };
  };

  return {
    ...base,
    planningMode: row.planning_mode === "couple" ? "couple" : "single",
    primary: personFromRow(row),
    partner: partnerRaw ? personFromRow(partnerRaw) : defaultPersonState(),
    partnerEmploymentEndOffsetYears: partnerRaw?.employment_end_offset_years
      ? String(partnerRaw.employment_end_offset_years)
      : "0",
    planningHorizonAge:
      row.planning_horizon_age != null ? String(row.planning_horizon_age) : "95",
    annualRetirementExpenses:
      row.annual_retirement_expenses != null
        ? formatSwissNumber(row.annual_retirement_expenses)
        : "",
    annualSurvivorExpenses:
      row.annual_survivor_expenses != null
        ? formatSwissNumber(row.annual_survivor_expenses)
        : "",
    inflationRate:
      row.inflation_rate != null
        ? String(decimalRateToPercent(row.inflation_rate))
        : "1.5",
    maritalStatus: row.marital_status === "married" ? "married" : "single",
    taxCanton: row.tax_canton ?? DEFAULT_TAX_CANTON_CODE,
    taxPostalCode: row.tax_postal_code ?? "",
    taxMunicipality: row.tax_municipality ?? "",
  };
}

function appendPrimaryPerson(form: FormData, person: OnboardingPersonState) {
  form.set("birthDate", person.birthDate);
  form.set("gender", person.gender);
  form.set("employmentStartYear", person.employmentStartYear);
  form.set("retirementAge", person.retirementAge);
  form.set("currentSalaryBrutto", person.currentSalaryBrutto);
  form.set("bvgCurrentCapital", person.bvgCurrentCapital);
  form.set("freeAssets", person.freeAssets);
  form.set("freeAssetsInterestRate", person.freeAssetsInterestRate);
  form.set("annualSavingsToFreeAssets", person.annualSavingsToFreeAssets);
}

function appendPartnerPerson(form: FormData, person: OnboardingPersonState) {
  form.set("partnerBirthDate", person.birthDate);
  form.set("partnerGender", person.gender);
  form.set("partnerEmploymentStartYear", person.employmentStartYear);
  form.set("partnerRetirementAge", person.retirementAge);
  form.set("partnerCurrentSalaryBrutto", person.currentSalaryBrutto);
  form.set("partnerBvgCurrentCapital", person.bvgCurrentCapital);
  form.set("partnerFreeAssets", person.freeAssets);
  form.set("partnerFreeAssetsInterestRate", person.freeAssetsInterestRate);
  form.set("partnerAnnualSavingsToFreeAssets", person.annualSavingsToFreeAssets);
  form.set("partnerEmploymentEndMode", "later");
}

/** Baut FormData im gleichen Format wie die Stammdaten-Seite. */
export function buildFormDataFromOnboardingState(state: OnboardingState): FormData {
  const form = new FormData();
  form.set("planningMode", state.planningMode);
  appendPrimaryPerson(form, state.primary);

  if (state.planningMode === "couple") {
    appendPartnerPerson(form, state.partner);
    form.set(
      "partnerEmploymentEndOffsetYears",
      state.partnerEmploymentEndOffsetYears,
    );
  }

  form.set("planningHorizonAge", state.planningHorizonAge);
  form.set("annualRetirementExpenses", state.annualRetirementExpenses);
  form.set("annualSurvivorExpenses", state.annualSurvivorExpenses);
  form.set("inflationRate", state.inflationRate);
  form.set("maritalStatus", state.maritalStatus);
  form.set("taxCanton", state.taxCanton);
  form.set("taxPostalCode", state.taxPostalCode);
  form.set("taxMunicipality", state.taxMunicipality);

  form.set(
    "bvgInterestRate",
    String(decimalRateToPercent(BVG_MIN_INTEREST_RATE)),
  );
  form.set(
    "bvgConversionRate",
    String(decimalRateToPercent(BVG_CONVERSION_RATE)),
  );
  form.set("bvgContributionRates", defaultBvgContributionRatesJson());
  form.set("pillar3aAccountsJson", "[]");
  form.set("pillar3aPartnerAccountsJson", "[]");

  return form;
}

export function shouldShowOnboarding(profile: {
  onboarding_completed_at?: string | null;
  onboarding_skipped_at?: string | null;
} | null): boolean {
  if (!profile) return true;
  if (profile.onboarding_completed_at) return false;
  if (profile.onboarding_skipped_at) return false;
  return true;
}

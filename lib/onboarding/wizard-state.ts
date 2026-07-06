import { defaultBvgContributionRatesJson } from "@/lib/bvg/default-contribution-json";
import {
  BVG_CONVERSION_RATE,
  BVG_MIN_INTEREST_RATE,
} from "@/lib/engine/constants";
import {
  decimalRateToPercent,
  formatSwissNumber,
} from "@/lib/format/numbers";
import {
  rowToPillar3aDraft,
  serializePillar3aDrafts,
  type Pillar3aAccountRow,
} from "@/lib/pillar3a/accounts";
import { DEFAULT_TAX_CANTON_CODE } from "@/lib/tax/canton-reference";

const DEFAULT_BVG_INTEREST_PCT = String(
  decimalRateToPercent(BVG_MIN_INTEREST_RATE),
);
const DEFAULT_BVG_CONVERSION_PCT = String(
  decimalRateToPercent(BVG_CONVERSION_RATE),
);

export type OnboardingPersonState = {
  /** Vorname (ersetzt «Person 1/2» in der UI). */
  firstName: string;
  birthDate: string;
  gender: "male" | "female" | "";
  employmentStartYear: string;
  retirementAge: string;
  currentSalaryBrutto: string;
  bvgCurrentCapital: string;
  bvgInterestRate: string;
  bvgConversionRate: string;
  bvgCoordinatedSalaryOverride: string;
  /** Sparquote pro Person (fliesst ins gemeinsame freie Vermögen). */
  annualSavingsToFreeAssets: string;
  /** Serialisierte 3a-Konten (gleiches Format wie Stammdaten-FormData). */
  pillar3aAccountsJson: string;
};

export type OnboardingState = {
  planningMode: "single" | "couple";
  primary: OnboardingPersonState;
  partner: OnboardingPersonState;
  partnerEmploymentEndOffsetYears: string;
  /** Freies Vermögen als Haushaltswert (ein gemeinsamer Topf). */
  freeAssets: string;
  /** Rendite des gemeinsamen freien Vermögens. */
  freeAssetsInterestRate: string;
  planningHorizonAge: string;
  annualRetirementExpenses: string;
  annualSurvivorExpenses: string;
  inflationRate: string;
  /** Standard-Rendite 3a (Fallback für Konten ohne eigene Rendite). */
  pillar3aDefaultReturn: string;
  maritalStatus: "single" | "married";
  taxCanton: string;
  taxPostalCode: string;
  taxMunicipality: string;
  scenarioName: string;
};

export function defaultPersonState(): OnboardingPersonState {
  return {
    firstName: "",
    birthDate: "",
    gender: "",
    employmentStartYear: "",
    retirementAge: "65",
    currentSalaryBrutto: "",
    bvgCurrentCapital: "",
    bvgInterestRate: DEFAULT_BVG_INTEREST_PCT,
    bvgConversionRate: DEFAULT_BVG_CONVERSION_PCT,
    bvgCoordinatedSalaryOverride: "",
    annualSavingsToFreeAssets: "",
    pillar3aAccountsJson: "[]",
  };
}

export function defaultOnboardingState(): OnboardingState {
  return {
    planningMode: "single",
    primary: defaultPersonState(),
    partner: defaultPersonState(),
    partnerEmploymentEndOffsetYears: "0",
    freeAssets: "",
    freeAssetsInterestRate: "4",
    planningHorizonAge: "95",
    annualRetirementExpenses: "",
    annualSurvivorExpenses: "",
    inflationRate: "1.5",
    pillar3aDefaultReturn: "3",
    maritalStatus: "single",
    taxCanton: DEFAULT_TAX_CANTON_CODE,
    taxPostalCode: "",
    taxMunicipality: "",
    scenarioName: "Basis-Szenario",
  };
}

export function onboardingStateFromProfile(
  row: {
    first_name?: string | null;
    birth_date?: string | null;
    gender?: string | null;
    employment_start_year?: number | null;
    retirement_age?: number | null;
    current_salary_brutto?: number | null;
    bvg_current_capital?: number | null;
    bvg_interest_rate?: number | null;
    bvg_conversion_rate?: number | null;
    bvg_coordinated_salary_override?: number | null;
    free_assets?: number | null;
    free_assets_interest_rate?: number | null;
    annual_savings_to_free_assets?: number | null;
    pillar3a_interest_rate?: number | null;
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
  } | null,
  pillar3a?: {
    primary?: Pillar3aAccountRow[];
    partner?: Pillar3aAccountRow[];
  },
): OnboardingState {
  const base = defaultOnboardingState();
  if (!row) return base;

  const partnerRaw = row.partner_profile as Record<string, unknown> | null;

  const accountsToJson = (accounts?: Pillar3aAccountRow[]): string =>
    accounts && accounts.length > 0
      ? serializePillar3aDrafts(accounts.map(rowToPillar3aDraft))
      : "[]";

  const personFromRow = (
    p: Record<string, unknown> | null | undefined,
    accountsJson: string,
  ): OnboardingPersonState => {
    if (!p) return { ...defaultPersonState(), pillar3aAccountsJson: accountsJson };

    return {
      firstName: String(p.first_name ?? ""),
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
      bvgInterestRate:
        p.bvg_interest_rate != null
          ? String(decimalRateToPercent(Number(p.bvg_interest_rate)))
          : DEFAULT_BVG_INTEREST_PCT,
      bvgConversionRate:
        p.bvg_conversion_rate != null
          ? String(decimalRateToPercent(Number(p.bvg_conversion_rate)))
          : DEFAULT_BVG_CONVERSION_PCT,
      bvgCoordinatedSalaryOverride:
        p.bvg_coordinated_salary_override != null &&
        Number(p.bvg_coordinated_salary_override) > 0
          ? formatSwissNumber(Number(p.bvg_coordinated_salary_override))
          : "",
      annualSavingsToFreeAssets:
        p.annual_savings_to_free_assets != null
          ? formatSwissNumber(Number(p.annual_savings_to_free_assets))
          : "",
      pillar3aAccountsJson: accountsJson,
    };
  };

  return {
    ...base,
    planningMode: row.planning_mode === "couple" ? "couple" : "single",
    primary: personFromRow(row, accountsToJson(pillar3a?.primary)),
    partner: partnerRaw
      ? personFromRow(partnerRaw, accountsToJson(pillar3a?.partner))
      : { ...defaultPersonState(), pillar3aAccountsJson: accountsToJson(pillar3a?.partner) },
    partnerEmploymentEndOffsetYears: partnerRaw?.employment_end_offset_years
      ? String(partnerRaw.employment_end_offset_years)
      : "0",
    freeAssets:
      row.free_assets != null ? formatSwissNumber(Number(row.free_assets)) : "",
    freeAssetsInterestRate:
      row.free_assets_interest_rate != null
        ? String(decimalRateToPercent(Number(row.free_assets_interest_rate)))
        : "4",
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
    pillar3aDefaultReturn:
      row.pillar3a_interest_rate != null
        ? String(decimalRateToPercent(row.pillar3a_interest_rate))
        : "3",
    maritalStatus: row.marital_status === "married" ? "married" : "single",
    taxCanton: row.tax_canton ?? DEFAULT_TAX_CANTON_CODE,
    taxPostalCode: row.tax_postal_code ?? "",
    taxMunicipality: row.tax_municipality ?? "",
  };
}

function appendPrimaryPerson(form: FormData, person: OnboardingPersonState) {
  form.set("firstName", person.firstName);
  form.set("birthDate", person.birthDate);
  form.set("gender", person.gender);
  form.set("employmentStartYear", person.employmentStartYear);
  form.set("retirementAge", person.retirementAge);
  form.set("currentSalaryBrutto", person.currentSalaryBrutto);
  form.set("bvgCurrentCapital", person.bvgCurrentCapital);
  form.set("bvgInterestRate", person.bvgInterestRate);
  form.set("bvgConversionRate", person.bvgConversionRate);
  form.set("bvgCoordinatedSalaryOverride", person.bvgCoordinatedSalaryOverride);
  form.set("bvgContributionRates", defaultBvgContributionRatesJson());
  form.set("annualSavingsToFreeAssets", person.annualSavingsToFreeAssets);
  form.set("pillar3aAccountsJson", person.pillar3aAccountsJson || "[]");
}

function appendPartnerPerson(form: FormData, person: OnboardingPersonState) {
  form.set("partnerFirstName", person.firstName);
  form.set("partnerBirthDate", person.birthDate);
  form.set("partnerGender", person.gender);
  form.set("partnerEmploymentStartYear", person.employmentStartYear);
  form.set("partnerRetirementAge", person.retirementAge);
  form.set("partnerCurrentSalaryBrutto", person.currentSalaryBrutto);
  form.set("partnerBvgCurrentCapital", person.bvgCurrentCapital);
  form.set("partnerBvgInterestRate", person.bvgInterestRate);
  form.set("partnerBvgConversionRate", person.bvgConversionRate);
  form.set(
    "partnerBvgCoordinatedSalaryOverride",
    person.bvgCoordinatedSalaryOverride,
  );
  form.set("partnerBvgContributionRates", defaultBvgContributionRatesJson());
  form.set("partnerAnnualSavingsToFreeAssets", person.annualSavingsToFreeAssets);
  form.set("pillar3aPartnerAccountsJson", person.pillar3aAccountsJson || "[]");
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
  } else {
    form.set("pillar3aPartnerAccountsJson", "[]");
  }

  form.set("freeAssets", state.freeAssets);
  form.set("freeAssetsInterestRate", state.freeAssetsInterestRate);
  form.set("planningHorizonAge", state.planningHorizonAge);
  form.set("annualRetirementExpenses", state.annualRetirementExpenses);
  form.set("annualSurvivorExpenses", state.annualSurvivorExpenses);
  form.set("inflationRate", state.inflationRate);
  form.set("pillar3aInterestRate", state.pillar3aDefaultReturn);
  form.set("maritalStatus", state.maritalStatus);
  form.set("taxCanton", state.taxCanton);
  form.set("taxPostalCode", state.taxPostalCode);
  form.set("taxMunicipality", state.taxMunicipality);

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

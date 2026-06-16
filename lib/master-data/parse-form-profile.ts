import { parseDbAmount } from "@/lib/format/db-numbers";
import {
  normalizeDbRate,
  parsePercentToDecimal,
  parseSwissNumber,
} from "@/lib/format/numbers";
import {
  BVG_CONVERSION_RATE,
  BVG_MIN_INTEREST_RATE,
} from "@/lib/engine/constants";
import { inflationRateFromProfile } from "@/lib/engine/inflation";
import type { ProfileForScenario } from "@/lib/engine";
import { normalizeWorkloadReductions } from "@/lib/engine/workload";
import {
  partnerDataToProfileForScenario,
  partnerProfileFromForm,
  parsePlanningMode,
} from "@/lib/household/partner-profile";
import type { HouseholdProfileForScenario } from "@/lib/household/types";
import { persistedPillar3aAccountIdOrNull } from "@/lib/pillar3a/accounts";
import { buildExtensionsPayload } from "@/lib/profile/extensions";
import type { TaxSettings } from "@/lib/tax/additional-income-tax";
import { DEFAULT_TAX_CANTON_CODE } from "@/lib/tax/canton-reference";
import { taxSettingsFromProfile } from "@/lib/tax/profile-tax";

/** Live preview: tax domicile from current form values (not stale server profile). */
export function taxSettingsFromFormData(formData: FormData): TaxSettings {
  const maritalStatus = formData.get("maritalStatus");
  const canton = formData.get("taxCanton");
  const municipality = formData.get("taxMunicipality");

  return taxSettingsFromProfile({
    marital_status:
      typeof maritalStatus === "string" && maritalStatus.trim()
        ? maritalStatus
        : "single",
    tax_canton:
      typeof canton === "string" && canton.trim()
        ? canton
        : DEFAULT_TAX_CANTON_CODE,
    tax_municipality:
      typeof municipality === "string" && municipality.trim()
        ? municipality.trim()
        : null,
    tax_municipality_steuerfuss: null,
  });
}

function toYearOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBvgContributionRates(
  raw: FormDataEntryValue | null,
): Record<string, number> | null {
  if (typeof raw !== "string" || !raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    const converted: Record<string, number> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val !== "number" || !Number.isFinite(val)) continue;
      converted[key] = val > 1 || val < -1 ? val / 100 : val;
    }
    return Object.keys(converted).length > 0 ? converted : null;
  } catch {
    return null;
  }
}

function parsePillar3aAccountsFromForm(
  raw: FormDataEntryValue | null,
): ProfileForScenario["pillar3aAccounts"] {
  if (typeof raw !== "string" || !raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    return parsed.map((item, index) => ({
      id:
        persistedPillar3aAccountIdOrNull(
          typeof item.id === "string" ? item.id : null,
        ) ?? `draft-${index}`,
      name:
        typeof item.name === "string" && item.name.trim()
          ? item.name.trim()
          : `3a-Konto ${index + 1}`,
      currentCapital: parseDbAmount(item.currentValue),
      annualContribution: parseDbAmount(item.annualContribution),
      returnRate:
        item.returnRatePercent != null && item.returnRatePercent !== ""
          ? normalizeDbRate(Number(item.returnRatePercent), 0.03)
          : null,
    }));
  } catch {
    return [];
  }
}

function primaryProfileFromForm(
  formData: FormData,
  taxSettings: TaxSettings,
): ProfileForScenario | null {
  const birthDateRaw = formData.get("birthDate");
  if (typeof birthDateRaw !== "string" || !birthDateRaw.trim()) return null;

  const salary = parseSwissNumber(
    String(formData.get("currentSalaryBrutto") ?? ""),
  );
  if (!salary || salary <= 0) return null;

  const extensions = buildExtensionsPayload(formData);
  const genderRaw = formData.get("gender");

  return {
    birthDate: birthDateRaw,
    gender:
      genderRaw === "male" || genderRaw === "female"
        ? genderRaw
        : null,
    employmentStartYear: toYearOrNull(formData.get("employmentStartYear")),
    retirementAge: toYearOrNull(formData.get("retirementAge")) ?? 65,
    currentSalaryBrutto: salary,
    bvgCurrentCapital: parseSwissNumber(
      String(formData.get("bvgCurrentCapital") ?? ""),
    ),
    freeAssets: parseSwissNumber(String(formData.get("freeAssets") ?? "")),
    bvgInterestRate:
      parsePercentToDecimal(String(formData.get("bvgInterestRate") ?? "")) ??
      null,
    bvgConversionRate:
      parsePercentToDecimal(String(formData.get("bvgConversionRate") ?? "")) ??
      null,
    bvgContributionRates: parseBvgContributionRates(
      formData.get("bvgContributionRates"),
    ),
    bvgCoordinatedSalaryOverride: (() => {
      const v = parseSwissNumber(
        String(formData.get("bvgCoordinatedSalaryOverride") ?? ""),
      );
      return v > 0 ? v : null;
    })(),
    freeAssetsInterestRate:
      parsePercentToDecimal(
        String(formData.get("freeAssetsInterestRate") ?? ""),
      ) ?? null,
    annualSavingsToFreeAssets: parseSwissNumber(
      String(formData.get("annualSavingsToFreeAssets") ?? ""),
    ),
    pillar3aDefaultReturnRate:
      parsePercentToDecimal(
        String(formData.get("pillar3aInterestRate") ?? ""),
      ) ?? null,
    pillar3aAutoSplit: extensions.pillar3a_auto_split_enabled
      ? {
          enabled: true,
          threshold: extensions.pillar3a_auto_split_threshold ?? 0,
          contributionMode: extensions.pillar3a_auto_split_contribution_mode,
          namePrefix: extensions.pillar3a_auto_split_name_prefix,
        }
      : undefined,
    planningHorizonAge: extensions.planning_horizon_age ?? 95,
    annualRetirementExpenses: extensions.annual_retirement_expenses,
    annualSurvivorExpenses: extensions.annual_survivor_expenses,
    workloadReductions: normalizeWorkloadReductions(extensions.workload_reductions),
    taxSettings,
    pillar3aAccounts: parsePillar3aAccountsFromForm(
      formData.get("pillar3aAccountsJson"),
    ),
    inflationRate: inflationRateFromProfile(extensions.inflation_rate),
  };
}

/** Parse live master-data form values into a household profile for preview calculations. */
export function parseMasterDataFormToHousehold(
  formData: FormData,
  taxSettings: TaxSettings,
): HouseholdProfileForScenario | null {
  const primary = primaryProfileFromForm(formData, taxSettings);
  if (!primary) return null;

  const planningMode = parsePlanningMode(formData.get("planningMode"));
  const partnerData =
    planningMode === "couple" ? partnerProfileFromForm(formData) : null;
  const partner =
    planningMode === "couple"
      ? partnerDataToProfileForScenario(partnerData, [], {
          planningHorizonAge: primary.planningHorizonAge,
          annualRetirementExpenses: 0,
          taxSettings: primary.taxSettings,
          pillar3aDefaultReturnRate: primary.pillar3aDefaultReturnRate ?? null,
          pillar3aAutoSplit: primary.pillar3aAutoSplit,
          inflationRate: primary.inflationRate,
        })
      : null;

  if (planningMode === "couple" && partner) {
    partner.pillar3aAccounts = parsePillar3aAccountsFromForm(
      formData.get("pillar3aPartnerAccountsJson"),
    );
    partner.bvgInterestRate =
      partnerData?.bvg_interest_rate != null
        ? normalizeDbRate(partnerData.bvg_interest_rate, BVG_MIN_INTEREST_RATE)
        : null;
    partner.bvgConversionRate =
      partnerData?.bvg_conversion_rate != null
        ? normalizeDbRate(partnerData.bvg_conversion_rate, BVG_CONVERSION_RATE)
        : null;
  }

  return {
    planningMode,
    primary,
    partner,
    partnerEmploymentEndOffsetYears:
      partnerData?.employment_end_offset_years ?? 0,
  };
}

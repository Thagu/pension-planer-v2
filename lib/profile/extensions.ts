import type { User } from "@supabase/supabase-js";

import { parsePercentToDecimal, parseSwissNumber } from "@/lib/format/numbers";
import {
  normalizeWorkloadReductions,
  parseWorkloadReductionsFromForm,
  type WorkloadReduction,
} from "@/lib/engine/workload";

/** Zusatzfelder aus profiles (Migration 003/005/006); Metadata nur Fallback wenn Spalten fehlen */
export type ProfileExtensions = {
  bvg_coordinated_salary_override: number | null;
  annual_savings_to_free_assets: number;
  planning_horizon_age: number | null;
  annual_retirement_expenses: number;
  /** Netto-Lebenshaltung wenn nur ein Partner lebt (Paarmodus) */
  annual_survivor_expenses: number;
  pillar3a_auto_split_enabled: boolean;
  pillar3a_auto_split_threshold: number | null;
  pillar3a_auto_split_contribution_mode: "max" | "last";
  pillar3a_auto_split_name_prefix: string;
  marital_status: "single" | "married" | null;
  tax_canton: string | null;
  tax_postal_code: string | null;
  tax_municipality: string | null;
  tax_municipality_steuerfuss: number | null;
  workload_reductions: WorkloadReduction[];
  inflation_rate: number | null;
};

const METADATA_KEY = "pension_planner_extensions";

export function extensionsFromUserMetadata(
  user: User | null | undefined,
): ProfileExtensions | null {
  const raw = user?.user_metadata?.[METADATA_KEY];
  if (!raw || typeof raw !== "object") return null;

  const ext = raw as Partial<ProfileExtensions>;
  return {
    bvg_coordinated_salary_override:
      ext.bvg_coordinated_salary_override != null
        ? Number(ext.bvg_coordinated_salary_override)
        : null,
    annual_savings_to_free_assets: Number(ext.annual_savings_to_free_assets ?? 0),
    planning_horizon_age:
      ext.planning_horizon_age != null
        ? Number(ext.planning_horizon_age)
        : null,
    annual_retirement_expenses: Number(ext.annual_retirement_expenses ?? 0),
    annual_survivor_expenses: Number(ext.annual_survivor_expenses ?? 0),
    pillar3a_auto_split_enabled: Boolean(ext.pillar3a_auto_split_enabled),
    pillar3a_auto_split_threshold:
      ext.pillar3a_auto_split_threshold != null
        ? Number(ext.pillar3a_auto_split_threshold)
        : null,
    pillar3a_auto_split_contribution_mode:
      ext.pillar3a_auto_split_contribution_mode === "last" ? "last" : "max",
    pillar3a_auto_split_name_prefix:
      typeof ext.pillar3a_auto_split_name_prefix === "string" &&
      ext.pillar3a_auto_split_name_prefix.trim()
        ? ext.pillar3a_auto_split_name_prefix.trim()
        : "3a-Konto",
    marital_status:
      ext.marital_status === "married" || ext.marital_status === "single"
        ? ext.marital_status
        : null,
    tax_canton: typeof ext.tax_canton === "string" ? ext.tax_canton : null,
    tax_postal_code:
      typeof ext.tax_postal_code === "string" ? ext.tax_postal_code : null,
    tax_municipality:
      typeof ext.tax_municipality === "string" ? ext.tax_municipality : null,
    tax_municipality_steuerfuss:
      ext.tax_municipality_steuerfuss != null
        ? Number(ext.tax_municipality_steuerfuss)
        : null,
    workload_reductions: normalizeWorkloadReductions(
      Array.isArray(ext.workload_reductions)
        ? (ext.workload_reductions as WorkloadReduction[])
        : [],
    ),
    inflation_rate:
      ext.inflation_rate != null ? Number(ext.inflation_rate) : null,
  };
}

type MergeableProfile = {
  bvg_coordinated_salary_override?: number | null;
  annual_savings_to_free_assets?: number | null;
  planning_horizon_age?: number | null;
  annual_retirement_expenses?: number | null;
  annual_survivor_expenses?: number | null;
  pillar3a_auto_split_enabled?: boolean | null;
  pillar3a_auto_split_threshold?: number | null;
  pillar3a_auto_split_contribution_mode?: string | null;
  pillar3a_auto_split_name_prefix?: string | null;
  marital_status?: string | null;
  tax_canton?: string | null;
  tax_postal_code?: string | null;
  tax_municipality?: string | null;
  tax_municipality_steuerfuss?: number | null;
  workload_reductions?: WorkloadReduction[] | null;
  inflation_rate?: number | null;
};

export function mergeProfileWithExtensions<T extends MergeableProfile>(
  profile: T | null,
  user: User | null | undefined,
): T | null {
  if (!profile) return null;

  const ext = extensionsFromUserMetadata(user);
  if (!ext) return profile;

  return {
    ...profile,
    bvg_coordinated_salary_override:
      profile.bvg_coordinated_salary_override ??
      ext.bvg_coordinated_salary_override,
    annual_savings_to_free_assets:
      profile.annual_savings_to_free_assets ?? ext.annual_savings_to_free_assets,
    planning_horizon_age:
      profile.planning_horizon_age ?? ext.planning_horizon_age,
    annual_retirement_expenses:
      profile.annual_retirement_expenses ?? ext.annual_retirement_expenses,
    annual_survivor_expenses:
      profile.annual_survivor_expenses ?? ext.annual_survivor_expenses,
    pillar3a_auto_split_enabled:
      profile.pillar3a_auto_split_enabled ?? ext.pillar3a_auto_split_enabled,
    pillar3a_auto_split_threshold:
      profile.pillar3a_auto_split_threshold ?? ext.pillar3a_auto_split_threshold,
    pillar3a_auto_split_contribution_mode:
      profile.pillar3a_auto_split_contribution_mode ??
      ext.pillar3a_auto_split_contribution_mode,
    pillar3a_auto_split_name_prefix:
      profile.pillar3a_auto_split_name_prefix ??
      ext.pillar3a_auto_split_name_prefix,
    marital_status: profile.marital_status ?? ext.marital_status,
    tax_canton: profile.tax_canton ?? ext.tax_canton,
    tax_postal_code: profile.tax_postal_code ?? ext.tax_postal_code,
    tax_municipality: profile.tax_municipality ?? ext.tax_municipality,
    tax_municipality_steuerfuss:
      profile.tax_municipality_steuerfuss ?? ext.tax_municipality_steuerfuss,
    workload_reductions:
      profile.workload_reductions ?? ext.workload_reductions,
    inflation_rate: profile.inflation_rate ?? ext.inflation_rate,
  };
}

export function isMissingProfileColumnError(message: string): boolean {
  return /bvg_coordinated_salary_override|annual_savings_to_free_assets|planning_horizon_age|annual_retirement_expenses|annual_survivor_expenses|pillar3a_auto_split|marital_status|tax_canton|tax_postal_code|tax_municipality|workload_reductions|inflation_rate|planning_mode|partner_profile|onboarding_completed_at|onboarding_skipped_at|first_name|column.*does not exist/i.test(
    message,
  );
}

export function buildExtensionsPayload(formData: FormData): ProfileExtensions {
  const overrideRaw = parseSwissNumber(
    (formData.get("bvgCoordinatedSalaryOverride") as string) ?? "",
  );
  const thresholdRaw = parseSwissNumber(
    (formData.get("pillar3aAutoSplitThreshold") as string) ?? "",
  );
  const modeRaw = formData.get("pillar3aAutoSplitContributionMode");
  const prefixRaw = formData.get("pillar3aAutoSplitNamePrefix");

  return {
    bvg_coordinated_salary_override: overrideRaw > 0 ? overrideRaw : null,
    annual_savings_to_free_assets: parseSwissNumber(
      (formData.get("annualSavingsToFreeAssets") as string) ?? "",
    ),
    planning_horizon_age:
      toAgeOrNull(formData.get("planningHorizonAge")) ?? 95,
    annual_retirement_expenses: parseSwissNumber(
      (formData.get("annualRetirementExpenses") as string) ?? "",
    ),
    annual_survivor_expenses: parseSwissNumber(
      (formData.get("annualSurvivorExpenses") as string) ?? "",
    ),
    pillar3a_auto_split_enabled: formData.get("pillar3aAutoSplitEnabled") === "on",
    pillar3a_auto_split_threshold: thresholdRaw > 0 ? thresholdRaw : null,
    pillar3a_auto_split_contribution_mode:
      modeRaw === "last" ? "last" : "max",
    pillar3a_auto_split_name_prefix:
      typeof prefixRaw === "string" && prefixRaw.trim()
        ? prefixRaw.trim()
        : "3a-Konto",
    marital_status: parseMaritalStatus(formData.get("maritalStatus")),
    tax_canton:
      typeof formData.get("taxCanton") === "string" &&
      String(formData.get("taxCanton")).trim()
        ? String(formData.get("taxCanton")).trim().toUpperCase()
        : null,
    tax_postal_code: parsePostalCodeOrNull(formData.get("taxPostalCode")),
    tax_municipality:
      typeof formData.get("taxMunicipality") === "string" &&
      String(formData.get("taxMunicipality")).trim()
        ? String(formData.get("taxMunicipality")).trim()
        : null,
    tax_municipality_steuerfuss: null,
    workload_reductions: parseWorkloadReductionsFromForm(formData),
    inflation_rate: parseInflationRateFromForm(formData),
  };
}

function parseInflationRateFromForm(formData: FormData): number | null {
  const raw = formData.get("inflationRate");
  if (typeof raw !== "string" || !raw.trim()) return null;
  const parsed = parsePercentToDecimal(raw);
  return parsed != null && parsed > 0 ? parsed : null;
}

function parsePostalCodeOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return /^\d{4}$/.test(digits) ? digits : null;
}

function parseMaritalStatus(
  value: FormDataEntryValue | null,
): "single" | "married" | null {
  if (value === "married" || value === "single") return value;
  return null;
}

function toAgeOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function metadataPatchForExtensions(
  extensions: ProfileExtensions,
): Record<string, unknown> {
  return {
    [METADATA_KEY]: extensions,
  };
}

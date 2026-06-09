import type { ProfileForScenario } from "@/lib/engine/orchestrator";
import {
  taxSettingsFromResolvedReferences,
  type TaxSettings,
} from "@/lib/tax/additional-income-tax";
import { resolveTaxReferences } from "@/lib/tax/resolve-tax-reference";
import { DEFAULT_TAX_CANTON_CODE } from "@/lib/tax/canton-reference";
import type { ResolvedTaxReferences } from "@/lib/tax/resolve-tax-reference";

export type ProfileTaxRow = {
  marital_status?: string | null;
  tax_canton?: string | null;
  tax_municipality?: string | null;
  tax_municipality_steuerfuss?: number | null;
};

export function taxSettingsFromProfile(
  row: ProfileTaxRow | null | undefined,
  resolved?: ResolvedTaxReferences | null,
): TaxSettings {
  const params = {
    maritalStatus: row?.marital_status,
    cantonCode: row?.tax_canton ?? DEFAULT_TAX_CANTON_CODE,
    municipality: row?.tax_municipality ?? null,
    municipalitySteuerfuss:
      row?.tax_municipality_steuerfuss != null
        ? Number(row.tax_municipality_steuerfuss)
        : null,
  };

  if (resolved) {
    return taxSettingsFromResolvedReferences(params, resolved);
  }

  return taxSettingsFromResolvedReferences(
    params,
    resolveTaxReferences(params),
  );
}

export function taxSettingsFromScenarioProfile(
  profile: ProfileForScenario,
): TaxSettings {
  return profile.taxSettings ?? { cantonCode: DEFAULT_TAX_CANTON_CODE };
}

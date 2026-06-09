import type { SupabaseClient } from "@supabase/supabase-js";

import { getCantonTaxReference } from "./canton-reference";
import {
  normalizeMunicipalityKey,
  parseTaxAmountsFromDb,
  taxAmountsFromLevels,
  TAX_REFERENCE_INCOME_LEVELS,
  type TaxAmountsByLevel,
  type TaxMaritalStatus,
} from "./types";

export type UpsertLocalTaxReferenceInput = {
  cantonCode: string;
  municipality: string;
  maritalStatus: TaxMaritalStatus;
  taxAmounts: TaxAmountsByLevel;
  sourceNotes?: string | null;
  contributedBy?: string | null;
  cantonShareOfLocal?: number | null;
  defaultSteuerfuss?: number | null;
};

export async function upsertLocalTaxReference(
  supabase: SupabaseClient,
  input: UpsertLocalTaxReferenceInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cantonCode = input.cantonCode.toUpperCase();
  const municipality = input.municipality.trim();
  const municipalityKey = normalizeMunicipalityKey(municipality);
  const cantonRef = getCantonTaxReference(cantonCode);

  const amounts: TaxAmountsByLevel = {};
  for (const level of TAX_REFERENCE_INCOME_LEVELS) {
    const key = String(level);
    const value = input.taxAmounts[key];
    if (value == null || !Number.isFinite(value)) {
      return { ok: false, message: `Fehlender Steuerbetrag für CHF ${key}` };
    }
    amounts[key] = Math.round(Math.max(0, value));
  }

  const { error } = await supabase.from("tax_local_reference").upsert(
    {
      canton_code: cantonCode,
      municipality,
      municipality_key: municipalityKey,
      marital_status: input.maritalStatus,
      tax_amounts: amounts,
      canton_share_of_local:
        input.cantonShareOfLocal ?? cantonRef.cantonShareOfLocal,
      default_steuerfuss:
        input.defaultSteuerfuss ?? cantonRef.defaultMunicipalitySteuerfuss,
      source_notes: input.sourceNotes ?? null,
      contributed_by: input.contributedBy ?? null,
    },
    { onConflict: "canton_code,municipality_key,marital_status" },
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

export function localTaxAmountsFromValues(values: number[]): TaxAmountsByLevel {
  return taxAmountsFromLevels(TAX_REFERENCE_INCOME_LEVELS, values);
}

export function isCompleteLocalTaxAmounts(raw: unknown): boolean {
  const parsed = parseTaxAmountsFromDb(raw);
  if (!parsed) return false;
  return TAX_REFERENCE_INCOME_LEVELS.every((level) => parsed[String(level)] != null);
}

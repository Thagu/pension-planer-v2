import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveTaxReferences,
  type ResolvedTaxReferences,
  type TaxFederalReferenceRow,
  type TaxLocalReferenceRow,
} from "./resolve-tax-reference";
import {
  normalizeMaritalStatus,
  normalizeMunicipalityKey,
  type TaxMaritalStatus,
} from "./types";

export type LoadTaxReferenceParams = {
  maritalStatus?: string | null;
  cantonCode?: string | null;
  municipality?: string | null;
  municipalitySteuerfuss?: number | null;
};

export async function loadTaxFederalReference(
  supabase: SupabaseClient,
  maritalStatus: TaxMaritalStatus,
): Promise<TaxFederalReferenceRow | null> {
  const { data, error } = await supabase
    .from("tax_federal_reference")
    .select("marital_status, tax_amounts, source_notes, updated_at")
    .eq("marital_status", maritalStatus)
    .maybeSingle();

  if (error) {
    if (/tax_federal_reference|does not exist/i.test(error.message)) {
      return null;
    }
    throw error;
  }

  return data as TaxFederalReferenceRow | null;
}

export async function loadTaxLocalReference(
  supabase: SupabaseClient,
  cantonCode: string,
  municipality: string,
  maritalStatus: TaxMaritalStatus,
): Promise<TaxLocalReferenceRow | null> {
  const municipalityKey = normalizeMunicipalityKey(municipality);

  const { data, error } = await supabase
    .from("tax_local_reference")
    .select(
      "canton_code, municipality, municipality_key, marital_status, tax_amounts, canton_share_of_local, default_steuerfuss, source_notes, updated_at",
    )
    .eq("canton_code", cantonCode.toUpperCase())
    .eq("municipality_key", municipalityKey)
    .eq("marital_status", maritalStatus)
    .maybeSingle();

  if (error) {
    if (/tax_local_reference|does not exist/i.test(error.message)) {
      return null;
    }
    throw error;
  }

  return data as TaxLocalReferenceRow | null;
}

export async function loadAllTaxFederalReferences(
  supabase: SupabaseClient,
): Promise<TaxFederalReferenceRow[]> {
  const { data, error } = await supabase
    .from("tax_federal_reference")
    .select("marital_status, tax_amounts, source_notes, updated_at")
    .order("marital_status");

  if (error) {
    if (/tax_federal_reference|does not exist/i.test(error.message)) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as TaxFederalReferenceRow[];
}

export async function loadResolvedTaxReferences(
  supabase: SupabaseClient,
  params: LoadTaxReferenceParams,
): Promise<ResolvedTaxReferences> {
  const maritalStatus = normalizeMaritalStatus(params.maritalStatus);
  const cantonCode = (params.cantonCode ?? "ZH").toUpperCase();
  const municipality = params.municipality?.trim() ?? "";

  const [dbFederal, dbLocal] = await Promise.all([
    loadTaxFederalReference(supabase, maritalStatus),
    municipality
      ? loadTaxLocalReference(supabase, cantonCode, municipality, maritalStatus)
      : Promise.resolve(null),
  ]);

  return resolveTaxReferences(params, dbFederal, dbLocal);
}

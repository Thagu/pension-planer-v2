/**
 * Auflösung globaler Steuer-Referenztabellen (DB + Fallback)
 */

import {
  defaultFederalBracketReference,
  defaultLocalBracketReference,
} from "./default-brackets";
import {
  normalizeMaritalStatus,
  normalizeMunicipalityKey,
  parseTaxAmountsFromDb,
  type TaxBracketReference,
  type TaxLocalBracketReference,
  type TaxMaritalStatus,
} from "./types";

export type ResolvedTaxReferences = {
  federal: TaxBracketReference;
  local: TaxLocalBracketReference;
  federalFromDb: boolean;
  localFromDb: boolean;
};

export type TaxFederalReferenceRow = {
  marital_status: TaxMaritalStatus;
  tax_amounts: unknown;
  source_notes?: string | null;
  updated_at?: string | null;
};

export type TaxLocalReferenceRow = {
  canton_code: string;
  municipality: string;
  municipality_key: string;
  marital_status: TaxMaritalStatus;
  tax_amounts: unknown;
  canton_share_of_local?: number | null;
  default_steuerfuss?: number | null;
  source_notes?: string | null;
  updated_at?: string | null;
};

export function resolveTaxReferences(
  params: {
    maritalStatus?: string | null;
    cantonCode?: string | null;
    municipality?: string | null;
    municipalitySteuerfuss?: number | null;
  },
  dbFederal?: TaxFederalReferenceRow | null,
  dbLocal?: TaxLocalReferenceRow | null,
): ResolvedTaxReferences {
  const maritalStatus = normalizeMaritalStatus(params.maritalStatus);
  const cantonCode = (params.cantonCode ?? "ZH").toUpperCase();
  const municipality =
    params.municipality?.trim() ||
    defaultLocalBracketReference(cantonCode, "Zürich", "zurich", maritalStatus)
      .municipality;
  const municipalityKey = normalizeMunicipalityKey(municipality);

  const federalFallback = defaultFederalBracketReference(maritalStatus);
  const federalDbAmounts = dbFederal
    ? parseTaxAmountsFromDb(dbFederal.tax_amounts)
    : null;

  const federal: TaxBracketReference = federalDbAmounts
    ? {
        maritalStatus,
        taxAmounts: federalDbAmounts,
        sourceNotes: dbFederal?.source_notes ?? null,
        updatedAt: dbFederal?.updated_at ?? null,
      }
    : federalFallback;

  const localFallback = defaultLocalBracketReference(
    cantonCode,
    municipality,
    municipalityKey,
    maritalStatus,
  );
  const localDbAmounts = dbLocal ? parseTaxAmountsFromDb(dbLocal.tax_amounts) : null;

  const local: TaxLocalBracketReference = localDbAmounts
    ? {
        cantonCode: dbLocal!.canton_code.toUpperCase(),
        municipality: dbLocal!.municipality,
        municipalityKey: dbLocal!.municipality_key,
        maritalStatus,
        taxAmounts: localDbAmounts,
        cantonShareOfLocal:
          dbLocal!.canton_share_of_local != null
            ? Number(dbLocal!.canton_share_of_local)
            : localFallback.cantonShareOfLocal,
        defaultSteuerfuss:
          dbLocal!.default_steuerfuss != null
            ? Number(dbLocal!.default_steuerfuss)
            : localFallback.defaultSteuerfuss,
        sourceNotes: dbLocal!.source_notes ?? null,
        updatedAt: dbLocal!.updated_at ?? null,
      }
    : localFallback;

  return {
    federal,
    local,
    federalFromDb: Boolean(federalDbAmounts),
    localFromDb: Boolean(localDbAmounts),
  };
}

/**
 * Steuer auf zusätzliches Einkommen ohne Lohn (Kapitalbezüge + Renten)
 * Progression über 5 globale Referenz-Stützpunkte (Bund / Kanton+Gemeinde)
 */

import { getCantonTaxReference } from "./canton-reference";
import { interpolateTaxFromBracketTable } from "./bracket-interpolation";
import {
  defaultFederalBracketReference,
  defaultLocalBracketReference,
} from "./default-brackets";
import type { ResolvedTaxReferences } from "./resolve-tax-reference";
import {
  normalizeMaritalStatus,
  normalizeMunicipalityKey,
  type TaxAmountsByLevel,
  type TaxMaritalStatus,
} from "./types";

export type TaxSettings = {
  maritalStatus?: TaxMaritalStatus | string | null;
  cantonCode?: string | null;
  municipality?: string | null;
  /** Gemeinde-Steuerfuss in % (z. B. 119) */
  municipalitySteuerfuss?: number | null;
  /** Globale Referenz: Bundessteuer je Stützpunkt */
  federalBrackets?: TaxAmountsByLevel | null;
  /** Globale Referenz: Kanton+Gemeinde je Stützpunkt */
  localBrackets?: TaxAmountsByLevel | null;
  cantonShareOfLocal?: number | null;
  referenceSteuerfuss?: number | null;
  federalFromDb?: boolean;
  localFromDb?: boolean;
};

export type AdditionalIncomeTaxBreakdown = {
  additionalIncome: number;
  federal: number;
  canton: number;
  municipal: number;
  total: number;
  effectiveRate: number;
  cantonCode: string;
  cantonName: string;
  municipality: string;
  maritalStatus: TaxMaritalStatus;
  usedFederalDb: boolean;
  usedLocalDb: boolean;
};

export type AdditionalIncomeTaxExplanationStep = {
  label: string;
  value: string;
  detail?: string;
};

function splitLocalTax(
  localTotal: number,
  cantonShare: number,
  steuerfuss: number,
  referenceSteuerfuss: number,
): { canton: number; municipal: number } {
  const defaultFuss = referenceSteuerfuss || 100;
  const fussFactor = steuerfuss / defaultFuss;
  const canton = Math.round(localTotal * cantonShare);
  const municipal = Math.round(localTotal * (1 - cantonShare) * fussFactor);
  return { canton, municipal };
}

function resolveBracketAmounts(settings: TaxSettings): {
  federal: TaxAmountsByLevel;
  local: TaxAmountsByLevel;
  cantonShare: number;
  referenceSteuerfuss: number;
  usedFederalDb: boolean;
  usedLocalDb: boolean;
} {
  const maritalStatus = normalizeMaritalStatus(settings.maritalStatus);
  const cantonCode = (settings.cantonCode ?? "ZH").toUpperCase();
  const cantonRef = getCantonTaxReference(cantonCode);
  const municipality =
    settings.municipality?.trim() || cantonRef.defaultMunicipality;
  const municipalityKey = normalizeMunicipalityKey(municipality);

  const federalFallback = defaultFederalBracketReference(maritalStatus);
  const localFallback = defaultLocalBracketReference(
    cantonCode,
    municipality,
    municipalityKey,
    maritalStatus,
  );

  const federal = settings.federalBrackets ?? federalFallback.taxAmounts;
  const local = settings.localBrackets ?? localFallback.taxAmounts;
  const cantonShare =
    settings.cantonShareOfLocal ?? localFallback.cantonShareOfLocal ?? 0.62;
  const referenceSteuerfuss =
    settings.referenceSteuerfuss ??
    localFallback.defaultSteuerfuss ??
    cantonRef.defaultMunicipalitySteuerfuss;

  return {
    federal,
    local,
    cantonShare,
    referenceSteuerfuss,
    usedFederalDb: Boolean(settings.federalFromDb),
    usedLocalDb: Boolean(settings.localFromDb),
  };
}

export function taxSettingsFromResolvedReferences(
  params: {
    maritalStatus?: string | null;
    cantonCode?: string | null;
    municipality?: string | null;
    municipalitySteuerfuss?: number | null;
  },
  resolved: ResolvedTaxReferences,
): TaxSettings {
  return {
    maritalStatus: normalizeMaritalStatus(params.maritalStatus),
    cantonCode: params.cantonCode ?? resolved.local.cantonCode,
    municipality: params.municipality ?? resolved.local.municipality,
    municipalitySteuerfuss: params.municipalitySteuerfuss,
    federalBrackets: resolved.federal.taxAmounts,
    localBrackets: resolved.local.taxAmounts,
    cantonShareOfLocal: resolved.local.cantonShareOfLocal,
    referenceSteuerfuss: resolved.local.defaultSteuerfuss,
    federalFromDb: resolved.federalFromDb,
    localFromDb: resolved.localFromDb,
  };
}

export function calculateAdditionalIncomeTax(
  additionalIncome: number,
  settings: TaxSettings = {},
): AdditionalIncomeTaxBreakdown {
  const maritalStatus = normalizeMaritalStatus(settings.maritalStatus);
  const cantonCode = (settings.cantonCode ?? "ZH").toUpperCase();
  const cantonRef = getCantonTaxReference(cantonCode);
  const municipality =
    settings.municipality?.trim() || cantonRef.defaultMunicipality;

  if (additionalIncome <= 0) {
    return {
      additionalIncome: 0,
      federal: 0,
      canton: 0,
      municipal: 0,
      total: 0,
      effectiveRate: 0,
      cantonCode: cantonRef.code,
      cantonName: cantonRef.name,
      municipality,
      maritalStatus,
      usedFederalDb: Boolean(settings.federalFromDb),
      usedLocalDb: Boolean(settings.localFromDb),
    };
  }

  const brackets = resolveBracketAmounts(settings);
  const steuerfuss =
    settings.municipalitySteuerfuss ??
    brackets.referenceSteuerfuss ??
    cantonRef.defaultMunicipalitySteuerfuss;
  const federal = interpolateTaxFromBracketTable(
    additionalIncome,
    brackets.federal,
  );
  const localTotal = interpolateTaxFromBracketTable(
    additionalIncome,
    brackets.local,
  );
  const { canton, municipal } = splitLocalTax(
    localTotal,
    brackets.cantonShare,
    steuerfuss,
    brackets.referenceSteuerfuss,
  );
  const total = federal + canton + municipal;

  return {
    additionalIncome: Math.round(additionalIncome),
    federal,
    canton,
    municipal,
    total,
    effectiveRate: total / additionalIncome,
    cantonCode: cantonRef.code,
    cantonName: cantonRef.name,
    municipality,
    maritalStatus,
    usedFederalDb: brackets.usedFederalDb,
    usedLocalDb: brackets.usedLocalDb,
  };
}

export function explainAdditionalIncomeTax(
  breakdown: AdditionalIncomeTaxBreakdown,
): AdditionalIncomeTaxExplanationStep[] {
  if (breakdown.additionalIncome <= 0) return [];

  const statusLabel =
    breakdown.maritalStatus === "married" ? "verheiratet" : "ledig";

  return [
    {
      label: "Zusatzeinkommen (steuerpflichtig)",
      value: `CHF ${breakdown.additionalIncome.toLocaleString("de-CH")}`,
      detail: "Kapitalbezüge + Renten ohne Lohn",
    },
    {
      label: "Bundessteuer",
      value: `CHF ${breakdown.federal.toLocaleString("de-CH")}`,
      detail: breakdown.usedFederalDb
        ? `Referenztabelle (${statusLabel})`
        : `Fallback ESTV 2025 (${statusLabel})`,
    },
    {
      label: `Kantonssteuer (${breakdown.cantonName})`,
      value: `CHF ${breakdown.canton.toLocaleString("de-CH")}`,
      detail: breakdown.usedLocalDb
        ? "Globale Referenz Kanton+Gemeinde"
        : "Fallback Kantonsreferenz",
    },
    {
      label: `Gemeindesteuer (${breakdown.municipality})`,
      value: `CHF ${breakdown.municipal.toLocaleString("de-CH")}`,
    },
    {
      label: "Total Steuerlast",
      value: `CHF ${breakdown.total.toLocaleString("de-CH")}`,
      detail: `Effektiv ${(breakdown.effectiveRate * 100).toFixed(2)}%`,
    },
  ];
}

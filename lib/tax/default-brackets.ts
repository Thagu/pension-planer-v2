/**
 * Standard-Referenzwerte (Fallback ohne DB-Eintrag)
 */

import {
  getCantonTaxReference,
  interpolateLocalEffectiveRate,
} from "./canton-reference";
import { calculateFederalTaxOnLumpSumIncome } from "./federal-income-tax";
import {
  TAX_REFERENCE_INCOME_LEVELS,
  taxAmountsFromLevels,
  type TaxAmountsByLevel,
  type TaxBracketReference,
  type TaxLocalBracketReference,
  type TaxMaritalStatus,
} from "./types";

export function buildDefaultFederalTaxAmounts(
  maritalStatus: TaxMaritalStatus,
): TaxAmountsByLevel {
  const taxes = TAX_REFERENCE_INCOME_LEVELS.map((level) =>
    calculateFederalTaxOnLumpSumIncome(level, maritalStatus),
  );
  return taxAmountsFromLevels(TAX_REFERENCE_INCOME_LEVELS, taxes);
}

export function buildDefaultLocalTaxAmounts(
  cantonCode: string,
  maritalStatus: TaxMaritalStatus,
): TaxAmountsByLevel {
  const reference = getCantonTaxReference(cantonCode);
  const taxes = TAX_REFERENCE_INCOME_LEVELS.map((level) => {
    const rate = interpolateLocalEffectiveRate(reference, level);
    return Math.round(level * rate);
  });
  return taxAmountsFromLevels(TAX_REFERENCE_INCOME_LEVELS, taxes);
}

export function defaultFederalBracketReference(
  maritalStatus: TaxMaritalStatus,
): TaxBracketReference {
  return {
    maritalStatus,
    taxAmounts: buildDefaultFederalTaxAmounts(maritalStatus),
    sourceNotes: "Berechnet aus ESTV-Tarif 2025 (Art. 38 DBG, Fallback)",
  };
}

export function defaultLocalBracketReference(
  cantonCode: string,
  municipality: string,
  municipalityKey: string,
  maritalStatus: TaxMaritalStatus,
): TaxLocalBracketReference {
  const reference = getCantonTaxReference(cantonCode);
  return {
    cantonCode: reference.code,
    municipality,
    municipalityKey,
    maritalStatus,
    taxAmounts: buildDefaultLocalTaxAmounts(reference.code, maritalStatus),
    cantonShareOfLocal: reference.cantonShareOfLocal,
    defaultSteuerfuss: reference.defaultMunicipalitySteuerfuss,
    sourceNotes: `Fallback aus Kantonsreferenz (${reference.name}, ${reference.defaultMunicipality})`,
  };
}

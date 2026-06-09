/**
 * Kapitalbezugssteuer (Kanton+Gemeinde) via ESTV-Steuerrechner
 */

import {
  calculateEstvPensionCapitalTax,
  currentEstvTaxYear,
  fetchEstvMunicipalitySteuerfuss,
  searchEstvLocations,
  type EstvCityResult,
} from "./client";
import {
  TAX_REFERENCE_INCOME_LEVELS,
  type TaxAmountsByLevel,
  type TaxMaritalStatus,
} from "../types";

export type LocalTaxLookupInput = {
  cantonCode: string;
  municipality: string;
  postalCode?: string | null;
  maritalStatus: TaxMaritalStatus;
};

export type LocalTaxLookupResult = {
  taxAmounts: TaxAmountsByLevel;
  sourceNotes: string;
  sources: string[];
  confidence: "high" | "medium" | "low";
  taxLocationId: number;
  taxYear: number;
  steuerfuss: number;
};

const ESTV_SOURCE_URL = "https://swisstaxcalculator.estv.admin.ch";

function normalizeLocationName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function matchesMunicipality(
  location: EstvCityResult,
  municipality: string,
): boolean {
  const target = normalizeLocationName(municipality);
  const candidates = [location.City, location.BfsName].filter(Boolean);
  return candidates.some(
    (name) => normalizeLocationName(name) === target,
  );
}

function resolveEstvLocation(
  locations: EstvCityResult[],
  cantonCode: string,
  municipality: string,
): EstvCityResult {
  const canton = cantonCode.trim().toUpperCase();
  const inCanton = locations.filter(
    (loc) => loc.Canton.trim().toUpperCase() === canton,
  );

  if (inCanton.length === 0) {
    throw new Error(
      `Kein ESTV-Steuerdomizil für Kanton ${canton} gefunden.`,
    );
  }

  const exact = inCanton.filter((loc) => matchesMunicipality(loc, municipality));
  if (exact.length === 1) {
    return exact[0];
  }
  if (exact.length > 1) {
    return exact[0];
  }

  if (inCanton.length === 1) {
    return inCanton[0];
  }

  throw new Error(
    `Gemeinde «${municipality}» konnte im ESTV-Steuerrechner nicht eindeutig zugeordnet werden.`,
  );
}

function enforceMonotonicAmounts(amounts: TaxAmountsByLevel): TaxAmountsByLevel {
  const result: TaxAmountsByLevel = {};
  let previous = 0;
  for (const level of TAX_REFERENCE_INCOME_LEVELS) {
    const key = String(level);
    const value = Math.round(Math.max(0, Number(amounts[key] ?? 0)));
    result[key] = Math.max(value, previous);
    previous = result[key];
  }
  return result;
}

export async function lookupLocalTaxFromEstv(
  input: LocalTaxLookupInput,
): Promise<LocalTaxLookupResult> {
  const municipality = input.municipality.trim();
  if (!municipality) {
    throw new Error("Gemeinde fehlt");
  }

  const cantonCode = input.cantonCode.trim().toUpperCase();
  const taxYear = currentEstvTaxYear();
  const searchTerm = input.postalCode?.trim() || municipality;

  const locations = await searchEstvLocations(searchTerm, taxYear);
  if (locations.length === 0) {
    throw new Error(
      `Kein Steuerdomizil für «${searchTerm}» im ESTV-Steuerrechner gefunden.`,
    );
  }

  const location = resolveEstvLocation(locations, cantonCode, municipality);
  const steuerfuss = await fetchEstvMunicipalitySteuerfuss({
    taxLocationId: location.TaxLocationID,
    taxYear,
  });
  const amounts: TaxAmountsByLevel = {};

  for (const level of TAX_REFERENCE_INCOME_LEVELS) {
    const result = await calculateEstvPensionCapitalTax({
      taxLocationId: location.TaxLocationID,
      capital: level,
      maritalStatus: input.maritalStatus,
      taxYear,
    });
    amounts[String(level)] = Math.round(result.TaxCanton + result.TaxCity);
  }

  return {
    taxAmounts: enforceMonotonicAmounts(amounts),
    sourceNotes: `ESTV Kapitalbezugssteuer ${taxYear}, ${location.City} (${location.Canton}), Steuerfuss ${steuerfuss}%`,
    sources: [ESTV_SOURCE_URL],
    confidence: "high",
    taxLocationId: location.TaxLocationID,
    taxYear,
    steuerfuss,
  };
}

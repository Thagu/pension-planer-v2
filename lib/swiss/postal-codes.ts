/**
 * Schweizer PLZ → Ortschaft / Kanton
 * Quelle: williambelle/switzerland-postal-codes (dist/postal-codes-full.json, MIT)
 */

import postalCodesFull from "./data/postal-codes-full.json";

export type SwissLocality = {
  name: string;
  canton: string;
  latitude?: string;
  longitude?: string;
};

type PostalCodeDataset = Record<string, SwissLocality[]>;

const POSTAL_CODES = postalCodesFull as PostalCodeDataset;

export function normalizePostalCode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!/^\d{4}$/.test(trimmed)) return null;
  return trimmed;
}

export function lookupPostalCode(plz: string): SwissLocality[] {
  const normalized = normalizePostalCode(plz);
  if (!normalized) return [];
  return POSTAL_CODES[normalized] ?? [];
}

export type PostalCodeCantonValidation =
  | { ok: true; localities: SwissLocality[] }
  | { ok: false; error: string };

export function validatePostalCodeForCanton(
  plz: string,
  cantonCode: string,
): PostalCodeCantonValidation {
  const normalized = normalizePostalCode(plz);
  if (!normalized) {
    return { ok: false, error: "Bitte eine gültige 4-stellige PLZ eingeben." };
  }

  const entries = lookupPostalCode(normalized);
  if (entries.length === 0) {
    return { ok: false, error: `PLZ ${normalized} ist nicht bekannt.` };
  }

  const canton = cantonCode.trim().toUpperCase();
  const inCanton = entries.filter((entry) => entry.canton === canton);
  if (inCanton.length === 0) {
    const foundCantons = [...new Set(entries.map((e) => e.canton))].join(", ");
    return {
      ok: false,
      error: `PLZ ${normalized} gehört nicht zum Kanton ${canton} (gefunden: ${foundCantons}).`,
    };
  }

  return { ok: true, localities: inCanton };
}

export function resolveMunicipalityFromPostalCode(
  plz: string,
  cantonCode: string,
  municipalityHint?: string | null,
): PostalCodeCantonValidation & { municipality?: string } {
  const validation = validatePostalCodeForCanton(plz, cantonCode);
  if (!validation.ok) return validation;

  const hint = municipalityHint?.trim();
  if (hint) {
    const match = validation.localities.find(
      (loc) => loc.name.localeCompare(hint, "de-CH", { sensitivity: "base" }) === 0,
    );
    if (match) {
      return { ok: true, localities: validation.localities, municipality: match.name };
    }
    return {
      ok: false,
      error: `Ortschaft «${hint}» passt nicht zur PLZ ${normalizePostalCode(plz)} im Kanton ${cantonCode.toUpperCase()}.`,
    };
  }

  if (validation.localities.length === 1) {
    return {
      ok: true,
      localities: validation.localities,
      municipality: validation.localities[0].name,
    };
  }

  return {
    ok: false,
    error: "Bitte Ortschaft auswählen — mehrere Orte haben diese PLZ im Kanton.",
  };
}

export function sortLocalitiesByName(localities: SwissLocality[]): SwissLocality[] {
  return [...localities].sort((a, b) =>
    a.name.localeCompare(b.name, "de-CH", { sensitivity: "base" }),
  );
}

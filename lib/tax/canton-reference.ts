/**
 * Vereinfachte effektive Steuersätze auf Kapitalleistungen (Kanton + Gemeinde)
 * Referenz: finpension.ch Kapitalbezugssteuer-Vergleich, schwiizerfranke.com (2025/2026)
 * Abzüglich geschätzter Bundessteuer (Art. 38 DBG) → lokaler Restsatz
 *
 * Hinweis: Planungsnäherung – effektive Sätze bei CHF 100'000 bzw. 500'000 Bezug.
 */

export type CantonTaxReference = {
  code: string;
  name: string;
  /** Effektiver Kanton+Gemeinde-Satz bei CHF 100'000 Kapitalbezug (Dezimal) */
  localEffectiveRate100k: number;
  /** Effektiver Kanton+Gemeinde-Satz bei CHF 500'000 */
  localEffectiveRate500k: number;
  /** Anteil der lokalen Steuer, der dem Kanton zufällt (Rest = Gemeinde) */
  cantonShareOfLocal: number;
  /** Referenz-Gemeinde */
  defaultMunicipality: string;
  /** Standard Steuerfuss der Referenz-Gemeinde (%) */
  defaultMunicipalitySteuerfuss: number;
};

export const SWISS_CANTON_TAX_REFERENCE: CantonTaxReference[] = [
  { code: "ZH", name: "Zürich", localEffectiveRate100k: 0.0263, localEffectiveRate500k: 0.0625, cantonShareOfLocal: 0.62, defaultMunicipality: "Zürich", defaultMunicipalitySteuerfuss: 119 },
  { code: "BE", name: "Bern", localEffectiveRate100k: 0.031, localEffectiveRate500k: 0.0635, cantonShareOfLocal: 0.64, defaultMunicipality: "Bern", defaultMunicipalitySteuerfuss: 154 },
  { code: "LU", name: "Luzern", localEffectiveRate100k: 0.0297, localEffectiveRate500k: 0.0547, cantonShareOfLocal: 0.6, defaultMunicipality: "Luzern", defaultMunicipalitySteuerfuss: 115 },
  { code: "UR", name: "Uri", localEffectiveRate100k: 0.018, localEffectiveRate500k: 0.0405, cantonShareOfLocal: 0.58, defaultMunicipality: "Altdorf", defaultMunicipalitySteuerfuss: 100 },
  { code: "SZ", name: "Schwyz", localEffectiveRate100k: 0.014, localEffectiveRate500k: 0.0702, cantonShareOfLocal: 0.55, defaultMunicipality: "Schwyz", defaultMunicipalitySteuerfuss: 100 },
  { code: "OW", name: "Obwalden", localEffectiveRate100k: 0.022, localEffectiveRate500k: 0.045, cantonShareOfLocal: 0.58, defaultMunicipality: "Sarnen", defaultMunicipalitySteuerfuss: 100 },
  { code: "NW", name: "Nidwalden", localEffectiveRate100k: 0.0255, localEffectiveRate500k: 0.048, cantonShareOfLocal: 0.58, defaultMunicipality: "Stans", defaultMunicipalitySteuerfuss: 100 },
  { code: "GL", name: "Glarus", localEffectiveRate100k: 0.0237, localEffectiveRate500k: 0.0485, cantonShareOfLocal: 0.6, defaultMunicipality: "Glarus", defaultMunicipalitySteuerfuss: 100 },
  { code: "ZG", name: "Zug", localEffectiveRate100k: 0.0206, localEffectiveRate500k: 0.0501, cantonShareOfLocal: 0.55, defaultMunicipality: "Zug", defaultMunicipalitySteuerfuss: 100 },
  { code: "FR", name: "Freiburg", localEffectiveRate100k: 0.0249, localEffectiveRate500k: 0.0855, cantonShareOfLocal: 0.63, defaultMunicipality: "Fribourg", defaultMunicipalitySteuerfuss: 120 },
  { code: "SO", name: "Solothurn", localEffectiveRate100k: 0.0267, localEffectiveRate500k: 0.0575, cantonShareOfLocal: 0.62, defaultMunicipality: "Solothurn", defaultMunicipalitySteuerfuss: 115 },
  { code: "BS", name: "Basel-Stadt", localEffectiveRate100k: 0.028, localEffectiveRate500k: 0.0625, cantonShareOfLocal: 0.65, defaultMunicipality: "Basel", defaultMunicipalitySteuerfuss: 100 },
  { code: "BL", name: "Basel-Landschaft", localEffectiveRate100k: 0.0273, localEffectiveRate500k: 0.0605, cantonShareOfLocal: 0.63, defaultMunicipality: "Liestal", defaultMunicipalitySteuerfuss: 100 },
  { code: "SH", name: "Schaffhausen", localEffectiveRate100k: 0.0243, localEffectiveRate500k: 0.0462, cantonShareOfLocal: 0.6, defaultMunicipality: "Schaffhausen", defaultMunicipalitySteuerfuss: 100 },
  { code: "AR", name: "Appenzell A.Rh.", localEffectiveRate100k: 0.025, localEffectiveRate500k: 0.0445, cantonShareOfLocal: 0.58, defaultMunicipality: "Herisau", defaultMunicipalitySteuerfuss: 100 },
  { code: "AI", name: "Appenzell I.Rh.", localEffectiveRate100k: 0.0257, localEffectiveRate500k: 0.0439, cantonShareOfLocal: 0.55, defaultMunicipality: "Appenzell", defaultMunicipalitySteuerfuss: 100 },
  { code: "SG", name: "St. Gallen", localEffectiveRate100k: 0.026, localEffectiveRate500k: 0.0505, cantonShareOfLocal: 0.61, defaultMunicipality: "St. Gallen", defaultMunicipalitySteuerfuss: 100 },
  { code: "GR", name: "Graubünden", localEffectiveRate100k: 0.0249, localEffectiveRate500k: 0.0511, cantonShareOfLocal: 0.6, defaultMunicipality: "Chur", defaultMunicipalitySteuerfuss: 100 },
  { code: "AG", name: "Aargau", localEffectiveRate100k: 0.0253, localEffectiveRate500k: 0.0475, cantonShareOfLocal: 0.62, defaultMunicipality: "Aarau", defaultMunicipalitySteuerfuss: 100 },
  { code: "TG", name: "Thurgau", localEffectiveRate100k: 0.0247, localEffectiveRate500k: 0.0485, cantonShareOfLocal: 0.61, defaultMunicipality: "Frauenfeld", defaultMunicipalitySteuerfuss: 100 },
  { code: "TI", name: "Tessin", localEffectiveRate100k: 0.024, localEffectiveRate500k: 0.0465, cantonShareOfLocal: 0.64, defaultMunicipality: "Bellinzona", defaultMunicipalitySteuerfuss: 100 },
  { code: "VD", name: "Waadt", localEffectiveRate100k: 0.027, localEffectiveRate500k: 0.051, cantonShareOfLocal: 0.63, defaultMunicipality: "Lausanne", defaultMunicipalitySteuerfuss: 100 },
  { code: "VS", name: "Wallis", localEffectiveRate100k: 0.0233, localEffectiveRate500k: 0.044, cantonShareOfLocal: 0.62, defaultMunicipality: "Sion", defaultMunicipalitySteuerfuss: 100 },
  { code: "NE", name: "Neuenburg", localEffectiveRate100k: 0.0317, localEffectiveRate500k: 0.0665, cantonShareOfLocal: 0.64, defaultMunicipality: "Neuchâtel", defaultMunicipalitySteuerfuss: 100 },
  { code: "GE", name: "Genf", localEffectiveRate100k: 0.039, localEffectiveRate500k: 0.093, cantonShareOfLocal: 0.66, defaultMunicipality: "Genève", defaultMunicipalitySteuerfuss: 100 },
  { code: "JU", name: "Jura", localEffectiveRate100k: 0.0283, localEffectiveRate500k: 0.0595, cantonShareOfLocal: 0.63, defaultMunicipality: "Delémont", defaultMunicipalitySteuerfuss: 100 },
];

export const DEFAULT_TAX_CANTON_CODE = "ZH";

export function getCantonsSortedByName(): CantonTaxReference[] {
  return [...SWISS_CANTON_TAX_REFERENCE].sort((a, b) =>
    a.name.localeCompare(b.name, "de-CH", { sensitivity: "base" }),
  );
}

export function getCantonTaxReference(code: string | null | undefined): CantonTaxReference {
  const normalized = (code ?? DEFAULT_TAX_CANTON_CODE).toUpperCase();
  return (
    SWISS_CANTON_TAX_REFERENCE.find((c) => c.code === normalized) ??
    SWISS_CANTON_TAX_REFERENCE[0]
  );
}

export function interpolateLocalEffectiveRate(
  reference: CantonTaxReference,
  amount: number,
): number {
  if (amount <= 0) return 0;
  if (amount <= 100_000) {
    const factor = amount / 100_000;
    return reference.localEffectiveRate100k * (0.88 + 0.12 * factor);
  }
  if (amount >= 500_000) return reference.localEffectiveRate500k;
  const t = (amount - 100_000) / 400_000;
  return (
    reference.localEffectiveRate100k +
    t * (reference.localEffectiveRate500k - reference.localEffectiveRate100k)
  );
}

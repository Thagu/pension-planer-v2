/**
 * Gemeinsame Typen für globale Steuer-Referenztabellen
 */

export const TAX_REFERENCE_INCOME_LEVELS = [
  50_000, 100_000, 250_000, 500_000, 1_000_000,
] as const;

export type TaxReferenceIncomeLevel = (typeof TAX_REFERENCE_INCOME_LEVELS)[number];

export type TaxMaritalStatus = "single" | "married";

export const TAX_MARITAL_STATUS_LABELS: Record<TaxMaritalStatus, string> = {
  single: "Ledig",
  married: "Verheiratet",
};

/** CHF-Steuer pro Stützpunkt (Key = Einkommen als String) */
export type TaxAmountsByLevel = Record<string, number>;

export type TaxBracketReference = {
  maritalStatus: TaxMaritalStatus;
  /** Steuerbetrag (CHF) je Stützpunkt */
  taxAmounts: TaxAmountsByLevel;
  sourceNotes?: string | null;
  updatedAt?: string | null;
};

export type TaxLocalBracketReference = TaxBracketReference & {
  cantonCode: string;
  municipality: string;
  municipalityKey: string;
  cantonShareOfLocal?: number | null;
  defaultSteuerfuss?: number | null;
};

export function normalizeMaritalStatus(
  value: string | null | undefined,
): TaxMaritalStatus {
  return value === "married" ? "married" : "single";
}

export function normalizeMunicipalityKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export function taxAmountsFromLevels(
  levels: readonly number[],
  taxes: readonly number[],
): TaxAmountsByLevel {
  const result: TaxAmountsByLevel = {};
  levels.forEach((level, index) => {
    result[String(level)] = Math.round(taxes[index] ?? 0);
  });
  return result;
}

export function taxAmountsToSortedPoints(
  amounts: TaxAmountsByLevel,
): Array<{ income: number; tax: number }> {
  return TAX_REFERENCE_INCOME_LEVELS.map((level) => ({
    income: level,
    tax: Math.round(amounts[String(level)] ?? 0),
  }));
}

export function parseTaxAmountsFromDb(raw: unknown): TaxAmountsByLevel | null {
  if (!raw || typeof raw !== "object") return null;
  const result: TaxAmountsByLevel = {};
  for (const level of TAX_REFERENCE_INCOME_LEVELS) {
    const key = String(level);
    const value = (raw as Record<string, unknown>)[key];
    if (value == null) continue;
    const num = Number(value);
    if (Number.isFinite(num) && num >= 0) {
      result[key] = Math.round(num);
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Swiss number formatting: apostrophe as thousands separator from 1'000 upward.
 * Percentages are shown as 5 (meaning 5%), stored in DB as 0.05.
 */

/** CHF display with ASCII apostrophe thousands separator (SSR-safe). */
export function formatCHF(amount: number | null | undefined): string {
  const value = Math.round(amount ?? 0);
  const formatted = formatSwissNumber(value, true);
  return formatted.startsWith("-")
    ? `-CHF ${formatted.slice(1)}`
    : `CHF ${formatted}`;
}

export function formatSwissNumber(
  value: number | null | undefined,
  allowZero = false,
): string {
  if (value == null || !Number.isFinite(value)) return "";
  if (value === 0 && !allowZero) return "";

  const negative = value < 0;
  const abs = Math.abs(value);
  const [intPart, decPart] = abs.toFixed(2).split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");

  let result = negative ? `-${formattedInt}` : formattedInt;
  if (decPart && Number(decPart) !== 0) {
    const trimmedDec = decPart.replace(/0+$/, "");
    if (trimmedDec) result += `.${trimmedDec}`;
  }
  return result;
}

export function parseSwissNumber(value: string): number {
  const cleaned = value.trim().replace(/'/g, "").replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return 0;
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Nachkommastellen passend zum Schritt (0.1 → 1, 0.25 → 2). */
export function decimalsForPercentStep(step: number): number {
  if (step >= 1) return 0;
  const stepText = step.toString();
  const dot = stepText.indexOf(".");
  return dot === -1 ? 0 : stepText.length - dot - 1;
}

/** Prozent-Eingabefeld: ohne Float-Artefakte und ohne unnötige Nullen. */
export function formatPercentInput(
  value: number,
  maxDecimals = 2,
): string {
  if (!Number.isFinite(value)) return "";
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(value * factor) / factor;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(maxDecimals).replace(/0+$/, "").replace(/\.$/, "");
}

/** DB decimal (0.05) → display "5" for percent inputs */
export function decimalToPercentDisplay(
  decimal: number | null | undefined,
): string {
  if (decimal == null || !Number.isFinite(decimal)) return "";
  return formatPercentInput(decimalRateToPercent(decimal), 2);
}

/** DB may store 0.068 (decimal) or 6.8 (legacy percent) → always decimal */
export function normalizeDbRate(
  value: unknown,
  fallbackDecimal: number,
): number {
  if (value == null || value === "") return fallbackDecimal;
  const num =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(/'/g, ""));
  if (!Number.isFinite(num)) return fallbackDecimal;
  return Math.abs(num) > 1 ? num / 100 : num;
}

/** Decimal rate (0.068) → display percent number 6.8 */
export function decimalRateToPercent(decimal: number): number {
  return Math.round(decimal * 10000) / 100;
}

export function formatRatePercent(decimal: number, digits = 2): string {
  return `${decimalRateToPercent(decimal).toFixed(digits)}%`;
}

/** Prozentzahl für Anzeige (max. 1 Nachkommastelle, trailing zeros entfernen) */
export function formatPercentOneDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
  return `${text} %`;
}

/** Gespeichertes Szenario: Prozent (6.8) oder Dezimal (0.068) → Anzeige in % */
export function scenarioRateToDisplayPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const pct = Math.abs(value) <= 1 ? decimalRateToPercent(value) : value;
  return Math.round(pct * 100) / 100;
}

/** Form "5" or "5%" → DB decimal 0.05 */
export function parsePercentToDecimal(value: string): number | null {
  const cleaned = value.trim().replace(/%/g, "").replace(",", ".");
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed / 100;
}

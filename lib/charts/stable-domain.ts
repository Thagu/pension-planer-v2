/** Stufen für Y-Achsen-Obergrenze (leicht über dem Datenmaximum). */
function chartCeilingStep(dataMax: number): number {
  if (dataMax >= 10_000_000) return 1_000_000;
  if (dataMax >= 2_000_000) return 500_000;
  if (dataMax >= 500_000) return 100_000;
  if (dataMax >= 100_000) return 50_000;
  return 10_000;
}

/** Aufrunden auf nächste sinnvolle Stufe (z. B. 4.2 Mio → 5 Mio bei 500k-Schritt). */
export function roundChartCeiling(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 100_000;
  const padded = value * 1.05;
  const step = chartCeilingStep(padded);
  return Math.ceil(padded / step) * step;
}

/**
 * Hält die Y-Obergrenze stabil, solange das Datenmaximum innerhalb ±threshold
 * der bisherigen Skala liegt — Kurven bewegen sich statt dass die Skala springt.
 */
export function resolveStableAxisMax(
  dataMax: number,
  previousMax: number | null,
  threshold = 0.2,
): number {
  const next = roundChartCeiling(Math.max(dataMax, 1));
  if (previousMax == null) return next;
  const lower = previousMax * (1 - threshold);
  const upper = previousMax * (1 + threshold);
  if (dataMax >= lower && dataMax <= upper) return previousMax;
  return next;
}

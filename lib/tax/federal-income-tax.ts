/**
 * Direkte Bundessteuer natürliche Personen (Tarif 2025)
 * Quelle: ESTV Form. 58c ab 2025 (auch Kapitalleistungen Art. 38 DBG)
 */

export function calculateFederalIncomeTax2025Single(
  taxableIncome: number,
): number {
  if (taxableIncome <= 0) return 0;

  const brackets: Array<{ upTo: number; base: number; rate: number }> = [
    { upTo: 18_500, base: 0, rate: 0 },
    { upTo: 33_200, base: 0, rate: 0.0077 },
    { upTo: 43_500, base: 138.6, rate: 0.0088 },
    { upTo: 58_000, base: 229.2, rate: 0.0264 },
    { upTo: 76_100, base: 612.0, rate: 0.0297 },
    { upTo: 82_000, base: 1_149.55, rate: 0.0594 },
    { upTo: 108_800, base: 1_500.0, rate: 0.066 },
    { upTo: 141_500, base: 3_268.8, rate: 0.088 },
    { upTo: 184_900, base: 6_146.4, rate: 0.11 },
    { upTo: 793_400, base: 10_920.4, rate: 0.132 },
  ];

  return applyProgressiveBrackets(taxableIncome, brackets);
}

export function calculateFederalIncomeTax2025Married(
  taxableIncome: number,
): number {
  if (taxableIncome <= 0) return 0;

  const brackets: Array<{ upTo: number; base: number; rate: number }> = [
    { upTo: 29_900, base: 0, rate: 0 },
    { upTo: 53_700, base: 0, rate: 0.01 },
    { upTo: 81_800, base: 238, rate: 0.02 },
    { upTo: 108_900, base: 780, rate: 0.03 },
    { upTo: 134_600, base: 1_593, rate: 0.04 },
    { upTo: 164_900, base: 2_621, rate: 0.05 },
    { upTo: 200_700, base: 4_136, rate: 0.06 },
    { upTo: 248_900, base: 6_284, rate: 0.07 },
    { upTo: 316_700, base: 9_658, rate: 0.08 },
    { upTo: 433_200, base: 15_082, rate: 0.09 },
    { upTo: 793_400, base: 25_567, rate: 0.1 },
  ];

  return applyProgressiveBrackets(taxableIncome, brackets);
}

function applyProgressiveBrackets(
  taxableIncome: number,
  brackets: Array<{ upTo: number; base: number; rate: number }>,
): number {
  let previous = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.upTo) {
      return Math.round(
        bracket.base + (taxableIncome - previous) * bracket.rate,
      );
    }
    previous = bracket.upTo;
  }

  return Math.round(taxableIncome * 0.115);
}

/**
 * Kapitalleistungen / Zusatzeinkommen ohne Lohn:
 * Art. 38 DBG – Tarif auf 1/5 des Betrags, Steuer × 5
 */
export function calculateFederalTaxOnLumpSumIncome(
  amount: number,
  maritalStatus: "single" | "married" = "single",
): number {
  if (amount <= 0) return 0;
  const fifth = amount / 5;
  const tariff =
    maritalStatus === "married"
      ? calculateFederalIncomeTax2025Married
      : calculateFederalIncomeTax2025Single;
  return Math.round(tariff(fifth) * 5);
}

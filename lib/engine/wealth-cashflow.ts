/**
 * Vermögens-Cashflow: Zinsen werden zuerst gutgeschrieben;
 * Entnahmen verbrauchen die Jahresverzinsung vor dem Kapital.
 */

export type WealthYearCashflowInput = {
  poolStart: number;
  savingsContribution: number;
  /** Portfolio-Zinsen für das Jahr (auf poolStart, vor Entnahme). */
  portfolioInterest: number;
  capitalInjection: number;
  netWithdrawal: number;
  annualTotalTax: number;
};

export type WealthYearCashflowResult = {
  capitalEnd: number;
  portfolioInterest: number;
  withdrawalFromInterest: number;
  withdrawalFromPrincipal: number;
};

/** Verzinsung auf Jahresanfang (+ halbe Sparquote im Jahr). */
export function calculatePortfolioInterestFromRate(
  poolStart: number,
  savingsContribution: number,
  returnRate: number,
): number {
  if (poolStart <= 0) return 0;
  return Math.round((poolStart + savingsContribution / 2) * returnRate);
}

/**
 * Skaliert Einzelpersonen-Zinsen auf die gepoolte Kapitalbasis, wenn sich
 * Pool und Summe der Einzelstarts unterscheiden (z. B. nach Haushaltsentnahmen).
 */
export function computePortfolioInterest(
  poolStart: number,
  savingsContribution: number,
  referenceCapitalStart: number,
  referenceInterest: number,
  referenceSavings: number,
): number {
  if (poolStart <= 0 || referenceCapitalStart <= 0 || referenceInterest <= 0) {
    return 0;
  }
  const referenceBase = referenceCapitalStart + referenceSavings / 2;
  if (referenceBase <= 0) return 0;
  const effectiveRate = referenceInterest / referenceBase;
  return Math.round((poolStart + savingsContribution / 2) * effectiveRate);
}

export function applyWealthYearCashflow(
  input: WealthYearCashflowInput,
): WealthYearCashflowResult {
  const {
    poolStart,
    savingsContribution,
    portfolioInterest,
    capitalInjection,
    netWithdrawal,
    annualTotalTax,
  } = input;

  const withdrawalFromInterest =
    portfolioInterest > 0
      ? Math.min(portfolioInterest, Math.max(0, netWithdrawal))
      : 0;
  const withdrawalFromPrincipal = Math.max(0, netWithdrawal - withdrawalFromInterest);

  const capitalEnd =
    poolStart +
    savingsContribution +
    portfolioInterest +
    capitalInjection -
    netWithdrawal -
    annualTotalTax;

  return {
    capitalEnd,
    portfolioInterest,
    withdrawalFromInterest,
    withdrawalFromPrincipal,
  };
}

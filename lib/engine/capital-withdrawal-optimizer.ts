/**
 * Steuer-Optimierung für Kapitalbezüge (BVG + 3a)
 * Sucht günstigere Kombination aus Kapital vs. Rente und Bezugszeitpunkten.
 */

import { spreadUniqueWithdrawalOffsets } from "@/lib/pillar3a/accounts";

import {
  BVG_GUIDANCE_MAX_CAPITAL_WITHDRAWAL,
  BVG_MAX_CAPITAL_WITHDRAWAL_TRANCHES,
} from "./constants";
import {
  buildScenarioPensionInput,
  calculateScenarioPension,
  type ProfileForScenario,
  type ScenarioOverrides,
  type ScenarioPensionResult,
} from "./orchestrator";
import {
  getPillar3aEffectiveEarliestWithdrawalAge,
  getPillar3aLatestWithdrawalAge,
  pillar3aWithdrawalOffsetBounds,
} from "./legal-ages";

function formatChf(amount: number): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export type CapitalWithdrawalOptimizationSuggestion = {
  bvgCapitalWithdrawalPercent: number;
  bvgCapitalWithdrawalTranches: number;
  pillar3aWithdrawalSchedule: Record<string, number>;
};

export type CapitalWithdrawalOptimizationResult = {
  hasImprovement: boolean;
  baselineTotalTax: number;
  suggestedTotalTax: number;
  taxSavings: number;
  baselineMonthlyBvg: number;
  suggestedMonthlyBvg: number;
  suggestion: CapitalWithdrawalOptimizationSuggestion;
  summaryText: string;
  explanation: string[];
};

function totalTaxFromResult(result: ScenarioPensionResult): number {
  return (
    result.freeAssets?.projection.reduce(
      (sum, year) => sum + year.annualTotalTax,
      0,
    ) ?? 0
  );
}

function mergeScenarioOverrides(
  base: ScenarioOverrides,
  patch: {
    bvgCapitalWithdrawalPercent?: number;
    bvgCapitalWithdrawalTranches?: number;
    pillar3aWithdrawalSchedule?: Record<string, number>;
  },
): ScenarioOverrides {
  return {
    ...base,
    bvg: {
      ...base.bvg,
      capitalWithdrawalPercent:
        patch.bvgCapitalWithdrawalPercent ??
        base.bvg?.capitalWithdrawalPercent ??
        0,
      capitalWithdrawalTranches:
        patch.bvgCapitalWithdrawalTranches ??
        base.bvg?.capitalWithdrawalTranches ??
        1,
    },
    pillar3a: patch.pillar3aWithdrawalSchedule
      ? {
          ...base.pillar3a,
          withdrawalSchedule: {
            ...base.pillar3a?.withdrawalSchedule,
            ...patch.pillar3aWithdrawalSchedule,
          },
        }
      : base.pillar3a,
  };
}

function uniqueSchedules(
  schedules: Record<string, number>[],
): Record<string, number>[] {
  const seen = new Set<string>();
  const result: Record<string, number>[] = [];
  for (const schedule of schedules) {
    const key = JSON.stringify(
      Object.entries(schedule).sort(([a], [b]) => a.localeCompare(b)),
    );
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(schedule);
  }
  return result;
}

function generatePillar3aScheduleCandidates(
  accountIds: string[],
  bounds: { min: number; max: number },
  currentSchedule: Record<string, number>,
  bvgTrancheCount: number,
): Record<string, number>[] {
  if (accountIds.length === 0) return [{}];

  const candidates: Record<string, number>[] = [
    Object.fromEntries(
      accountIds.map((id) => [id, currentSchedule[id] ?? bounds.max]),
    ),
  ];

  const spread = spreadUniqueWithdrawalOffsets(
    accountIds.length,
    bounds.min,
    bounds.max,
  );
  candidates.push(
    Object.fromEntries(accountIds.map((id, index) => [id, spread[index] ?? bounds.max])),
  );

  candidates.push(
    Object.fromEntries(accountIds.map((id) => [id, bounds.max])),
  );
  candidates.push(
    Object.fromEntries(accountIds.map((id) => [id, bounds.min])),
  );

  const bvgBusyOffsets = new Set(
    Array.from({ length: Math.max(0, bvgTrancheCount) }, (_, index) => index),
  );
  const freeOffsets: number[] = [];
  for (let offset = bounds.min; offset <= bounds.max; offset++) {
    if (!bvgBusyOffsets.has(offset)) freeOffsets.push(offset);
  }

  if (freeOffsets.length >= accountIds.length) {
    const staggered = spreadUniqueWithdrawalOffsets(
      accountIds.length,
      freeOffsets[0],
      freeOffsets[freeOffsets.length - 1],
    );
    candidates.push(
      Object.fromEntries(
        accountIds.map((id, index) => [
          id,
          staggered[index] ?? freeOffsets[index] ?? bounds.max,
        ]),
      ),
    );
  }

  return uniqueSchedules(candidates);
}

function percentCandidates(currentPercent: number): number[] {
  const base = Array.from({ length: 11 }, (_, index) => index * 10);
  const guidance = Math.round(BVG_GUIDANCE_MAX_CAPITAL_WITHDRAWAL * 100);
  const extras = [currentPercent, guidance].filter(
    (value) => value >= 0 && value <= 100,
  );
  return [...new Set([...base, ...extras])].sort((a, b) => a - b);
}

function buildExplanation(params: {
  baseline: CapitalWithdrawalOptimizationSuggestion;
  suggested: CapitalWithdrawalOptimizationSuggestion;
  profile: ProfileForScenario;
  taxSavings: number;
  baselineMonthlyBvg: number;
  suggestedMonthlyBvg: number;
  accountNames: Record<string, string>;
}): { summaryText: string; explanation: string[] } {
  const bullets: string[] = [];

  if (
    params.suggested.bvgCapitalWithdrawalPercent !==
    params.baseline.bvgCapitalWithdrawalPercent
  ) {
    const direction =
      params.suggested.bvgCapitalWithdrawalPercent <
      params.baseline.bvgCapitalWithdrawalPercent
        ? "reduzieren"
        : "erhöhen";
    bullets.push(
      `BVG Kapitalbezug von ${params.baseline.bvgCapitalWithdrawalPercent}% auf ${params.suggested.bvgCapitalWithdrawalPercent}% ${direction} und den Rest verrenten.`,
    );
  }

  if (
    params.suggested.bvgCapitalWithdrawalTranches !==
    params.baseline.bvgCapitalWithdrawalTranches
  ) {
    bullets.push(
      `BVG-Auszahlung über ${params.suggested.bvgCapitalWithdrawalTranches} statt ${params.baseline.bvgCapitalWithdrawalTranches} Tranche(n) verteilen, um die Progression zu entlasten.`,
    );
  }

  const scheduleChanged = Object.keys({
    ...params.baseline.pillar3aWithdrawalSchedule,
    ...params.suggested.pillar3aWithdrawalSchedule,
  }).some(
    (id) =>
      params.baseline.pillar3aWithdrawalSchedule[id] !==
      params.suggested.pillar3aWithdrawalSchedule[id],
  );

  if (scheduleChanged) {
    const scheduleLines = Object.entries(params.suggested.pillar3aWithdrawalSchedule)
      .map(([id, offset]) => {
        const name = params.accountNames[id] ?? "3a-Konto";
        const sign = offset > 0 ? "+" : "";
        return `${name}: ${sign}${offset} J. zum BVG-Start`;
      })
      .join(" · ");
    bullets.push(`Säule-3a-Bezüge staffeln (${scheduleLines}).`);
  }

  const monthlyDelta = params.suggestedMonthlyBvg - params.baselineMonthlyBvg;
  if (Math.abs(monthlyDelta) >= 1) {
    bullets.push(
      monthlyDelta > 0
        ? `Die BVG-Rente steigt um ca. ${formatChf(monthlyDelta)}/Monat.`
        : `Die BVG-Rente sinkt um ca. ${formatChf(Math.abs(monthlyDelta))}/Monat — dafür weniger Einmalsteuer.`,
    );
  }

  if (bullets.length === 0) {
    bullets.push(
      "Feinjustierung der Bezugszeitpunkte reduziert die Steuerlast bei ähnlicher Kapital-/Rentenstruktur.",
    );
  }

  const summaryText = `Durch eine andere Aufteilung zwischen Kapitalbezug und Rente sowie gestaffelte 3a-Bezüge können Sie voraussichtlich ${formatChf(params.taxSavings)} Steuern auf Kapitalleistungen und Renten sparen.`;

  return { summaryText, explanation: bullets };
}

export function optimizeCapitalWithdrawal(
  profile: ProfileForScenario,
  overrides: ScenarioOverrides,
): CapitalWithdrawalOptimizationResult {
  const baselineResult = calculateScenarioPension(profile, overrides);
  const baselineTax = totalTaxFromResult(baselineResult);

  const accountIds =
    profile.pillar3aAccounts?.map((account) => account.id) ??
    baselineResult.pillar3a.accounts.map((account) => account.id);

  const accountNames = Object.fromEntries(
    (profile.pillar3aAccounts ?? baselineResult.pillar3a.accounts).map(
      (account) => [account.id, account.name],
    ),
  );

  const { employmentEndAge, ahvPensionStartAge, bvgPensionStartAge } =
    buildScenarioPensionInput(profile, overrides);

  const earliestWithdrawalAge = getPillar3aEffectiveEarliestWithdrawalAge(
    profile.birthDate,
    profile.gender,
    employmentEndAge,
  );
  const latestWithdrawalAge = getPillar3aLatestWithdrawalAge(ahvPensionStartAge);
  const offsetBounds = pillar3aWithdrawalOffsetBounds(
    bvgPensionStartAge,
    earliestWithdrawalAge,
    latestWithdrawalAge,
  );

  const currentPercent = overrides.bvg?.capitalWithdrawalPercent ?? 0;
  const currentTranches = overrides.bvg?.capitalWithdrawalTranches ?? 1;
  const currentSchedule = { ...overrides.pillar3a?.withdrawalSchedule };

  const baselineSuggestion: CapitalWithdrawalOptimizationSuggestion = {
    bvgCapitalWithdrawalPercent: currentPercent,
    bvgCapitalWithdrawalTranches: currentTranches,
    pillar3aWithdrawalSchedule: Object.fromEntries(
      accountIds.map((id) => [id, currentSchedule[id] ?? offsetBounds.max]),
    ),
  };

  if (baselineTax <= 0 && currentPercent === 0 && accountIds.length === 0) {
    return {
      hasImprovement: false,
      baselineTotalTax: 0,
      suggestedTotalTax: 0,
      taxSavings: 0,
      baselineMonthlyBvg: baselineResult.bvg.monthlyPension,
      suggestedMonthlyBvg: baselineResult.bvg.monthlyPension,
      suggestion: baselineSuggestion,
      summaryText:
        "In diesem Szenario fallen keine relevanten Steuern auf Kapitalbezüge oder Renten an — eine Optimierung ist nicht nötig.",
      explanation: [],
    };
  }

  let bestTax = baselineTax;
  let bestSuggestion = baselineSuggestion;
  let bestMonthlyBvg = baselineResult.bvg.monthlyPension;

  for (const percent of percentCandidates(currentPercent)) {
    for (
      let tranches = 1;
      tranches <= BVG_MAX_CAPITAL_WITHDRAWAL_TRANCHES;
      tranches++
    ) {
      const scheduleCandidates = generatePillar3aScheduleCandidates(
        accountIds,
        offsetBounds,
        baselineSuggestion.pillar3aWithdrawalSchedule,
        percent > 0 ? tranches : 0,
      );

      for (const schedule of scheduleCandidates) {
        const candidateOverrides = mergeScenarioOverrides(overrides, {
          bvgCapitalWithdrawalPercent: percent,
          bvgCapitalWithdrawalTranches: tranches,
          pillar3aWithdrawalSchedule: schedule,
        });
        const candidateResult = calculateScenarioPension(
          profile,
          candidateOverrides,
        );
        const candidateTax = totalTaxFromResult(candidateResult);

        if (candidateTax < bestTax) {
          bestTax = candidateTax;
          bestMonthlyBvg = candidateResult.bvg.monthlyPension;
          bestSuggestion = {
            bvgCapitalWithdrawalPercent: percent,
            bvgCapitalWithdrawalTranches: tranches,
            pillar3aWithdrawalSchedule: { ...schedule },
          };
        }
      }
    }
  }

  const taxSavings = Math.max(0, baselineTax - bestTax);
  const hasImprovement = taxSavings >= 100;

  if (!hasImprovement) {
    return {
      hasImprovement: false,
      baselineTotalTax: baselineTax,
      suggestedTotalTax: baselineTax,
      taxSavings: 0,
      baselineMonthlyBvg: baselineResult.bvg.monthlyPension,
      suggestedMonthlyBvg: baselineResult.bvg.monthlyPension,
      suggestion: baselineSuggestion,
      summaryText:
        baselineTax > 0
          ? "Ihre aktuelle Aufteilung zwischen Kapitalbezug, Rente und 3a-Bezügen ist steuerlich bereits nahe am Optimum."
          : "Keine wesentliche Steuerersparnis durch Umverteilung der Bezüge erkennbar.",
      explanation: [],
    };
  }

  const { summaryText, explanation } = buildExplanation({
    baseline: baselineSuggestion,
    suggested: bestSuggestion,
    profile,
    taxSavings,
    baselineMonthlyBvg: baselineResult.bvg.monthlyPension,
    suggestedMonthlyBvg: bestMonthlyBvg,
    accountNames,
  });

  return {
    hasImprovement: true,
    baselineTotalTax: baselineTax,
    suggestedTotalTax: bestTax,
    taxSavings,
    baselineMonthlyBvg: baselineResult.bvg.monthlyPension,
    suggestedMonthlyBvg: bestMonthlyBvg,
    suggestion: bestSuggestion,
    summaryText,
    explanation,
  };
}

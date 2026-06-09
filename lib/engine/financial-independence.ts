/**
 * Finanzielle Unabhängigkeit (FI)
 * Frühestes Alter, ab dem Erwerbsaufgabe tragbar ist: Vermögen bleibt bis
 * Planungshorizont nicht negativ (Einnahmen inkl. Renten decken Ausgaben + Steuern).
 */

import type { FreeAssetsYearProjection } from "./modules/free-assets";
import {
  calculateScenarioPension,
  type ProfileForScenario,
  type ScenarioPensionResult,
} from "./orchestrator";
import {
  calculateHouseholdPension,
  combinedProjectionToFreeAssets,
  type HouseholdPensionResult,
} from "./household-orchestrator";
import type { HouseholdProfileForScenario } from "@/lib/household/types";
import type { CombinedWealthYearProjection } from "@/lib/household/types";

function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const ref = new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export type FinancialIndependenceTimeline = {
  projection: FreeAssetsYearProjection[];
  employmentEndAge: number;
  ahvPensionStartAge: number;
  bvgPensionStartAge: number;
  sustainable: boolean;
  /** Haushalt / Paar */
  householdMode?: boolean;
  partnerEmploymentEndAge?: number;
  partnerAhvPensionStartAge?: number;
  partnerBvgPensionStartAge?: number;
  /** Personenaufschlüsselung für Haushalts-Tooltips */
  combinedDetail?: CombinedWealthYearProjection[];
};

export type FinancialIndependenceResult =
  | {
      ok: true;
      independenceAge: number;
      yearsUntil: number;
      currentAge: number;
      profileRetirementAge: number;
      planningHorizonAge: number;
      yearsEarlierThanPlanned: number | null;
      endCapitalAtHorizon: number;
      minCapitalDuringRetirement: number;
      monthlyIncomeAtHorizon: number;
      summaryText: string;
      explanation: string[];
      timeline: FinancialIndependenceTimeline;
    }
  | {
      ok: false;
      reason: string;
      missingFields?: string[];
      timeline?: FinancialIndependenceTimeline;
      currentAge?: number;
      profileRetirementAge?: number;
      planningHorizonAge?: number;
    };

const MAX_SEARCH_AGE = 70;

function validateProfile(profile: ProfileForScenario): string[] {
  const missing: string[] = [];
  if (!profile.birthDate) missing.push("Geburtsdatum");
  if (!profile.currentSalaryBrutto || profile.currentSalaryBrutto <= 0) {
    missing.push("Bruttojahreslohn");
  }
  if (
    profile.annualRetirementExpenses == null ||
    profile.annualRetirementExpenses <= 0
  ) {
    missing.push("Jährliche Ausgaben ab Pensionierung");
  }
  return missing;
}

function runFiScenario(
  profile: ProfileForScenario,
  employmentEndAge: number,
): ScenarioPensionResult {
  return calculateScenarioPension(profile, {
    ahv: {
      employmentEndAgeOverride: employmentEndAge,
      retirementAgeOverride: employmentEndAge,
    },
  });
}

function buildTimeline(
  result: ScenarioPensionResult,
  sustainable: boolean,
): FinancialIndependenceTimeline | null {
  const projection = result.freeAssets?.projection;
  if (!projection?.length) return null;
  return {
    projection,
    employmentEndAge: result.summary.employmentEndAge,
    ahvPensionStartAge: result.summary.ahvPensionStartAge,
    bvgPensionStartAge: result.summary.bvgPensionStartAge,
    sustainable,
  };
}

function evaluateRetirement(
  employmentEndAge: number,
  planningHorizonAge: number,
  profile: ProfileForScenario,
): {
  sustainable: boolean;
  endCapital: number;
  minCapital: number;
  monthlyIncomeAtHorizon: number;
  scenario: ScenarioPensionResult;
} {
  const scenario = runFiScenario(profile, employmentEndAge);
  const projection = scenario.freeAssets?.projection ?? [];
  if (projection.length === 0) {
    return {
      sustainable: false,
      endCapital: 0,
      minCapital: 0,
      monthlyIncomeAtHorizon: scenario.summary.monthlyTotalAtHorizon,
      scenario,
    };
  }

  const retirementYears = projection.filter(
    (year) =>
      year.age >= employmentEndAge && year.age <= planningHorizonAge,
  );

  if (retirementYears.length === 0) {
    return {
      sustainable: false,
      endCapital: 0,
      minCapital: 0,
      monthlyIncomeAtHorizon: scenario.summary.monthlyTotalAtHorizon,
      scenario,
    };
  }

  const minCapital = Math.min(...retirementYears.map((y) => y.capitalEnd));
  const horizonYear =
    retirementYears.find((y) => y.age === planningHorizonAge) ??
    retirementYears[retirementYears.length - 1];
  // Vermögen muss während der ganzen Ruhestandsphase positiv bleiben (nicht nur ≥ 0)
  const sustainable = retirementYears.every((year) => year.capitalEnd > 0);

  return {
    sustainable,
    endCapital: horizonYear.capitalEnd,
    minCapital,
    monthlyIncomeAtHorizon: scenario.summary.monthlyTotalAtHorizon,
    scenario,
  };
}

function formatChf(amount: number): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateFinancialIndependence(
  profile: ProfileForScenario,
): FinancialIndependenceResult {
  const missing = validateProfile(profile);
  if (missing.length > 0) {
    return {
      ok: false,
      reason:
        "Für die Berechnung fehlen noch Angaben in den Stammdaten.",
      missingFields: missing,
    };
  }

  const currentAge = calculateAge(profile.birthDate);
  const planningHorizonAge = profile.planningHorizonAge ?? 90;
  const profileRetirementAge = profile.retirementAge ?? 65;

  if (planningHorizonAge <= currentAge) {
    return {
      ok: false,
      reason: `Der Planungshorizont (${planningHorizonAge} J.) liegt nicht über dem aktuellen Alter (${currentAge} J.).`,
    };
  }

  const searchFrom = Math.max(currentAge, 18);
  const searchTo = Math.min(MAX_SEARCH_AGE, planningHorizonAge - 1);

  if (searchFrom > searchTo) {
    return {
      ok: false,
      reason: "Kein sinnvoller Suchbereich für das Erwerbsende.",
    };
  }

  let bestAge: number | null = null;
  let bestMetrics = {
    endCapital: 0,
    minCapital: 0,
    monthlyIncomeAtHorizon: 0,
    scenario: runFiScenario(profile, profileRetirementAge),
  };

  for (let age = searchFrom; age <= searchTo; age++) {
    const metrics = evaluateRetirement(age, planningHorizonAge, profile);
    if (metrics.sustainable) {
      bestAge = age;
      bestMetrics = metrics;
      break;
    }
  }

  if (bestAge == null) {
    const illustration = evaluateRetirement(
      profileRetirementAge,
      planningHorizonAge,
      profile,
    );
    const illustrationTimeline = buildTimeline(
      illustration.scenario,
      illustration.sustainable,
    );

    return {
      ok: false,
      reason: `Mit den aktuellen Annahmen ist bis Alter ${searchTo} keine dauerhaft tragfähige Erwerbsaufgabe möglich — das freie Vermögen würde vor Alter ${planningHorizonAge} aufgebraucht.`,
      timeline: illustrationTimeline ?? undefined,
      currentAge,
      profileRetirementAge,
      planningHorizonAge,
    };
  }

  const yearsUntil = Math.max(0, bestAge - currentAge);
  const yearsEarlierThanPlanned =
    bestAge < profileRetirementAge ? profileRetirementAge - bestAge : null;

  const explanation: string[] = [
    `Erwerbsaufgabe ab Alter ${bestAge}: Ausgaben (CHF ${formatChf(profile.annualRetirementExpenses ?? 0)}/J.) inkl. Steuern werden durch Renten (AHV/BVG) und freies Vermögen gedeckt.`,
    `Projektion bis Alter ${planningHorizonAge}: tiefster Vermögensstand CHF ${formatChf(bestMetrics.minCapital)}, Endvermögen CHF ${formatChf(bestMetrics.endCapital)}.`,
    `Monatliches Gesamteinkommen am Planungshorizont: ca. ${formatChf(bestMetrics.monthlyIncomeAtHorizon)}/Mt. (AHV, BVG, ggf. Entnahmen).`,
    "Annahmen: 100 % BVG-Verrentung (kein Kapitalbezug), Standard-3a-Bezugsplan, Profilwerte für Renditen und Steuern. Das freie Vermögen darf bis zum Planungshorizont nicht aufgebraucht sein.",
  ];

  if (profile.workloadReductions?.length) {
    explanation.push(
      `Arbeitspensum-Reduktionen berücksichtigt: ${profile.workloadReductions.map((r) => `ab ${r.fromAge} J. ${r.workloadPercent} %`).join(" · ")}. Sparquote sinkt um die volle Brutto-Einbusse.`,
    );
  }

  if (yearsEarlierThanPlanned != null && yearsEarlierThanPlanned > 0) {
    explanation.unshift(
      `${yearsEarlierThanPlanned} Jahr${yearsEarlierThanPlanned === 1 ? "" : "e"} früher als Ihr geplantes Pensionierungsalter (${profileRetirementAge} J.).`,
    );
  }

  const summaryText =
    yearsUntil === 0
      ? `Auf Basis Ihrer Stammdaten wäre finanzielle Unabhängigkeit ab sofort (Alter ${bestAge}) möglich — Ihr Vermögen bliebe bis Alter ${planningHorizonAge} durchgehend positiv.`
      : yearsUntil === 1
        ? `Finanzielle Unabhängigkeit ab Alter ${bestAge} — in etwa 1 Jahr.`
        : `Finanzielle Unabhängigkeit ab Alter ${bestAge} — in etwa ${yearsUntil} Jahren.`;

  const timeline = buildTimeline(bestMetrics.scenario, true);

  if (!timeline) {
    return {
      ok: false,
      reason: "Keine Vermögensprojektion für die FI-Berechnung verfügbar.",
    };
  }

  return {
    ok: true,
    independenceAge: bestAge,
    yearsUntil,
    currentAge,
    profileRetirementAge,
    planningHorizonAge,
    yearsEarlierThanPlanned,
    endCapitalAtHorizon: bestMetrics.endCapital,
    minCapitalDuringRetirement: bestMetrics.minCapital,
    monthlyIncomeAtHorizon: bestMetrics.monthlyIncomeAtHorizon,
    summaryText,
    explanation,
    timeline,
  };
}

function validateHousehold(
  household: HouseholdProfileForScenario,
): string[] {
  const missing = validateProfile(household.primary);
  if (household.planningMode === "couple" && !household.partner?.birthDate) {
    missing.push("Partner: Geburtsdatum");
  }
  return missing;
}

function buildHouseholdTimeline(
  householdResult: HouseholdPensionResult,
  sustainable: boolean,
): FinancialIndependenceTimeline | null {
  const projection = combinedProjectionToFreeAssets(
    householdResult.combinedProjection,
  );
  if (!projection.length) return null;

  const isCouple =
    householdResult.planningMode === "couple" && householdResult.partner != null;

  return {
    projection,
    employmentEndAge: householdResult.primary.summary.employmentEndAge,
    ahvPensionStartAge: householdResult.primary.summary.ahvPensionStartAge,
    bvgPensionStartAge: householdResult.primary.summary.bvgPensionStartAge,
    sustainable,
    householdMode: isCouple,
    partnerEmploymentEndAge: householdResult.partner?.summary.employmentEndAge,
    partnerAhvPensionStartAge:
      householdResult.partner?.summary.ahvPensionStartAge,
    partnerBvgPensionStartAge:
      householdResult.partner?.summary.bvgPensionStartAge,
    combinedDetail: isCouple ? householdResult.combinedProjection : undefined,
  };
}

function evaluateHouseholdRetirement(
  household: HouseholdProfileForScenario,
  primaryEmploymentEndAge: number,
  planningHorizonAge: number,
): {
  sustainable: boolean;
  endCapital: number;
  minCapital: number;
  monthlyIncomeAtHorizon: number;
  householdResult: HouseholdPensionResult;
} {
  const householdResult = calculateHouseholdPension(household, {
    ahv: {
      employmentEndAgeOverride: primaryEmploymentEndAge,
      retirementAgeOverride: primaryEmploymentEndAge,
    },
  });

  const projection = householdResult.combinedProjection;
  if (projection.length === 0) {
    const monthly =
      householdResult.primary.summary.monthlyTotalAtHorizon +
      (householdResult.partner?.summary.monthlyTotalAtHorizon ?? 0);
    return {
      sustainable: false,
      endCapital: 0,
      minCapital: 0,
      monthlyIncomeAtHorizon: monthly,
      householdResult,
    };
  }

  const retirementYears = projection.filter(
    (row) =>
      row.primaryAge >= primaryEmploymentEndAge &&
      row.primaryAge <= planningHorizonAge,
  );

  if (retirementYears.length === 0) {
    const monthly =
      householdResult.primary.summary.monthlyTotalAtHorizon +
      (householdResult.partner?.summary.monthlyTotalAtHorizon ?? 0);
    return {
      sustainable: false,
      endCapital: 0,
      minCapital: 0,
      monthlyIncomeAtHorizon: monthly,
      householdResult,
    };
  }

  const minCapital = Math.min(...retirementYears.map((row) => row.capitalEnd));
  const horizonRow =
    retirementYears.find((row) => row.primaryAge === planningHorizonAge) ??
    retirementYears[retirementYears.length - 1];
  const sustainable = retirementYears.every((row) => row.capitalEnd > 0);
  const monthlyIncomeAtHorizon =
    householdResult.primary.summary.monthlyTotalAtHorizon +
    (householdResult.partner?.summary.monthlyTotalAtHorizon ?? 0);

  return {
    sustainable,
    endCapital: horizonRow.capitalEnd,
    minCapital,
    monthlyIncomeAtHorizon,
    householdResult,
  };
}

export function calculateHouseholdFinancialIndependence(
  household: HouseholdProfileForScenario,
): FinancialIndependenceResult {
  const missing = validateHousehold(household);
  if (missing.length > 0) {
    return {
      ok: false,
      reason: "Für die Berechnung fehlen noch Angaben in den Stammdaten.",
      missingFields: missing,
    };
  }

  const currentAge = calculateAge(household.primary.birthDate);
  const planningHorizonAge = household.primary.planningHorizonAge ?? 90;
  const profileRetirementAge = household.primary.retirementAge ?? 65;

  if (planningHorizonAge <= currentAge) {
    return {
      ok: false,
      reason: `Der Planungshorizont (${planningHorizonAge} J.) liegt nicht über dem aktuellen Alter (${currentAge} J.).`,
    };
  }

  const searchFrom = Math.max(currentAge, 18);
  const searchTo = Math.min(MAX_SEARCH_AGE, planningHorizonAge - 1);

  if (searchFrom > searchTo) {
    return {
      ok: false,
      reason: "Kein sinnvoller Suchbereich für das Erwerbsende.",
    };
  }

  let bestAge: number | null = null;
  let bestMetrics = evaluateHouseholdRetirement(
    household,
    profileRetirementAge,
    planningHorizonAge,
  );

  for (let age = searchFrom; age <= searchTo; age++) {
    const metrics = evaluateHouseholdRetirement(
      household,
      age,
      planningHorizonAge,
    );
    if (metrics.sustainable) {
      bestAge = age;
      bestMetrics = metrics;
      break;
    }
  }

  if (bestAge == null) {
    const illustration = evaluateHouseholdRetirement(
      household,
      profileRetirementAge,
      planningHorizonAge,
    );
    const illustrationTimeline = buildHouseholdTimeline(
      illustration.householdResult,
      illustration.sustainable,
    );

    return {
      ok: false,
      reason: `Mit den aktuellen Annahmen ist bis Alter ${searchTo} keine dauerhaft tragfähige Erwerbsaufgabe für den Haushalt möglich.`,
      timeline: illustrationTimeline ?? undefined,
      currentAge,
      profileRetirementAge,
      planningHorizonAge,
    };
  }

  const yearsUntil = Math.max(0, bestAge - currentAge);
  const yearsEarlierThanPlanned =
    bestAge < profileRetirementAge ? profileRetirementAge - bestAge : null;

  const explanation: string[] = [
    `Erwerbsaufgabe Person 1 ab Alter ${bestAge}: Haushaltsausgaben (CHF ${formatChf(household.primary.annualRetirementExpenses ?? 0)}/J.) werden durch kombinierte Renten und Vermögen gedeckt.`,
    `Projektion bis Alter ${planningHorizonAge}: tiefster Haushaltsvermögensstand CHF ${formatChf(bestMetrics.minCapital)}, Endvermögen CHF ${formatChf(bestMetrics.endCapital)}.`,
    `Monatliches Haushaltseinkommen am Planungshorizont: ca. ${formatChf(bestMetrics.monthlyIncomeAtHorizon)}/Mt.`,
    "Annahmen: separate AHV/BVG/3a pro Person, Haushaltsausgaben ab späterer Pensionierung, 100 % BVG-Verrentung.",
  ];

  if (bestMetrics.householdResult.ahvCouplePlafonierungApplied) {
    explanation.push(
      `AHV-Plafonierung (Ehepaar): Summe der individuellen Renten auf max. CHF ${formatChf(bestMetrics.householdResult.ahvCoupleCapYearly ?? 0)}/J. (150 % Maximalrente) gekürzt.`,
    );
  }

  if (yearsEarlierThanPlanned != null && yearsEarlierThanPlanned > 0) {
    explanation.unshift(
      `${yearsEarlierThanPlanned} Jahr${yearsEarlierThanPlanned === 1 ? "" : "e"} früher als das geplante Pensionierungsalter von Person 1 (${profileRetirementAge} J.).`,
    );
  }

  const summaryText =
    yearsUntil === 0
      ? `Finanzielle Unabhängigkeit für den Haushalt ab sofort (Alter ${bestAge}) möglich.`
      : yearsUntil === 1
        ? `Finanzielle Unabhängigkeit für den Haushalt ab Alter ${bestAge} — in etwa 1 Jahr.`
        : `Finanzielle Unabhängigkeit für den Haushalt ab Alter ${bestAge} — in etwa ${yearsUntil} Jahren.`;

  const timeline = buildHouseholdTimeline(
    bestMetrics.householdResult,
    true,
  );

  if (!timeline) {
    return {
      ok: false,
      reason: "Keine Haushalts-Vermögensprojektion für die FI-Berechnung verfügbar.",
    };
  }

  return {
    ok: true,
    independenceAge: bestAge,
    yearsUntil,
    currentAge,
    profileRetirementAge,
    planningHorizonAge,
    yearsEarlierThanPlanned,
    endCapitalAtHorizon: bestMetrics.endCapital,
    minCapitalDuringRetirement: bestMetrics.minCapital,
    monthlyIncomeAtHorizon: bestMetrics.monthlyIncomeAtHorizon,
    summaryText,
    explanation,
    timeline,
  };
}

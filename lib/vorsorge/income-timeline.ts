import {
  calculateAge,
  NET_SALARY_ESTIMATE_FACTOR,
  type HouseholdPensionResult,
  type ProfileForScenario,
  type ScenarioPensionResult,
} from "@/lib/engine";
import type { CombinedWealthYearProjection } from "@/lib/household/types";
import { workloadFactorAtAge } from "@/lib/engine/workload";

export type PersonIncomeBreakdown = {
  ahv: number;
  bvg: number;
  salary: number;
  total: number;
};

export type HouseholdIncomeBreakdown = {
  primary: PersonIncomeBreakdown;
  partner: PersonIncomeBreakdown | null;
  wealthInterest: number;
  wealthWithdrawal: number;
  total: number;
};

export type VorsorgeIncomeYear = {
  year: number;
  primaryAge: number;
  partnerAge: number | null;
  primary: PersonIncomeBreakdown;
  partner: PersonIncomeBreakdown | null;
  wealthInterest: number;
  wealthWithdrawal: number;
  household: PersonIncomeBreakdown & {
    wealthInterest: number;
    wealthWithdrawal: number;
    total: number;
  };
};

const NO_INCOME: PersonIncomeBreakdown = {
  ahv: 0,
  bvg: 0,
  salary: 0,
  total: 0,
};

function ageAtCalendarYear(birthDate: string, year: number): number {
  return calculateAge(birthDate, `${year}-01-01`);
}

/**
 * Geschätzter Netto-Jahreslohn: Bruttolohn × 78 % × Arbeitspensum.
 * Entspricht NET_SALARY_ESTIMATE_FACTOR in der Engine (ohne Lohn-Teuerung).
 */
export function estimatedNetSalaryIncome(
  profile: ProfileForScenario,
  age: number,
  employmentEndAge: number,
): number {
  if (age >= employmentEndAge || profile.currentSalaryBrutto <= 0) return 0;
  const workload = workloadFactorAtAge(profile.workloadReductions ?? [], age);
  return Math.round(
    profile.currentSalaryBrutto * workload * NET_SALARY_ESTIMATE_FACTOR,
  );
}

function pensionIncomeAtAge(
  result: ScenarioPensionResult,
  age: number,
  deceasedAtAge?: number,
): Pick<PersonIncomeBreakdown, "ahv" | "bvg"> {
  if (deceasedAtAge != null && age >= deceasedAtAge) {
    return { ahv: 0, bvg: 0 };
  }
  return {
    ahv: age >= result.ahv.pensionStartAge ? result.ahv.yearlyPension : 0,
    bvg: age >= result.bvg.pensionStartAge ? result.bvg.yearlyPension : 0,
  };
}

function freeAssetsWealthAtAge(
  result: ScenarioPensionResult,
  age: number,
): { interest: number; withdrawal: number } {
  const projection = result.freeAssets?.projection;
  if (!projection) return { interest: 0, withdrawal: 0 };
  const row = projection.find((p) => p.age === age);
  if (!row || age < result.summary.employmentEndAge) {
    return { interest: 0, withdrawal: 0 };
  }
  return {
    interest: row.interest,
    withdrawal: row.annualWithdrawal,
  };
}

function wealthIncomeFromRow(
  row: CombinedWealthYearProjection | undefined,
  fallbackPrimary: ScenarioPensionResult,
  primaryAge: number,
  usePooledWealth: boolean,
): { interest: number; withdrawal: number } {
  if (usePooledWealth && row) {
    return {
      interest: row.interest ?? 0,
      withdrawal: row.annualWithdrawal ?? 0,
    };
  }
  return freeAssetsWealthAtAge(fallbackPrimary, primaryAge);
}

function buildPersonIncome(
  result: ScenarioPensionResult,
  profile: ProfileForScenario | undefined,
  age: number,
  employmentEndAge: number,
  deceasedAtAge?: number,
): PersonIncomeBreakdown {
  const pension = pensionIncomeAtAge(result, age, deceasedAtAge);
  const salary =
    profile != null
      ? estimatedNetSalaryIncome(profile, age, employmentEndAge)
      : 0;
  return {
    ...pension,
    salary,
    total: pension.ahv + pension.bvg + salary,
  };
}

function buildHouseholdRow(
  primary: PersonIncomeBreakdown,
  partner: PersonIncomeBreakdown | null,
  wealthInterest: number,
  wealthWithdrawal: number,
): VorsorgeIncomeYear["household"] {
  return {
    ahv: primary.ahv + (partner?.ahv ?? 0),
    bvg: primary.bvg + (partner?.bvg ?? 0),
    salary: primary.salary + (partner?.salary ?? 0),
    wealthInterest,
    wealthWithdrawal,
    total:
      primary.total +
      (partner?.total ?? 0) +
      wealthInterest +
      wealthWithdrawal,
  };
}

export type BuildVorsorgeIncomeTimelineInput = {
  primary: ScenarioPensionResult;
  primaryBirthDate: string;
  planningHorizonAge: number;
  partner?: ScenarioPensionResult | null;
  partnerBirthDate?: string | null;
  partnerPlanningHorizonAge?: number;
  combinedProjection?: CombinedWealthYearProjection[];
  primaryProfile?: ProfileForScenario;
  partnerProfile?: ProfileForScenario | null;
};

export function buildVorsorgeIncomeTimeline(
  input: BuildVorsorgeIncomeTimelineInput,
): VorsorgeIncomeYear[] {
  const {
    primary,
    primaryBirthDate,
    planningHorizonAge,
    partner = null,
    partnerBirthDate = null,
    partnerPlanningHorizonAge,
    combinedProjection,
    primaryProfile,
    partnerProfile = null,
  } = input;

  const currentYear = new Date().getFullYear();
  const currentPrimaryAge = calculateAge(primaryBirthDate);
  const primaryEndYear =
    currentYear + Math.max(0, planningHorizonAge - currentPrimaryAge);

  const hasPartner = Boolean(partner && partnerBirthDate);
  const usePooledWealth = Boolean(hasPartner && combinedProjection?.length);
  const partnerHorizon = hasPartner
    ? (partnerPlanningHorizonAge ?? planningHorizonAge)
    : undefined;
  const primaryDeceasedAtAge = hasPartner ? planningHorizonAge : undefined;

  let endYear = primaryEndYear;
  if (hasPartner && partnerBirthDate) {
    const currentPartnerAge = calculateAge(partnerBirthDate);
    endYear = Math.max(
      endYear,
      currentYear +
        Math.max(0, (partnerHorizon ?? planningHorizonAge) - currentPartnerAge),
    );
  }

  const combinedByYear = new Map(
    (combinedProjection ?? []).map((row) => [row.year, row]),
  );

  const rows: VorsorgeIncomeYear[] = [];
  for (let year = currentYear; year <= endYear; year++) {
    const primaryAge = ageAtCalendarYear(primaryBirthDate, year);
    const partnerAge =
      partner && partnerBirthDate
        ? ageAtCalendarYear(partnerBirthDate, year)
        : null;

    const primaryIncome = buildPersonIncome(
      primary,
      primaryProfile,
      primaryAge,
      primary.summary.employmentEndAge,
      primaryDeceasedAtAge,
    );
    const partnerIncome =
      partner && partnerAge != null
        ? buildPersonIncome(
            partner,
            partnerProfile ?? undefined,
            partnerAge,
            partner.summary.employmentEndAge,
            partnerHorizon,
          )
        : null;

    const wealth = wealthIncomeFromRow(
      combinedByYear.get(year),
      primary,
      primaryAge,
      usePooledWealth,
    );

    rows.push({
      year,
      primaryAge,
      partnerAge,
      primary: primaryIncome,
      partner: partnerIncome,
      wealthInterest: wealth.interest,
      wealthWithdrawal: wealth.withdrawal,
      household: buildHouseholdRow(
        primaryIncome,
        partnerIncome,
        wealth.interest,
        wealth.withdrawal,
      ),
    });
  }

  const firstWithIncome = rows.findIndex(
    (row) =>
      row.primary.total > 0 ||
      (row.partner?.total ?? 0) > 0 ||
      row.wealthInterest > 0 ||
      row.wealthWithdrawal > 0 ||
      row.household.total > 0,
  );
  if (firstWithIncome < 0) return [];
  return rows.slice(firstWithIncome);
}

/**
 * Erstes Kalenderjahr, in dem beide Personen die Erwerbstätigkeit beendet haben.
 * Engine-Regel: Lohn endet ab Alter = Erwerbsende; daher erst ab Alter > Erwerbsende.
 */
export function findFirstFullHouseholdRetirementYear(
  result: HouseholdPensionResult,
): CombinedWealthYearProjection | null {
  if (!result.partner) return null;
  const primaryEnd = result.primary.summary.employmentEndAge;
  const partnerEnd = result.partner.summary.employmentEndAge;

  return (
    result.combinedProjection.find(
      (row) =>
        row.partnerAge != null &&
        row.primaryAge > primaryEnd &&
        row.partnerAge > partnerEnd,
    ) ?? null
  );
}

export function getVorsorgeIncomeYearAtCalendarYear(
  input: BuildVorsorgeIncomeTimelineInput,
  year: number,
): VorsorgeIncomeYear | null {
  return buildVorsorgeIncomeTimeline(input).find((row) => row.year === year) ?? null;
}

export { NO_INCOME as VORSORGE_NO_INCOME };

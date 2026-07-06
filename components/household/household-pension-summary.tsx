"use client";

import { useMemo } from "react";

import { formatCHF, type HouseholdPensionResult } from "@/lib/engine";
import type { ProfileForScenario } from "@/lib/engine";
import {
  findFirstFullHouseholdRetirementYear,
  getVorsorgeIncomeYearAtCalendarYear,
} from "@/lib/vorsorge/income-timeline";

const AHV_COLOR = "hsl(var(--chart-5))";
const BVG_COLOR = "hsl(var(--chart-2))";
const SALARY_COLOR = "hsl(142 55% 38%)";
const WEALTH_COLOR = "hsl(142 55% 38%)";

function monthly(value: number): number {
  return Math.round(value / 12);
}

function BreakdownLine({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  if (value <= 0) return null;
  return (
    <p className="text-xs text-muted-foreground" style={color ? { color } : undefined}>
      {label}: {formatCHF(monthly(value))}/Mt.
    </p>
  );
}

export function HouseholdPensionSummary({
  result,
  primaryBirthDate,
  partnerBirthDate,
  planningHorizonAge,
  partnerPlanningHorizonAge,
  primaryProfile,
  partnerProfile,
  primaryLabel = "Person 1",
  partnerLabel = "Person 2",
}: {
  result: HouseholdPensionResult;
  primaryBirthDate: string;
  partnerBirthDate: string;
  planningHorizonAge: number;
  partnerPlanningHorizonAge?: number;
  primaryProfile?: ProfileForScenario;
  partnerProfile?: ProfileForScenario | null;
  primaryLabel?: string;
  partnerLabel?: string;
}) {
  const fullRetirementRow = useMemo(
    () => findFirstFullHouseholdRetirementYear(result),
    [result],
  );

  const incomeSnapshot = useMemo(() => {
    if (!fullRetirementRow) return null;
    return getVorsorgeIncomeYearAtCalendarYear(
      {
        primary: result.primary,
        primaryBirthDate,
        planningHorizonAge,
        partner: result.partner,
        partnerBirthDate,
        partnerPlanningHorizonAge,
        combinedProjection: result.combinedProjection,
        primaryProfile,
        partnerProfile,
      },
      fullRetirementRow.year,
    );
  }, [
    fullRetirementRow,
    result,
    primaryBirthDate,
    partnerBirthDate,
    planningHorizonAge,
    partnerPlanningHorizonAge,
    primaryProfile,
    partnerProfile,
  ]);

  if (!fullRetirementRow || !incomeSnapshot) {
    return (
      <p className="text-xs text-muted-foreground">
        Kein gemeinsames Pensionierungsjahr in der Projektion gefunden.
      </p>
    );
  }

  const primaryMonthly = monthly(incomeSnapshot.primary.total);
  const partnerMonthly = monthly(incomeSnapshot.partner?.total ?? 0);
  const householdMonthly = monthly(incomeSnapshot.household.total);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Monatliches Einkommen im ersten vollständigen Pensionierungsjahr — beide
        haben die Erwerbstätigkeit beendet ({fullRetirementRow.year}: {primaryLabel}{" "}
        {fullRetirementRow.primaryAge} J., {partnerLabel} {fullRetirementRow.partnerAge}{" "}
        J.). Lohn: Brutto × 78 % × Pensum.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">{primaryLabel} / Mt.</p>
          <p className="text-xl font-semibold tabular-nums">{formatCHF(primaryMonthly)}</p>
          <div className="mt-2 space-y-0.5">
            <BreakdownLine label="AHV" value={incomeSnapshot.primary.ahv} color={AHV_COLOR} />
            <BreakdownLine label="BVG" value={incomeSnapshot.primary.bvg} color={BVG_COLOR} />
            <BreakdownLine label="Lohn" value={incomeSnapshot.primary.salary} color={SALARY_COLOR} />
          </div>
        </div>
        {result.partner ? (
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">{partnerLabel} / Mt.</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatCHF(partnerMonthly)}
            </p>
            <div className="mt-2 space-y-0.5">
              <BreakdownLine
                label="AHV"
                value={incomeSnapshot.partner?.ahv ?? 0}
                color={AHV_COLOR}
              />
              <BreakdownLine
                label="BVG"
                value={incomeSnapshot.partner?.bvg ?? 0}
                color={BVG_COLOR}
              />
              <BreakdownLine
                label="Lohn"
                value={incomeSnapshot.partner?.salary ?? 0}
                color={SALARY_COLOR}
              />
            </div>
          </div>
        ) : null}
        <div className="rounded-lg border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Haushalt gesamt / Mt.</p>
          <p className="text-xl font-semibold tabular-nums text-primary">
            {formatCHF(householdMonthly)}
          </p>
          <div className="mt-2 space-y-0.5">
            <BreakdownLine
              label="Vorsorge gesamt"
              value={incomeSnapshot.household.ahv + incomeSnapshot.household.bvg}
            />
            <BreakdownLine
              label="Lohn gesamt"
              value={incomeSnapshot.household.salary}
              color={SALARY_COLOR}
            />
            <BreakdownLine
              label="Zinseinnahmen gemeinsames Vermögen"
              value={incomeSnapshot.wealthInterest}
              color={WEALTH_COLOR}
            />
            <BreakdownLine
              label="Kapitalentnahme"
              value={incomeSnapshot.wealthWithdrawal}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function householdPensionSummaryTitle(
  result: HouseholdPensionResult,
): string {
  const row = findFirstFullHouseholdRetirementYear(result);
  if (!row) return "Rentenvorschau";
  return `Rentenvorschau zur vollständigen Pensionierung im Jahr ${row.year}`;
}

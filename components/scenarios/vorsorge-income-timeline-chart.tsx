"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  ChartLegend,
  useChartSeriesVisibility,
} from "@/components/charts/chart-legend";
import {
  calculateAge,
  formatCHF,
  type ScenarioPensionResult,
} from "@/lib/engine";
import type { CombinedWealthYearProjection } from "@/lib/household/types";
import {
  PERSON1_COLOR,
  PERSON2_COLOR,
  personLabel,
} from "@/lib/household/person-colors";

const WIDTH = 640;
const HEIGHT = 280;
const PAD = { top: 28, right: 16, bottom: 40, left: 64 };

const AHV_COLOR = "hsl(var(--chart-5))";
const BVG_COLOR = "hsl(var(--chart-2))";
const FREE_ASSETS_COLOR = "hsl(var(--chart-4))";
const HOUSEHOLD_TOTAL_COLOR = "hsl(var(--chart-3))";

export type PersonIncomeBreakdown = {
  ahv: number;
  bvg: number;
  freeAssets: number;
  total: number;
};

export type VorsorgeIncomeYear = {
  year: number;
  primaryAge: number;
  partnerAge: number | null;
  primary: PersonIncomeBreakdown;
  partner: PersonIncomeBreakdown | null;
  household: PersonIncomeBreakdown;
};

function ageAtCalendarYear(birthDate: string, year: number): number {
  return calculateAge(birthDate, `${year}-01-01`);
}

function freeAssetsIncomeAtAge(
  result: ScenarioPensionResult,
  age: number,
): number {
  const projection = result.freeAssets?.projection;
  if (!projection) return 0;
  const row = projection.find((p) => p.age === age);
  if (!row || age < result.summary.employmentEndAge) return 0;
  return row.interest + row.annualWithdrawal;
}

function personIncomeAtAge(
  result: ScenarioPensionResult,
  age: number,
): PersonIncomeBreakdown {
  const ahv =
    age >= result.ahv.pensionStartAge ? result.ahv.yearlyPension : 0;
  const bvg =
    age >= result.bvg.pensionStartAge ? result.bvg.yearlyPension : 0;
  const freeAssets = freeAssetsIncomeAtAge(result, age);
  return { ahv, bvg, freeAssets, total: ahv + bvg + freeAssets };
}

function householdIncomeFromCombined(
  row: CombinedWealthYearProjection,
  householdRetirementAge: number,
): PersonIncomeBreakdown {
  if (row.primaryAge < householdRetirementAge) {
    return { ahv: 0, bvg: 0, freeAssets: 0, total: 0 };
  }
  const vorsorge = row.annualPensionIncome;
  const freeAssets = row.interest + row.annualWithdrawal;
  return {
    ahv: vorsorge,
    bvg: 0,
    freeAssets,
    total: vorsorge + freeAssets,
  };
}

export function buildVorsorgeIncomeTimeline(
  primary: ScenarioPensionResult,
  primaryBirthDate: string,
  planningHorizonAge: number,
  partner?: ScenarioPensionResult | null,
  partnerBirthDate?: string | null,
  partnerPlanningHorizonAge?: number,
  combinedProjection?: CombinedWealthYearProjection[],
  householdRetirementAge?: number,
): VorsorgeIncomeYear[] {
  const currentYear = new Date().getFullYear();
  const currentPrimaryAge = calculateAge(primaryBirthDate);
  const primaryEndYear =
    currentYear + Math.max(0, planningHorizonAge - currentPrimaryAge);

  let endYear = primaryEndYear;
  if (partner && partnerBirthDate) {
    const partnerHorizon = partnerPlanningHorizonAge ?? planningHorizonAge;
    const currentPartnerAge = calculateAge(partnerBirthDate);
    endYear = Math.max(
      endYear,
      currentYear + Math.max(0, partnerHorizon - currentPartnerAge),
    );
  }

  const householdRetirement =
    householdRetirementAge ?? primary.summary.employmentEndAge;

  const rows: VorsorgeIncomeYear[] = [];
  for (let year = currentYear; year <= endYear; year++) {
    const primaryAge = ageAtCalendarYear(primaryBirthDate, year);
    const partnerAge =
      partner && partnerBirthDate
        ? ageAtCalendarYear(partnerBirthDate, year)
        : null;
    const primaryIncome = personIncomeAtAge(primary, primaryAge);
    const partnerIncome =
      partner && partnerAge != null
        ? personIncomeAtAge(partner, partnerAge)
        : null;

    const combinedRow = combinedProjection?.find((r) => r.year === year);
    const household =
      combinedRow && partner
        ? householdIncomeFromCombined(combinedRow, householdRetirement)
        : {
            ahv: primaryIncome.ahv + (partnerIncome?.ahv ?? 0),
            bvg: primaryIncome.bvg + (partnerIncome?.bvg ?? 0),
            freeAssets:
              primaryIncome.freeAssets + (partnerIncome?.freeAssets ?? 0),
            total:
              primaryIncome.total + (partnerIncome?.total ?? 0),
          };

    rows.push({
      year,
      primaryAge,
      partnerAge,
      primary: primaryIncome,
      partner: partnerIncome,
      household,
    });
  }

  const firstWithIncome = rows.findIndex(
    (row) =>
      row.primary.total > 0 ||
      (row.partner?.total ?? 0) > 0 ||
      row.household.total > 0,
  );
  if (firstWithIncome < 0) return [];
  return rows.slice(firstWithIncome);
}

function formatAxisValue(tick: number): string {
  if (tick >= 1_000_000) return `${Math.round(tick / 100_000) / 10}M`;
  if (tick >= 1000) return `${Math.round(tick / 1000)}k`;
  return String(tick);
}

function TooltipRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt
        className="flex items-center gap-1.5"
        style={color ? { color } : undefined}
      >
        {color ? (
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        ) : null}
        {label}
      </dt>
      <dd className="font-mono tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function PersonIncomeTooltip({
  role,
  age,
  income,
}: {
  role: "primary" | "partner";
  age: number;
  income: PersonIncomeBreakdown;
}) {
  const color = role === "primary" ? PERSON1_COLOR : PERSON2_COLOR;
  const label = personLabel(role);

  return (
    <div className="space-y-1">
      <p className="font-medium" style={{ color }}>
        {label} · Alter {age}
      </p>
      <dl className="space-y-0.5 text-muted-foreground">
        {income.ahv > 0 ? (
          <TooltipRow
            label="AHV"
            value={formatCHF(income.ahv)}
            color={AHV_COLOR}
          />
        ) : null}
        {income.bvg > 0 ? (
          <TooltipRow
            label="BVG"
            value={formatCHF(income.bvg)}
            color={BVG_COLOR}
          />
        ) : null}
        {income.freeAssets > 0 ? (
          <TooltipRow
            label="Freies Vermögen"
            value={formatCHF(income.freeAssets)}
            color={FREE_ASSETS_COLOR}
          />
        ) : null}
        <TooltipRow
          label="Total"
          value={income.total > 0 ? formatCHF(income.total) : "—"}
          color={color}
        />
      </dl>
    </div>
  );
}

type Props = {
  primary: ScenarioPensionResult;
  primaryBirthDate: string;
  planningHorizonAge?: number;
  partner?: ScenarioPensionResult | null;
  partnerBirthDate?: string | null;
  partnerPlanningHorizonAge?: number;
  combinedProjection?: CombinedWealthYearProjection[];
  householdRetirementAge?: number;
};

export function VorsorgeIncomeTimelineChart({
  primary,
  primaryBirthDate,
  planningHorizonAge = 95,
  partner = null,
  partnerBirthDate = null,
  partnerPlanningHorizonAge,
  combinedProjection,
  householdRetirementAge,
}: Props) {
  const hasPartner = partner != null && partnerBirthDate != null;

  const timeline = useMemo(
    () =>
      buildVorsorgeIncomeTimeline(
        primary,
        primaryBirthDate,
        planningHorizonAge,
        partner,
        partnerBirthDate,
        partnerPlanningHorizonAge,
        combinedProjection,
        householdRetirementAge,
      ),
    [
      primary,
      primaryBirthDate,
      planningHorizonAge,
      partner,
      partnerBirthDate,
      partnerPlanningHorizonAge,
      combinedProjection,
      householdRetirementAge,
    ],
  );

  if (timeline.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Kein Einkommen aus Vorsorge oder freiem Vermögen in der Projektion —
        Bezugs- bzw. Pensionierungsalter liegen ausserhalb des Planungshorizonts.
      </p>
    );
  }

  return (
    <VorsorgeIncomeTimelineChartInner
      timeline={timeline}
      primary={primary}
      partner={partner}
      hasPartner={hasPartner}
      showHouseholdTotalLine={hasPartner}
    />
  );
}

function VorsorgeIncomeTimelineChartInner({
  timeline,
  primary,
  partner,
  hasPartner,
  showHouseholdTotalLine,
}: {
  timeline: VorsorgeIncomeYear[];
  primary: ScenarioPensionResult;
  partner: ScenarioPensionResult | null;
  hasPartner: boolean;
  showHouseholdTotalLine: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { hidden, toggle, isVisible } = useChartSeriesVisibility();

  const minAge = timeline[0].primaryAge;
  const maxAge = timeline[timeline.length - 1].primaryAge;
  const maxY = Math.max(
    ...timeline.map((row) =>
      Math.max(
        row.primary.total,
        row.partner?.total ?? 0,
        row.household.total,
      ),
    ),
    1,
  );

  const xScale = (age: number) =>
    PAD.left +
    ((age - minAge) / Math.max(maxAge - minAge, 1)) *
      (WIDTH - PAD.left - PAD.right);
  const yScale = (value: number) =>
    PAD.top + (1 - value / maxY) * (HEIGHT - PAD.top - PAD.bottom);

  const pathFor = (value: (row: VorsorgeIncomeYear) => number) =>
    timeline
      .map(
        (row, i) =>
          `${i === 0 ? "M" : "L"} ${xScale(row.primaryAge)} ${yScale(value(row))}`,
      )
      .join(" ");

  const primaryPath = pathFor((row) => row.primary.total);
  const partnerPath = hasPartner ? pathFor((row) => row.partner?.total ?? 0) : "";
  const householdPath = showHouseholdTotalLine
    ? pathFor((row) => row.household.total)
    : "";

  const lastRow = timeline[timeline.length - 1];

  const handleMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
      const age =
        minAge +
        ((x - PAD.left) / (WIDTH - PAD.left - PAD.right)) * (maxAge - minAge);
      let best = 0;
      let bestDist = Infinity;
      timeline.forEach((row, index) => {
        const dist = Math.abs(row.primaryAge - age);
        if (dist < bestDist) {
          bestDist = dist;
          best = index;
        }
      });
      setHoverIndex(best);
    },
    [maxAge, minAge, timeline],
  );

  const hover = hoverIndex != null ? timeline[hoverIndex] : null;

  const yTicks = [0, maxY * 0.25, maxY * 0.5, maxY * 0.75, maxY];
  const xTicks: number[] = [];
  const step = Math.max(2, Math.round((maxAge - minAge) / 6 / 2) * 2);
  for (let age = minAge; age <= maxAge; age += step) xTicks.push(age);
  if (xTicks[xTicks.length - 1] !== maxAge) xTicks.push(maxAge);

  const milestoneAges = new Map<number, string>();
  const addMilestone = (age: number) => {
    if (age >= minAge && age <= maxAge && !milestoneAges.has(age)) {
      milestoneAges.set(age, "");
    }
  };
  addMilestone(primary.ahv.pensionStartAge);
  addMilestone(primary.bvg.pensionStartAge);
  addMilestone(primary.summary.employmentEndAge);
  if (partner) {
    const ahvP2Row = timeline.find(
      (r) => r.partnerAge === partner.ahv.pensionStartAge,
    );
    const bvgP2Row = timeline.find(
      (r) => r.partnerAge === partner.bvg.pensionStartAge,
    );
    if (ahvP2Row) addMilestone(ahvP2Row.primaryAge);
    if (bvgP2Row) addMilestone(bvgP2Row.primaryAge);
    addMilestone(
      timeline.find((r) => r.partnerAge === partner.summary.employmentEndAge)
        ?.primaryAge ?? partner.summary.employmentEndAge,
    );
  }

  return (
    <div className="space-y-3">
      <ChartLegend
        hidden={hidden}
        toggle={toggle}
        items={[
          {
            id: "primary",
            label: `${personLabel("primary")}: ${formatCHF(lastRow?.primary.total ?? 0)}/J.`,
            color: PERSON1_COLOR,
          },
          ...(hasPartner
            ? [
                {
                  id: "partner",
                  label: `${personLabel("partner")}: ${formatCHF(lastRow?.partner?.total ?? 0)}/J.`,
                  color: PERSON2_COLOR,
                },
              ]
            : []),
          ...(showHouseholdTotalLine
            ? [
                {
                  id: "household",
                  label: `Haushalt gesamt: ${formatCHF(lastRow?.household.total ?? 0)}/J.`,
                  color: HOUSEHOLD_TOTAL_COLOR,
                },
              ]
            : []),
        ]}
      />

      <div className="relative w-full overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full min-w-[320px]"
          role="img"
          aria-label="Einkommen aus Vorsorge und freiem Vermögen über die Zeit"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke="currentColor"
                strokeOpacity={0.08}
              />
              <text
                x={PAD.left - 8}
                y={yScale(tick) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {formatAxisValue(tick)}
              </text>
            </g>
          ))}

          {xTicks.map((age) => (
            <text
              key={age}
              x={xScale(age)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {age}
            </text>
          ))}

          <text
            x={WIDTH / 2}
            y={HEIGHT - 22}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            Alter Person 1
          </text>

          {[...milestoneAges.keys()].map((age) => (
            <line
              key={age}
              x1={xScale(age)}
              x2={xScale(age)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="currentColor"
              strokeDasharray="3 3"
              strokeOpacity={0.2}
            />
          ))}

          {hasPartner && isVisible("partner") ? (
            <path
              d={partnerPath}
              fill="none"
              stroke={PERSON2_COLOR}
              strokeWidth={2}
              strokeOpacity={0.85}
            />
          ) : null}

          {isVisible("primary") ? (
            <path
              d={primaryPath}
              fill="none"
              stroke={PERSON1_COLOR}
              strokeWidth={2.5}
            />
          ) : null}

          {showHouseholdTotalLine && householdPath && isVisible("household") ? (
            <path
              d={householdPath}
              fill="none"
              stroke={HOUSEHOLD_TOTAL_COLOR}
              strokeWidth={2}
              strokeOpacity={0.9}
            />
          ) : null}

          {hover ? (
            <>
              {isVisible("primary") && hover.primary.total > 0 ? (
                <circle
                  cx={xScale(hover.primaryAge)}
                  cy={yScale(hover.primary.total)}
                  r={4}
                  fill={PERSON1_COLOR}
                />
              ) : null}
              {hasPartner &&
              isVisible("partner") &&
              (hover.partner?.total ?? 0) > 0 ? (
                <circle
                  cx={xScale(hover.primaryAge)}
                  cy={yScale(hover.partner?.total ?? 0)}
                  r={4}
                  fill={PERSON2_COLOR}
                />
              ) : null}
              {showHouseholdTotalLine &&
              isVisible("household") &&
              hover.household.total > 0 ? (
                <circle
                  cx={xScale(hover.primaryAge)}
                  cy={yScale(hover.household.total)}
                  r={4}
                  fill={HOUSEHOLD_TOTAL_COLOR}
                />
              ) : null}
            </>
          ) : null}

          {hover ? (
            <line
              x1={xScale(hover.primaryAge)}
              x2={xScale(hover.primaryAge)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="currentColor"
              strokeOpacity={0.25}
            />
          ) : null}
        </svg>
      </div>

      {hover ? (
        <div className="rounded-md border bg-background/80 px-3 py-2 text-xs">
          <p className="font-medium text-foreground">
            {hover.year} · Alter Person 1: {hover.primaryAge}
            {hover.partnerAge != null ? (
              <> · Person 2: {hover.partnerAge}</>
            ) : null}
          </p>
          <div
            className={`mt-2 grid gap-3 ${hasPartner ? "sm:grid-cols-2" : ""}`}
          >
            <PersonIncomeTooltip
              role="primary"
              age={hover.primaryAge}
              income={hover.primary}
            />
            {hasPartner && hover.partner ? (
              <PersonIncomeTooltip
                role="partner"
                age={hover.partnerAge ?? 0}
                income={hover.partner}
              />
            ) : null}
          </div>
          {hasPartner ? (
            <div className="mt-2 border-t border-border/60 pt-2">
              <p
                className="mb-1 text-[10px] font-medium uppercase tracking-wide"
                style={{ color: HOUSEHOLD_TOTAL_COLOR }}
              >
                Haushalt gesamt
              </p>
              <dl className="space-y-0.5 text-muted-foreground">
                {hover.household.ahv > 0 ? (
                  <TooltipRow
                    label="AHV/BVG"
                    value={formatCHF(hover.household.ahv + hover.household.bvg)}
                  />
                ) : null}
                {hover.household.freeAssets > 0 ? (
                  <TooltipRow
                    label="Freies Vermögen"
                    value={formatCHF(hover.household.freeAssets)}
                    color={FREE_ASSETS_COLOR}
                  />
                ) : null}
                <TooltipRow
                  label="Total"
                  value={formatCHF(hover.household.total)}
                  color={HOUSEHOLD_TOTAL_COLOR}
                />
              </dl>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Jährliches Einkommen (AHV, BVG, freies Vermögen) · Person 1:{" "}
          {formatCHF(lastRow?.primary.total ?? 0)}/J. ·{" "}
          {hasPartner ? (
            <>Person 2: {formatCHF(lastRow?.partner?.total ?? 0)}/J. · </>
          ) : null}
          Total: {formatCHF(lastRow?.household.total ?? 0)}/J. · Details per Hover
        </p>
      )}
    </div>
  );
}

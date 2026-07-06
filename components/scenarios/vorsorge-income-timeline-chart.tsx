"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  ChartLegend,
  useChartSeriesVisibility,
} from "@/components/charts/chart-legend";
import {
  formatCHF,
  type HouseholdPensionResult,
  type ProfileForScenario,
  type ScenarioPensionResult,
} from "@/lib/engine";
import {
  buildVorsorgeIncomeTimeline,
  type PersonIncomeBreakdown,
  type VorsorgeIncomeYear,
} from "@/lib/vorsorge/income-timeline";

export {
  buildVorsorgeIncomeTimeline,
  type PersonIncomeBreakdown,
  type VorsorgeIncomeYear,
} from "@/lib/vorsorge/income-timeline";

const WIDTH = 640;
const HEIGHT = 280;
const PAD = { top: 28, right: 16, bottom: 40, left: 64 };

const VORSORGE_P1_LINE = "hsl(210 75% 42%)";
const VORSORGE_P2_LINE = "hsl(280 55% 50%)";
const VORSORGE_HOUSEHOLD_LINE = "hsl(32 92% 48%)";
const WEALTH_INTEREST_LINE = "hsl(142 55% 38%)";

const AHV_COLOR = "hsl(var(--chart-5))";
const BVG_COLOR = "hsl(var(--chart-2))";
const SALARY_COLOR = "hsl(142 55% 38%)";

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
  label,
  age,
  income,
}: {
  role: "primary" | "partner";
  label: string;
  age: number;
  income: PersonIncomeBreakdown;
}) {
  const color = role === "primary" ? VORSORGE_P1_LINE : VORSORGE_P2_LINE;

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
        {income.salary > 0 ? (
          <TooltipRow
            label="Lohn (Brutto × 78 % × Pensum)"
            value={formatCHF(income.salary)}
            color={SALARY_COLOR}
          />
        ) : null}
        <TooltipRow
          label="Subtotal"
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
  primaryLabel?: string;
  partnerLabel?: string;
  householdResult?: HouseholdPensionResult | null;
  primaryProfile?: ProfileForScenario;
  partnerProfile?: ProfileForScenario | null;
};

export function VorsorgeIncomeTimelineChart({
  primary,
  primaryBirthDate,
  planningHorizonAge = 95,
  partner = null,
  partnerBirthDate = null,
  partnerPlanningHorizonAge,
  primaryLabel = "Person 1",
  partnerLabel = "Person 2",
  householdResult = null,
  primaryProfile,
  partnerProfile = null,
}: Props) {
  const hasPartner = partner != null && partnerBirthDate != null;

  const timeline = useMemo(
    () =>
      buildVorsorgeIncomeTimeline({
        primary,
        primaryBirthDate,
        planningHorizonAge,
        partner,
        partnerBirthDate,
        partnerPlanningHorizonAge,
        combinedProjection: householdResult?.combinedProjection,
        primaryProfile: primaryProfile ?? undefined,
        partnerProfile: partnerProfile ?? undefined,
      }),
    [
      primary,
      primaryBirthDate,
      planningHorizonAge,
      partner,
      partnerBirthDate,
      partnerPlanningHorizonAge,
      householdResult?.combinedProjection,
      primaryProfile,
      partnerProfile,
    ],
  );

  if (timeline.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Kein Einkommen aus Vorsorge, Lohn oder gemeinsamem Vermögen in der
        Projektion — Bezugs- bzw. Pensionierungsalter liegen ausserhalb des
        Planungshorizonts.
      </p>
    );
  }

  return (
    <VorsorgeIncomeTimelineChartInner
      timeline={timeline}
      primary={primary}
      partner={partner}
      hasPartner={hasPartner}
      primaryLabel={primaryLabel}
      partnerLabel={partnerLabel}
    />
  );
}

function VorsorgeIncomeTimelineChartInner({
  timeline,
  primary,
  partner,
  hasPartner,
  primaryLabel,
  partnerLabel,
}: {
  timeline: VorsorgeIncomeYear[];
  primary: ScenarioPensionResult;
  partner: ScenarioPensionResult | null;
  hasPartner: boolean;
  primaryLabel: string;
  partnerLabel: string;
}) {
  const showHouseholdTotalLine = true;
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
        row.wealthInterest,
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
  const wealthInterestPath = pathFor((row) => row.wealthInterest);
  const householdPath = showHouseholdTotalLine
    ? pathFor((row) => row.household.total)
    : "";

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

  const wealthInterestLabel = hasPartner
    ? "Zinseinnahmen gemeinsames Vermögen"
    : "Zinseinnahmen freies Vermögen";

  const lineLegendItems = [
    {
      id: "primary",
      label: `${primaryLabel} (AHV + BVG + Lohn)`,
      color: VORSORGE_P1_LINE,
    },
    ...(hasPartner
      ? [
          {
            id: "partner",
            label: `${partnerLabel} (AHV + BVG + Lohn)`,
            color: VORSORGE_P2_LINE,
          },
        ]
      : []),
    {
      id: "wealthInterest",
      label: wealthInterestLabel,
      color: WEALTH_INTEREST_LINE,
    },
    {
      id: "household",
      label: "Haushalt total",
      color: VORSORGE_HOUSEHOLD_LINE,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Jährliches Einkommen in CHF. Personenlinien: AHV, BVG und Lohn (Brutto ×
        78 % × Pensum) während der Erwerbsphase. Grün: Zinsen auf dem{" "}
        {hasPartner ? "gemeinsamen" : "freien"} Vermögen. Orange: Haushalt total
        inkl. Kapitalentnahmen. Details per Mauszeiger.
      </p>

      <ChartLegend hidden={hidden} toggle={toggle} items={lineLegendItems} />

      <div className="relative w-full overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full min-w-[320px]"
          role="img"
          aria-label="Einkommen aus Vorsorge, Lohn und Vermögen über die Zeit"
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
            Alter {primaryLabel}
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
              stroke={VORSORGE_P2_LINE}
              strokeWidth={2}
              strokeOpacity={0.85}
            />
          ) : null}

          {isVisible("primary") ? (
            <path
              d={primaryPath}
              fill="none"
              stroke={VORSORGE_P1_LINE}
              strokeWidth={2.5}
            />
          ) : null}

          {isVisible("wealthInterest") ? (
            <path
              d={wealthInterestPath}
              fill="none"
              stroke={WEALTH_INTEREST_LINE}
              strokeWidth={2}
              strokeOpacity={0.9}
            />
          ) : null}

          {showHouseholdTotalLine && householdPath && isVisible("household") ? (
            <path
              d={householdPath}
              fill="none"
              stroke={VORSORGE_HOUSEHOLD_LINE}
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
                  fill={VORSORGE_P1_LINE}
                />
              ) : null}
              {hasPartner &&
              isVisible("partner") &&
              (hover.partner?.total ?? 0) > 0 ? (
                <circle
                  cx={xScale(hover.primaryAge)}
                  cy={yScale(hover.partner?.total ?? 0)}
                  r={4}
                  fill={VORSORGE_P2_LINE}
                />
              ) : null}
              {isVisible("wealthInterest") && hover.wealthInterest > 0 ? (
                <circle
                  cx={xScale(hover.primaryAge)}
                  cy={yScale(hover.wealthInterest)}
                  r={4}
                  fill={WEALTH_INTEREST_LINE}
                />
              ) : null}
              {showHouseholdTotalLine &&
              isVisible("household") &&
              hover.household.total > 0 ? (
                <circle
                  cx={xScale(hover.primaryAge)}
                  cy={yScale(hover.household.total)}
                  r={4}
                  fill={VORSORGE_HOUSEHOLD_LINE}
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
            {hover.year} · Alter {primaryLabel}: {hover.primaryAge}
            {hover.partnerAge != null ? (
              <> · {partnerLabel}: {hover.partnerAge}</>
            ) : null}
          </p>
          <div
            className={`mt-2 grid gap-3 ${hasPartner ? "sm:grid-cols-2" : ""}`}
          >
            <PersonIncomeTooltip
              role="primary"
              label={primaryLabel}
              age={hover.primaryAge}
              income={hover.primary}
            />
            {hasPartner && hover.partner ? (
              <PersonIncomeTooltip
                role="partner"
                label={partnerLabel}
                age={hover.partnerAge ?? 0}
                income={hover.partner}
              />
            ) : null}
          </div>
          <div className="mt-2 border-t border-border/60 pt-2">
            <p
              className="mb-1 text-[10px] font-medium uppercase tracking-wide"
              style={{ color: VORSORGE_HOUSEHOLD_LINE }}
            >
              Haushalt
            </p>
            <dl className="space-y-0.5 text-muted-foreground">
              {hover.household.ahv > 0 ? (
                <TooltipRow
                  label="AHV gesamt"
                  value={formatCHF(hover.household.ahv)}
                  color={AHV_COLOR}
                />
              ) : null}
              {hover.household.bvg > 0 ? (
                <TooltipRow
                  label="BVG gesamt"
                  value={formatCHF(hover.household.bvg)}
                  color={BVG_COLOR}
                />
              ) : null}
              {hover.household.salary > 0 ? (
                <TooltipRow
                  label="Lohn gesamt"
                  value={formatCHF(hover.household.salary)}
                  color={SALARY_COLOR}
                />
              ) : null}
              {hover.wealthInterest > 0 ? (
                <TooltipRow
                  label={wealthInterestLabel}
                  value={formatCHF(hover.wealthInterest)}
                  color={WEALTH_INTEREST_LINE}
                />
              ) : null}
              {hover.wealthWithdrawal > 0 ? (
                <TooltipRow
                  label="Kapitalentnahme"
                  value={formatCHF(hover.wealthWithdrawal)}
                />
              ) : null}
              <TooltipRow
                label="Total"
                value={formatCHF(hover.household.total)}
                color={VORSORGE_HOUSEHOLD_LINE}
              />
            </dl>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Bewegen Sie die Maus über die Grafik für die Aufschlüsselung nach AHV,
          BVG, Lohn und Vermögen.
        </p>
      )}
    </div>
  );
}

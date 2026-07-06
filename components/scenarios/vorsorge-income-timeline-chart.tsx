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

const WIDTH = 640;
const HEIGHT = 280;
const PAD = { top: 28, right: 16, bottom: 40, left: 64 };

/** Gut unterscheidbare Linienfarben (nicht Primary/Schwarz). */
const VORSORGE_P1_LINE = "hsl(210 75% 42%)";
const VORSORGE_P2_LINE = "hsl(280 55% 50%)";
const VORSORGE_HOUSEHOLD_LINE = "hsl(32 92% 48%)";

const AHV_COLOR = "hsl(var(--chart-5))";
const BVG_COLOR = "hsl(var(--chart-2))";
const FREE_ASSETS_COLOR = "hsl(190 65% 42%)";

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

const NO_INCOME: PersonIncomeBreakdown = {
  ahv: 0,
  bvg: 0,
  freeAssets: 0,
  total: 0,
};

function personIncomeAtAge(
  result: ScenarioPensionResult,
  age: number,
  deceasedAtAge?: number,
): PersonIncomeBreakdown {
  // Ab dem Tod (Planungshorizont) kein Einkommen mehr – konsistent zur Engine,
  // die die Jahreszeile einer Person ab `age >= horizonAge` nullt.
  if (deceasedAtAge != null && age >= deceasedAtAge) return NO_INCOME;

  const ahv =
    age >= result.ahv.pensionStartAge ? result.ahv.yearlyPension : 0;
  const bvg =
    age >= result.bvg.pensionStartAge ? result.bvg.yearlyPension : 0;
  const freeAssets = freeAssetsIncomeAtAge(result, age);
  return {
    ahv,
    bvg,
    freeAssets,
    total: ahv + bvg + freeAssets,
  };
}

function sumHouseholdIncome(
  primary: PersonIncomeBreakdown,
  partner: PersonIncomeBreakdown | null,
): PersonIncomeBreakdown {
  return {
    ahv: primary.ahv + (partner?.ahv ?? 0),
    bvg: primary.bvg + (partner?.bvg ?? 0),
    freeAssets: primary.freeAssets + (partner?.freeAssets ?? 0),
    total: primary.total + (partner?.total ?? 0),
  };
}

export function buildVorsorgeIncomeTimeline(
  primary: ScenarioPensionResult,
  primaryBirthDate: string,
  planningHorizonAge: number,
  partner?: ScenarioPensionResult | null,
  partnerBirthDate?: string | null,
  partnerPlanningHorizonAge?: number,
): VorsorgeIncomeYear[] {
  const currentYear = new Date().getFullYear();
  const currentPrimaryAge = calculateAge(primaryBirthDate);
  const primaryEndYear =
    currentYear + Math.max(0, planningHorizonAge - currentPrimaryAge);

  const hasPartner = Boolean(partner && partnerBirthDate);
  // Nach dem Planungshorizont gilt eine Person als verstorben (analog Engine:
  // `resolvePersonProjection` nullt ab `age >= horizonAge`). Im Einzelmodus
  // endet die Projektion am Horizont ohne Todesfall – daher dort kein Cap.
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

  const rows: VorsorgeIncomeYear[] = [];
  for (let year = currentYear; year <= endYear; year++) {
    const primaryAge = ageAtCalendarYear(primaryBirthDate, year);
    const partnerAge =
      partner && partnerBirthDate
        ? ageAtCalendarYear(partnerBirthDate, year)
        : null;
    const primaryIncome = personIncomeAtAge(
      primary,
      primaryAge,
      primaryDeceasedAtAge,
    );
    const partnerIncome =
      partner && partnerAge != null
        ? personIncomeAtAge(partner, partnerAge, partnerHorizon)
        : null;
    const household = sumHouseholdIncome(primaryIncome, partnerIncome);

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
  primaryLabel?: string;
  partnerLabel?: string;
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
      ),
    [
      primary,
      primaryBirthDate,
      planningHorizonAge,
      partner,
      partnerBirthDate,
      partnerPlanningHorizonAge,
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
  showHouseholdTotalLine,
  primaryLabel,
  partnerLabel,
}: {
  timeline: VorsorgeIncomeYear[];
  primary: ScenarioPensionResult;
  partner: ScenarioPensionResult | null;
  hasPartner: boolean;
  showHouseholdTotalLine: boolean;
  primaryLabel: string;
  partnerLabel: string;
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
            label: `${primaryLabel}: ${formatCHF(lastRow?.primary.total ?? 0)}/J.`,
            color: VORSORGE_P1_LINE,
          },
          ...(hasPartner
            ? [
                {
                  id: "partner",
                  label: `${partnerLabel}: ${formatCHF(lastRow?.partner?.total ?? 0)}/J.`,
                  color: VORSORGE_P2_LINE,
                },
              ]
            : []),
          ...(showHouseholdTotalLine
            ? [
                {
                  id: "household",
                  label: `Haushalt gesamt: ${formatCHF(lastRow?.household.total ?? 0)}/J.`,
                  color: VORSORGE_HOUSEHOLD_LINE,
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
          {hasPartner ? (
            <div className="mt-2 border-t border-border/60 pt-2">
              <p
                className="mb-1 text-[10px] font-medium uppercase tracking-wide"
                style={{ color: VORSORGE_HOUSEHOLD_LINE }}
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
                  color={VORSORGE_HOUSEHOLD_LINE}
                />
              </dl>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Jährliches Einkommen (AHV, BVG, freies Vermögen) · {primaryLabel}:{" "}
          {formatCHF(lastRow?.primary.total ?? 0)}/J. ·{" "}
          {hasPartner ? (
            <>{partnerLabel}: {formatCHF(lastRow?.partner?.total ?? 0)}/J. · </>
          ) : null}
          Total: {formatCHF(lastRow?.household.total ?? 0)}/J. · Details per Hover
        </p>
      )}
    </div>
  );
}

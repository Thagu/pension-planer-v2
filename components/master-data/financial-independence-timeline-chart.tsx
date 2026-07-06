"use client";

import { useCallback, useRef, useState } from "react";

import {
  ChartLegend,
  useChartSeriesVisibility,
} from "@/components/charts/chart-legend";
import {
  ChartFloatingTooltip,
  RIGHT_AXIS_STROKE_DASH,
  WEALTH_LINE_COLOR,
} from "@/components/charts/chart-tooltip";
import {
  cashflowFromCombinedRow,
  cashflowFromFreeAssetsRow,
  HouseholdCashflowBreakdown,
} from "@/components/charts/household-cashflow-tooltip";
import type { CombinedWealthYearProjection } from "@/lib/household/types";
import { PERSON1_COLOR, PERSON2_COLOR } from "@/lib/household/person-colors";
import { resolveStableAxisMax } from "@/lib/charts/stable-domain";
import {
  hasCapitalInjectionMarker,
  injectionMarkerXOffsets,
} from "@/lib/charts/injection-markers";
import { formatCHF, type FinancialIndependenceTimeline } from "@/lib/engine";
import type { FreeAssetsYearProjection } from "@/lib/engine";

const WIDTH = 640;
const HEIGHT = 280;
const PAD = { top: 36, right: 52, bottom: 48, left: 64 };

const BVG_INJECTION_COLOR = "hsl(var(--chart-2))";
const PILLAR3A_INJECTION_COLOR = "hsl(var(--chart-4))";
const INHERITANCE_INJECTION_COLOR = "hsl(217 70% 55%)";
const PENSION_LINE_COLOR = "hsl(var(--chart-5))";
const EXPENSE_LINE_COLOR = "hsl(var(--chart-1))";
const WITHDRAWAL_LINE_COLOR = "hsl(var(--chart-3))";

function formatAxisValue(tick: number): string {
  const sign = tick < 0 ? "-" : "";
  const abs = Math.abs(tick);
  if (abs >= 1_000_000) return `${sign}${Math.round(abs / 100_000) / 10}M`;
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}k`;
  return String(tick);
}

function findDepletionAge(
  projection: FreeAssetsYearProjection[],
  fromAge: number,
): number | null {
  for (const p of projection) {
    if (p.age >= fromAge && p.capitalEnd <= 0) return p.age;
  }
  return null;
}

function primaryAgeWhenPartnerReaches(
  combinedDetail: CombinedWealthYearProjection[] | undefined,
  partnerAgeThreshold: number,
): number | null {
  const row = combinedDetail?.find(
    (entry) =>
      entry.partnerAge != null && entry.partnerAge >= partnerAgeThreshold,
  );
  return row?.primaryAge ?? null;
}

function partnerAgeAtPrimaryAge(
  combinedDetail: CombinedWealthYearProjection[] | undefined,
  primaryAge: number,
): number | null {
  const row = combinedDetail?.find((entry) => entry.primaryAge === primaryAge);
  return row?.partnerAge ?? null;
}

type Milestone = {
  /** X-position: always Person-1 age (calendar events mapped via combinedDetail). */
  xAge: number;
  label: string;
  colorClass: string;
  dash?: string;
};

export function FinancialIndependenceTimelineChart({
  timeline,
  profileRetirementAge,
  planningHorizonAge,
  independenceAge,
  primaryLabel = "Person 1",
  partnerLabel = "Person 2",
}: {
  timeline: FinancialIndependenceTimeline;
  profileRetirementAge?: number;
  planningHorizonAge?: number;
  independenceAge?: number;
  primaryLabel?: string;
  partnerLabel?: string;
}) {
  const {
    projection,
    employmentEndAge,
    ahvPensionStartAge,
    bvgPensionStartAge,
    sustainable,
    householdMode,
    partnerEmploymentEndAge,
    partnerAhvPensionStartAge,
    partnerBvgPensionStartAge,
    combinedDetail,
  } = timeline;

  if (projection.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Keine Vermögensprojektion für die Zeitachse verfügbar.
      </p>
    );
  }

  const depletionAge = sustainable
    ? null
    : findDepletionAge(projection, employmentEndAge);

  const milestones: Milestone[] = [
    {
      xAge: employmentEndAge,
      label:
        independenceAge != null
          ? householdMode
            ? `FI ${primaryLabel} (${employmentEndAge} J.)`
            : `FI (${employmentEndAge} J.)`
          : householdMode
            ? `Erwerbsende ${primaryLabel} (${employmentEndAge} J.)`
            : `Erwerbsende (${employmentEndAge} J.)`,
      colorClass: "stroke-primary",
      dash: "4 3",
    },
  ];

  if (
    profileRetirementAge != null &&
    profileRetirementAge !== employmentEndAge
  ) {
    milestones.push({
      xAge: profileRetirementAge,
      label: householdMode
        ? `Geplant ${primaryLabel} (${profileRetirementAge} J.)`
        : `Geplant (${profileRetirementAge} J.)`,
      colorClass: "stroke-muted-foreground/50",
      dash: "2 4",
    });
  }

  if (bvgPensionStartAge > employmentEndAge) {
    milestones.push({
      xAge: bvgPensionStartAge,
      label: householdMode
        ? `BVG ${primaryLabel} (${bvgPensionStartAge} J.)`
        : `BVG (${bvgPensionStartAge} J.)`,
      colorClass: "stroke-[hsl(var(--chart-2))]",
      dash: "3 3",
    });
  }

  if (ahvPensionStartAge > employmentEndAge) {
    milestones.push({
      xAge: ahvPensionStartAge,
      label: householdMode
        ? `AHV ${primaryLabel} (${ahvPensionStartAge} J.)`
        : `AHV (${ahvPensionStartAge} J.)`,
      colorClass: "stroke-[hsl(var(--chart-5))]",
      dash: "3 3",
    });
  }

  if (depletionAge != null) {
    milestones.push({
      xAge: depletionAge,
      label: `Leer (${depletionAge} J.)`,
      colorClass: "stroke-destructive",
      dash: "2 2",
    });
  }

  if (
    planningHorizonAge != null &&
    planningHorizonAge > employmentEndAge &&
    !milestones.some((m) => m.xAge === planningHorizonAge)
  ) {
    milestones.push({
      xAge: planningHorizonAge,
      label: householdMode
        ? `Horizont ${primaryLabel} (${planningHorizonAge} J.)`
        : `Horizont (${planningHorizonAge} J.)`,
      colorClass: "stroke-muted-foreground/30",
      dash: "2 6",
    });
  }

  if (householdMode && partnerEmploymentEndAge != null && combinedDetail) {
    const partnerStopPrimaryAge = primaryAgeWhenPartnerReaches(
      combinedDetail,
      partnerEmploymentEndAge,
    );
    if (
      partnerStopPrimaryAge != null &&
      partnerStopPrimaryAge !== employmentEndAge &&
      !milestones.some((m) => m.xAge === partnerStopPrimaryAge)
    ) {
      milestones.push({
        xAge: partnerStopPrimaryAge,
        label: `${partnerLabel} Erwerbsende (${partnerEmploymentEndAge} J.)`,
        colorClass: "stroke-violet-500/70",
        dash: "4 3",
      });
    }
    if (partnerAhvPensionStartAge != null) {
      const xAge = primaryAgeWhenPartnerReaches(
        combinedDetail,
        partnerAhvPensionStartAge,
      );
      if (
        xAge != null &&
        xAge > employmentEndAge &&
        !milestones.some((m) => m.xAge === xAge)
      ) {
        milestones.push({
          xAge,
          label: `${partnerLabel} AHV (${partnerAhvPensionStartAge} J.)`,
          colorClass: "stroke-violet-500/50",
          dash: "3 3",
        });
      }
    }
    if (partnerBvgPensionStartAge != null) {
      const xAge = primaryAgeWhenPartnerReaches(
        combinedDetail,
        partnerBvgPensionStartAge,
      );
      if (
        xAge != null &&
        xAge > employmentEndAge &&
        !milestones.some((m) => m.xAge === xAge)
      ) {
        milestones.push({
          xAge,
          label: `${partnerLabel} BVG (${partnerBvgPensionStartAge} J.)`,
          colorClass: "stroke-violet-500/40",
          dash: "3 3",
        });
      }
    }
  }

  return (
    <FinancialIndependenceTimelineChartInner
      projection={projection}
      employmentEndAge={employmentEndAge}
      milestones={milestones}
      sustainable={sustainable}
      depletionAge={depletionAge}
      householdMode={householdMode}
      combinedDetail={combinedDetail}
      primaryLabel={primaryLabel}
      partnerLabel={partnerLabel}
    />
  );
}

function TooltipRow({
  label,
  value,
  tone = "default",
  color,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "muted";
  color?: string;
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-destructive"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";

  return (
    <div className="flex justify-between gap-4">
      <dt style={color ? { color } : undefined}>{label}</dt>
      <dd className={`font-mono tabular-nums ${valueClass}`}>{value}</dd>
    </div>
  );
}

function YearTooltip({
  point,
  employmentEndAge,
  combinedRow,
  householdMode,
  primaryLabel = "Person 1",
  partnerLabel = "Person 2",
}: {
  point: FreeAssetsYearProjection;
  employmentEndAge: number;
  combinedRow?: CombinedWealthYearProjection;
  householdMode?: boolean;
  primaryLabel?: string;
  partnerLabel?: string;
}) {
  const capitalDelta = point.capitalEnd - point.capitalStart;
  const phase =
    point.age < employmentEndAge
      ? "Erwerbsphase"
      : point.capitalEnd < 0
        ? "Vermögen erschöpft"
        : "Ruhestand";

  const cashflow =
    combinedRow != null
      ? cashflowFromCombinedRow(combinedRow)
      : cashflowFromFreeAssetsRow(point, point.age >= employmentEndAge);

  const ageHeading =
    householdMode && combinedRow?.partnerAge != null
      ? `${primaryLabel} ${point.age} J. · ${partnerLabel} ${combinedRow.partnerAge} J. · ${point.year}`
      : `Alter ${point.age} · ${point.year}`;

  return (
    <>
      <p className="font-medium text-foreground">{ageHeading}</p>
      <p className="text-[10px] text-muted-foreground">{phase}</p>

      <dl className="mt-2 space-y-1 text-muted-foreground">
        <TooltipRow label="Vermögen Anfang" value={formatCHF(point.capitalStart)} />
        <TooltipRow label="Vermögen Ende" value={formatCHF(point.capitalEnd)} />
        <TooltipRow
          label="Veränderung"
          value={`${capitalDelta >= 0 ? "+" : "−"}${formatCHF(Math.abs(capitalDelta))}`}
          tone={capitalDelta >= 0 ? "positive" : "negative"}
        />

        {point.age >= employmentEndAge ? (
          <>
            <p className="border-t border-border/60 pt-2 text-[10px] font-medium uppercase tracking-wide text-foreground/70">
              Cashflow (Jahr)
            </p>
            {point.annualPensionIncome > 0 ? (
              <TooltipRow
                label="AHV/BVG-Rente"
                value={`+${formatCHF(point.annualPensionIncome)}`}
                tone="positive"
                color={PENSION_LINE_COLOR}
              />
            ) : null}
            {point.bvgCapitalInjection > 0 ? (
              combinedRow &&
              (combinedRow.primaryBvgCapitalInjection > 0 ||
                combinedRow.partnerBvgCapitalInjection > 0) ? (
                <>
                  {combinedRow.primaryBvgCapitalInjection > 0 ? (
                    <TooltipRow
                      label={`BVG Kapitalbezug (${primaryLabel})`}
                      value={`+${formatCHF(combinedRow.primaryBvgCapitalInjection)}`}
                      tone="positive"
                      color={PERSON1_COLOR}
                    />
                  ) : null}
                  {combinedRow.partnerBvgCapitalInjection > 0 ? (
                    <TooltipRow
                      label={`BVG Kapitalbezug (${partnerLabel})`}
                      value={`+${formatCHF(combinedRow.partnerBvgCapitalInjection)}`}
                      tone="positive"
                      color={PERSON2_COLOR}
                    />
                  ) : null}
                </>
              ) : (
                <TooltipRow
                  label="BVG Kapitalbezug"
                  value={`+${formatCHF(point.bvgCapitalInjection)}`}
                  tone="positive"
                  color={BVG_INJECTION_COLOR}
                />
              )
            ) : null}
            {point.pillar3aCapitalInjection > 0 ? (
              combinedRow &&
              (combinedRow.primaryPillar3aCapitalInjection > 0 ||
                combinedRow.partnerPillar3aCapitalInjection > 0) ? (
                <>
                  {combinedRow.primaryPillar3aCapitalInjection > 0 ? (
                    <TooltipRow
                      label={`Säule 3a Bezug (${primaryLabel})`}
                      value={`+${formatCHF(combinedRow.primaryPillar3aCapitalInjection)}`}
                      tone="positive"
                      color={PILLAR3A_INJECTION_COLOR}
                    />
                  ) : null}
                  {combinedRow.partnerPillar3aCapitalInjection > 0 ? (
                    <TooltipRow
                      label={`Säule 3a Bezug (${partnerLabel})`}
                      value={`+${formatCHF(combinedRow.partnerPillar3aCapitalInjection)}`}
                      tone="positive"
                      color={PERSON2_COLOR}
                    />
                  ) : null}
                </>
              ) : (
                <TooltipRow
                  label="Säule 3a Bezug"
                  value={`+${formatCHF(point.pillar3aCapitalInjection)}`}
                  tone="positive"
                  color={PILLAR3A_INJECTION_COLOR}
                />
              )
            ) : null}
            {(point.inheritanceInjection ?? 0) > 0 ? (
              <TooltipRow
                label="Erbschaft / Schenkung"
                value={`+${formatCHF(point.inheritanceInjection)}`}
                tone="positive"
                color={INHERITANCE_INJECTION_COLOR}
              />
            ) : null}
            {!householdMode && (combinedRow?.survivorWealthTransfer ?? 0) > 0 ? (
              <TooltipRow
                label={`Erbschaft ${primaryLabel} → ${partnerLabel}`}
                value={`+${formatCHF(combinedRow!.survivorWealthTransfer ?? 0)}`}
                tone="positive"
                color={PERSON2_COLOR}
              />
            ) : null}
            {cashflow ? (
              <HouseholdCashflowBreakdown cashflow={cashflow} />
            ) : null}
            {point.interest > 0 ? (
              <TooltipRow
                label="Verzinsung (Portfolio)"
                value={formatCHF(point.interest)}
                tone="muted"
              />
            ) : null}
          </>
        ) : (
          <>
            {point.savingsContribution > 0 ? (
              <TooltipRow
                label="Sparquote"
                value={`+${formatCHF(point.savingsContribution)}`}
                tone="positive"
              />
            ) : null}
            {point.interest > 0 ? (
              <TooltipRow
                label="Verzinsung"
                value={`+${formatCHF(point.interest)}`}
                tone="positive"
              />
            ) : null}
          </>
        )}
      </dl>
    </>
  );
}

function FinancialIndependenceTimelineChartInner({
  projection,
  employmentEndAge,
  milestones,
  sustainable,
  depletionAge,
  householdMode,
  combinedDetail,
  primaryLabel,
  partnerLabel,
}: {
  projection: FreeAssetsYearProjection[];
  employmentEndAge: number;
  milestones: Milestone[];
  sustainable: boolean;
  depletionAge: number | null;
  householdMode?: boolean;
  combinedDetail?: CombinedWealthYearProjection[];
  primaryLabel: string;
  partnerLabel: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const capitalAxisMaxRef = useRef<number | null>(null);
  const [hovered, setHovered] = useState<FreeAssetsYearProjection | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const { hidden, toggle, isVisible } = useChartSeriesVisibility();

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const minAge = projection[0].age;
  const maxAge = projection[projection.length - 1].age;

  const x = (age: number) =>
    PAD.left + ((age - minAge) / Math.max(maxAge - minAge, 1)) * innerW;

  const minCapital = Math.min(0, ...projection.map((p) => p.capitalEnd));
  const dataMaxCapital = Math.max(
    ...projection.map((p) => p.capitalEnd),
    1,
  );
  const maxCapitalAxis = resolveStableAxisMax(
    dataMaxCapital,
    capitalAxisMaxRef.current,
  );
  capitalAxisMaxRef.current = maxCapitalAxis;
  const capitalRange = maxCapitalAxis - minCapital;
  const postEmploymentYears = projection.filter((p) => p.age >= employmentEndAge);
  const maxAnnualFlow = Math.max(
    ...postEmploymentYears.map((p) =>
      Math.max(
        p.annualPensionIncome,
        p.annualTotalExpenses,
        p.bvgCapitalInjection,
        p.pillar3aCapitalInjection,
      ),
    ),
    1,
  );

  const yCapital = (v: number) =>
    PAD.top +
    innerH -
    ((v - minCapital) / Math.max(capitalRange, 1)) * innerH;
  const yAnnualFlow = (v: number) =>
    PAD.top + innerH - (v / maxAnnualFlow) * innerH;

  const linePathFor = (
    value: (p: FreeAssetsYearProjection) => number,
    scale: (v: number) => number,
  ) =>
    projection
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.age)} ${scale(value(p))}`)
      .join(" ");

  const wealthPath = linePathFor((p) => p.capitalEnd, yCapital);
  const pensionPath = linePathFor((p) => p.annualPensionIncome, yAnnualFlow);
  const netLivingPath = linePathFor(
    (p) => {
      const detail = combinedDetail?.find((row) => row.year === p.year);
      return detail?.netLivingExpenses ?? p.annualGrossExpenses;
    },
    yAnnualFlow,
  );
  const withdrawalPath = linePathFor((p) => p.annualWithdrawal, yAnnualFlow);

  const yTicks = 4;
  const capitalTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round(minCapital + (capitalRange / yTicks) * i),
  );
  const flowTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((maxAnnualFlow / yTicks) * i),
  );

  const ageLabels = projection.filter(
    (_, i) =>
      i % Math.ceil(projection.length / 7) === 0 ||
      i === projection.length - 1,
  );

  const findNearestPoint = useCallback(
    (clientX: number, clientY: number): FreeAssetsYearProjection | null => {
      const svg = svgRef.current;
      if (!svg) return null;

      const rect = svg.getBoundingClientRect();
      const svgX = ((clientX - rect.left) / rect.width) * WIDTH;
      const svgY = ((clientY - rect.top) / rect.height) * HEIGHT;

      if (
        svgX < PAD.left ||
        svgX > WIDTH - PAD.right ||
        svgY < PAD.top ||
        svgY > HEIGHT - PAD.bottom
      ) {
        return null;
      }

      const ageAtX =
        minAge + ((svgX - PAD.left) / innerW) * Math.max(maxAge - minAge, 1);

      let nearest = projection[0];
      let minDist = Math.abs(projection[0].age - ageAtX);
      for (const p of projection) {
        const dist = Math.abs(p.age - ageAtX);
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      }
      return nearest;
    },
    [innerW, maxAge, minAge, projection],
  );

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const point = findNearestPoint(e.clientX, e.clientY);
    if (!point) {
      setHovered(null);
      setCursor(null);
      return;
    }
    setHovered(point);
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setCursor({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handlePointerLeave = () => {
    setHovered(null);
    setCursor(null);
  };

  const milestoneLabelOffsets = new Map<number, number>();
  const sortedMilestones = [...milestones].sort((a, b) => a.xAge - b.xAge);
  sortedMilestones.forEach((m, i) => {
    milestoneLabelOffsets.set(m.xAge, (i % 3) * 14);
  });

  const chartSubtitle = householdMode
    ? `X-Achse: Alter ${primaryLabel} (P1); darunter ${partnerLabel} (P2) am selben Kalenderjahr. Netto-Lebenshaltung startet ab dem ersten Haushalts-Ruhestand (mit Teuerung); in der Mischphase mindert der Lohn des noch erwerbstätigen Partners die Entnahme.`
    : "Vermögensverlauf und jährliche Cashflows. Netto-Lebenshaltung startet ab Erwerbsaufgabe (mit Teuerung). Vertikale Linien markieren Erwerbsaufgabe, Rentenbeginn und ggf. Vermögenserschöpfung.";

  return (
    <div className="relative space-y-3">
      <p className="text-xs text-muted-foreground">{chartSubtitle}</p>

      {!sustainable && depletionAge != null ? (
        <p className="text-xs text-destructive">
          Vermögen geht voraussichtlich ab Alter {depletionAge} ins Minus — Erwerbsaufgabe
          ist mit diesen Annahmen nicht dauerhaft tragfähig.
        </p>
      ) : null}

      <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full max-w-full touch-none"
        role="img"
        aria-label="Zeitverlauf finanzielle Unabhängigkeit"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {capitalTickValues.map((tick) => (
          <g key={`capital-${tick}`}>
            <line
              x1={PAD.left}
              y1={yCapital(tick)}
              x2={WIDTH - PAD.right}
              y2={yCapital(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={yCapital(tick) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {formatAxisValue(tick)}
            </text>
          </g>
        ))}

        {minCapital < 0 ? (
          <line
            x1={PAD.left}
            y1={yCapital(0)}
            x2={WIDTH - PAD.right}
            y2={yCapital(0)}
            className="stroke-muted-foreground/60"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ) : null}

        {flowTickValues.map((tick) => (
          <g key={`flow-${tick}`}>
            <text
              x={WIDTH - PAD.right + 8}
              y={yAnnualFlow(tick) + 4}
              textAnchor="start"
              className="fill-muted-foreground text-[10px]"
            >
              {formatAxisValue(tick)}
            </text>
          </g>
        ))}

        <text
          x={PAD.left - 8}
          y={PAD.top - 18}
          textAnchor="end"
          className="fill-muted-foreground text-[9px]"
        >
          CHF
        </text>
        <text
          x={WIDTH - PAD.right + 8}
          y={PAD.top - 18}
          textAnchor="start"
          className="fill-muted-foreground text-[9px]"
        >
          CHF/J.
        </text>

        {milestones.map((m) => (
          <g key={`${m.label}-${m.xAge}`}>
            <line
              x1={x(m.xAge)}
              y1={PAD.top}
              x2={x(m.xAge)}
              y2={HEIGHT - PAD.bottom}
              className={m.colorClass}
              strokeWidth={m.label.startsWith("Leer") ? 2 : 1}
              strokeDasharray={m.dash ?? "4 3"}
            />
            <text
              x={x(m.xAge)}
              y={PAD.top - 6 - (milestoneLabelOffsets.get(m.xAge) ?? 0)}
              textAnchor="middle"
              className={`text-[9px] font-medium ${
                m.label.startsWith("Leer")
                  ? "fill-destructive"
                  : m.label.startsWith("FI")
                    ? "fill-primary"
                    : "fill-muted-foreground"
              }`}
            >
              {m.label}
            </text>
          </g>
        ))}

        {hovered && (
          <line
            x1={x(hovered.age)}
            y1={PAD.top}
            x2={x(hovered.age)}
            y2={HEIGHT - PAD.bottom}
            className="stroke-muted-foreground/50"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        {isVisible("netLiving") ? (
          <path
            d={netLivingPath}
            fill="none"
            stroke={EXPENSE_LINE_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeDasharray={RIGHT_AXIS_STROKE_DASH}
            opacity={0.75}
          />
        ) : null}
        {isVisible("withdrawal") ? (
          <path
            d={withdrawalPath}
            fill="none"
            stroke={WITHDRAWAL_LINE_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeDasharray="3 3"
            opacity={0.85}
          />
        ) : null}
        {isVisible("pension") ? (
          <path
            d={pensionPath}
            fill="none"
            stroke={PENSION_LINE_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeDasharray={RIGHT_AXIS_STROKE_DASH}
            opacity={0.85}
          />
        ) : null}
        {isVisible("wealth") ? (
          <path
            d={wealthPath}
            fill="none"
            stroke={WEALTH_LINE_COLOR}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        ) : null}

        {projection.map((p) => {
          const active = hovered?.year === p.year;
          const isPostEmployment = p.age >= employmentEndAge;
          const depleted = p.capitalEnd < 0;
          const hasBvg = p.bvgCapitalInjection > 0;
          const has3a = p.pillar3aCapitalInjection > 0;
          const hasInheritance = (p.inheritanceInjection ?? 0) > 0;
          const hasInjection = hasCapitalInjectionMarker(p);
          const offsets = injectionMarkerXOffsets(p);
          const baseR = active ? 6 : hasInjection ? 5 : isPostEmployment ? 3 : 2;

          return (
            <g key={p.year}>
              {isVisible("wealth") && !hasInjection ? (
                <circle
                  cx={x(p.age)}
                  cy={yCapital(p.capitalEnd)}
                  r={baseR}
                  className={
                    depleted
                      ? "fill-destructive"
                      : isPostEmployment && p.annualWithdrawal > 0
                        ? "fill-[hsl(var(--chart-3))]"
                        : "fill-primary"
                  }
                />
              ) : null}
              {hasBvg && isVisible("bvg") ? (
                <circle
                  cx={x(p.age) + offsets.bvg}
                  cy={yCapital(p.capitalEnd)}
                  r={baseR}
                  fill={BVG_INJECTION_COLOR}
                />
              ) : null}
              {hasInheritance && isVisible("inheritance") ? (
                <circle
                  cx={x(p.age) + offsets.inheritance}
                  cy={yCapital(p.capitalEnd)}
                  r={baseR}
                  fill={INHERITANCE_INJECTION_COLOR}
                />
              ) : null}
              {has3a && isVisible("pillar3a") ? (
                <circle
                  cx={x(p.age) + offsets.pillar3a}
                  cy={yCapital(p.capitalEnd)}
                  r={baseR}
                  fill={PILLAR3A_INJECTION_COLOR}
                />
              ) : null}
            </g>
          );
        })}

        {ageLabels.map((p) => {
          const partnerAge = partnerAgeAtPrimaryAge(combinedDetail, p.age);
          return (
            <g key={`age-${p.age}`}>
              <text
                x={x(p.age)}
                y={HEIGHT - (householdMode && partnerAge != null ? 20 : 8)}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {householdMode ? `P1 ${p.age}` : `${p.age} J.`}
              </text>
              {householdMode && partnerAge != null ? (
                <text
                  x={x(p.age)}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  className="fill-violet-600/80 text-[9px] dark:fill-violet-400/80"
                >
                  P2 {partnerAge}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {hovered && cursor && (
        <ChartFloatingTooltip
          cursor={cursor}
          containerWidth={svgRef.current?.clientWidth ?? 400}
          containerHeight={svgRef.current?.clientHeight ?? HEIGHT}
          tooltipWidth={224}
          className="min-w-[14rem] max-w-[17rem]"
        >
          <YearTooltip
            point={hovered}
            employmentEndAge={employmentEndAge}
            householdMode={householdMode}
            primaryLabel={primaryLabel}
            partnerLabel={partnerLabel}
            combinedRow={
              householdMode
                ? combinedDetail?.find((row) => row.year === hovered.year)
                : undefined
            }
          />
        </ChartFloatingTooltip>
      )}

      </div>

      <ChartLegend
        hidden={hidden}
        toggle={toggle}
        items={[
          {
            id: "wealth",
            label: "Vermögen",
            color: WEALTH_LINE_COLOR,
          },
          {
            id: "pension",
            label: "AHV/BVG-Rente/Jahr",
            color: PENSION_LINE_COLOR,
            variant: "dashed-line",
          },
          {
            id: "netLiving",
            label: "Lebenshaltung (netto)/Jahr",
            color: EXPENSE_LINE_COLOR,
            variant: "dashed-line",
          },
          {
            id: "withdrawal",
            label: "Entnahme aus Kapital/Jahr",
            color: WITHDRAWAL_LINE_COLOR,
            variant: "dashed-line",
          },
          {
            id: "bvg",
            label: "BVG Kapitalbezug",
            color: BVG_INJECTION_COLOR,
            variant: "dot",
          },
          {
            id: "pillar3a",
            label: "Säule 3a Bezug",
            color: PILLAR3A_INJECTION_COLOR,
            variant: "dot",
          },
          {
            id: "inheritance",
            label: "Erbschaft / Schenkung",
            color: INHERITANCE_INJECTION_COLOR,
            variant: "dot",
          },
        ]}
      />
    </div>
  );
}

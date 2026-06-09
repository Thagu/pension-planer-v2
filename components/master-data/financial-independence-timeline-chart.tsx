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
import type { CombinedWealthYearProjection } from "@/lib/household/types";
import { personLabel, PERSON1_COLOR, PERSON2_COLOR } from "@/lib/household/person-colors";
import { formatCHF, type FinancialIndependenceTimeline } from "@/lib/engine";
import type { FreeAssetsYearProjection } from "@/lib/engine";

const WIDTH = 640;
const HEIGHT = 280;
const PAD = { top: 36, right: 52, bottom: 40, left: 64 };

const BVG_INJECTION_COLOR = "hsl(var(--chart-2))";
const PILLAR3A_INJECTION_COLOR = "hsl(var(--chart-4))";
const PENSION_LINE_COLOR = "hsl(var(--chart-5))";
const EXPENSE_LINE_COLOR = "hsl(var(--chart-1))";

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

type Milestone = {
  age: number;
  label: string;
  colorClass: string;
  dash?: string;
};

export function FinancialIndependenceTimelineChart({
  timeline,
  profileRetirementAge,
  planningHorizonAge,
  independenceAge,
}: {
  timeline: FinancialIndependenceTimeline;
  profileRetirementAge?: number;
  planningHorizonAge?: number;
  independenceAge?: number;
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
      age: employmentEndAge,
      label: independenceAge != null ? `FI (${employmentEndAge} J.)` : `Erwerbsende (${employmentEndAge} J.)`,
      colorClass: "stroke-primary",
      dash: "4 3",
    },
  ];

  if (
    profileRetirementAge != null &&
    profileRetirementAge !== employmentEndAge
  ) {
    milestones.push({
      age: profileRetirementAge,
      label: `Geplant (${profileRetirementAge} J.)`,
      colorClass: "stroke-muted-foreground/50",
      dash: "2 4",
    });
  }

  if (bvgPensionStartAge > employmentEndAge) {
    milestones.push({
      age: bvgPensionStartAge,
      label: `BVG (${bvgPensionStartAge} J.)`,
      colorClass: "stroke-[hsl(var(--chart-2))]",
      dash: "3 3",
    });
  }

  if (ahvPensionStartAge > employmentEndAge) {
    milestones.push({
      age: ahvPensionStartAge,
      label: `AHV (${ahvPensionStartAge} J.)`,
      colorClass: "stroke-[hsl(var(--chart-5))]",
      dash: "3 3",
    });
  }

  if (depletionAge != null) {
    milestones.push({
      age: depletionAge,
      label: `Leer (${depletionAge} J.)`,
      colorClass: "stroke-destructive",
      dash: "2 2",
    });
  }

  if (
    planningHorizonAge != null &&
    planningHorizonAge > employmentEndAge &&
    !milestones.some((m) => m.age === planningHorizonAge)
  ) {
    milestones.push({
      age: planningHorizonAge,
      label: `Horizont (${planningHorizonAge} J.)`,
      colorClass: "stroke-muted-foreground/30",
      dash: "2 6",
    });
  }

  if (householdMode && partnerEmploymentEndAge != null) {
    if (
      partnerEmploymentEndAge !== employmentEndAge &&
      !milestones.some((m) => m.age === partnerEmploymentEndAge)
    ) {
      milestones.push({
        age: partnerEmploymentEndAge,
        label: `P2 Erwerbsende (${partnerEmploymentEndAge} J.)`,
        colorClass: "stroke-violet-500/70",
        dash: "4 3",
      });
    }
    if (
      partnerAhvPensionStartAge != null &&
      partnerAhvPensionStartAge > employmentEndAge &&
      !milestones.some((m) => m.age === partnerAhvPensionStartAge)
    ) {
      milestones.push({
        age: partnerAhvPensionStartAge,
        label: `P2 AHV (${partnerAhvPensionStartAge} J.)`,
        colorClass: "stroke-violet-500/50",
        dash: "3 3",
      });
    }
    if (
      partnerBvgPensionStartAge != null &&
      partnerBvgPensionStartAge > employmentEndAge &&
      !milestones.some((m) => m.age === partnerBvgPensionStartAge)
    ) {
      milestones.push({
        age: partnerBvgPensionStartAge,
        label: `P2 BVG (${partnerBvgPensionStartAge} J.)`,
        colorClass: "stroke-violet-500/40",
        dash: "3 3",
      });
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
}: {
  point: FreeAssetsYearProjection;
  employmentEndAge: number;
  combinedRow?: CombinedWealthYearProjection;
}) {
  const capitalDelta = point.capitalEnd - point.capitalStart;
  const phase =
    point.age < employmentEndAge
      ? "Erwerbsphase"
      : point.capitalEnd < 0
        ? "Vermögen erschöpft"
        : "Ruhestand";

  return (
    <>
      <p className="font-medium text-foreground">
        Alter {point.age} · {point.year}
      </p>
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
                      label={`BVG Kapitalbezug (${personLabel("primary")})`}
                      value={`+${formatCHF(combinedRow.primaryBvgCapitalInjection)}`}
                      tone="positive"
                      color={PERSON1_COLOR}
                    />
                  ) : null}
                  {combinedRow.partnerBvgCapitalInjection > 0 ? (
                    <TooltipRow
                      label={`BVG Kapitalbezug (${personLabel("partner")})`}
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
                      label={`Säule 3a Bezug (${personLabel("primary")})`}
                      value={`+${formatCHF(combinedRow.primaryPillar3aCapitalInjection)}`}
                      tone="positive"
                      color={PILLAR3A_INJECTION_COLOR}
                    />
                  ) : null}
                  {combinedRow.partnerPillar3aCapitalInjection > 0 ? (
                    <TooltipRow
                      label={`Säule 3a Bezug (${personLabel("partner")})`}
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
            {(combinedRow?.survivorWealthTransfer ?? 0) > 0 ? (
              <TooltipRow
                label={`Erbschaft ${personLabel("primary")} → ${personLabel("partner")}`}
                value={`+${formatCHF(combinedRow!.survivorWealthTransfer ?? 0)}`}
                tone="positive"
                color={PERSON2_COLOR}
              />
            ) : null}
            {point.annualWithdrawal > 0 ? (
              <TooltipRow
                label="Entnahme Vermögen"
                value={`−${formatCHF(point.annualWithdrawal)}`}
                tone="negative"
              />
            ) : null}
            {point.interest > 0 ? (
              <TooltipRow
                label="Verzinsung (Portfolio)"
                value={formatCHF(point.interest)}
                tone="muted"
              />
            ) : null}
            {point.annualTotalTax > 0 ? (
              <TooltipRow
                label="Steuern"
                value={`−${formatCHF(point.annualTotalTax)}`}
                tone="muted"
              />
            ) : null}
            {point.annualGrossExpenses > 0 ? (
              <TooltipRow
                label="Lebenshaltung"
                value={`−${formatCHF(point.annualGrossExpenses)}`}
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
}: {
  projection: FreeAssetsYearProjection[];
  employmentEndAge: number;
  milestones: Milestone[];
  sustainable: boolean;
  depletionAge: number | null;
  householdMode?: boolean;
  combinedDetail?: CombinedWealthYearProjection[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
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
  const maxCapital = Math.max(
    ...projection.map((p) => p.capitalEnd),
    1,
  );
  const capitalRange = maxCapital - minCapital;
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
  const expensePath = linePathFor((p) => p.annualTotalExpenses, yAnnualFlow);

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
  const sortedMilestones = [...milestones].sort((a, b) => a.age - b.age);
  sortedMilestones.forEach((m, i) => {
    milestoneLabelOffsets.set(m.age, (i % 3) * 14);
  });

  return (
    <div className="relative space-y-3">
      <p className="text-xs text-muted-foreground">
        Vermögensverlauf und jährliche Renten/Ausgaben. Vertikale Linien markieren
        Erwerbsaufgabe, Rentenbeginn und ggf. Vermögenserschöpfung.
      </p>

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
          <g key={`${m.label}-${m.age}`}>
            <line
              x1={x(m.age)}
              y1={PAD.top}
              x2={x(m.age)}
              y2={HEIGHT - PAD.bottom}
              className={m.colorClass}
              strokeWidth={m.label.startsWith("Leer") ? 2 : 1}
              strokeDasharray={m.dash ?? "4 3"}
            />
            <text
              x={x(m.age)}
              y={PAD.top - 6 - (milestoneLabelOffsets.get(m.age) ?? 0)}
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

        {isVisible("expenses") ? (
          <path
            d={expensePath}
            fill="none"
            stroke={EXPENSE_LINE_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeDasharray={RIGHT_AXIS_STROKE_DASH}
            opacity={0.75}
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
          const hasInjection = hasBvg || has3a;
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
                  cx={x(p.age) - 4}
                  cy={yCapital(p.capitalEnd)}
                  r={baseR}
                  fill={BVG_INJECTION_COLOR}
                />
              ) : null}
              {has3a && isVisible("pillar3a") ? (
                <circle
                  cx={x(p.age) + 4}
                  cy={yCapital(p.capitalEnd)}
                  r={baseR}
                  fill={PILLAR3A_INJECTION_COLOR}
                />
              ) : null}
            </g>
          );
        })}

        {ageLabels.map((p) => (
          <text
            key={`age-${p.age}`}
            x={x(p.age)}
            y={HEIGHT - 8}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {p.age} J.
          </text>
        ))}
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
            id: "expenses",
            label: "Ausgaben/Jahr",
            color: EXPENSE_LINE_COLOR,
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
        ]}
      />
    </div>
  );
}

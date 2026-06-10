"use client";

import { useCallback, useRef, useState } from "react";

import {
  ChartLegend,
  useChartSeriesVisibility,
} from "@/components/charts/chart-legend";
import {
  cashflowFromFreeAssetsRow,
  HouseholdCashflowBreakdown,
} from "@/components/charts/household-cashflow-tooltip";
import {
  ChartFloatingTooltip,
  RIGHT_AXIS_STROKE_DASH,
  WEALTH_LINE_COLOR,
} from "@/components/charts/chart-tooltip";
import type { FreeAssetsYearProjection } from "@/lib/engine";
import { formatCHF } from "@/lib/engine";

const WIDTH = 560;
const HEIGHT = 240;
const PAD = { top: 20, right: 52, bottom: 40, left: 64 };

const BVG_INJECTION_COLOR = "hsl(var(--chart-2))";
const PILLAR3A_INJECTION_COLOR = "hsl(var(--chart-4))";
const INCOME_LINE_COLOR = "hsl(var(--chart-5))";
const EXPENSE_LINE_COLOR = "hsl(var(--chart-1))";
const SAVINGS_LINE_COLOR = "hsl(142 55% 42%)";
const GROSS_EXPENSE_LINE_COLOR = "hsl(var(--destructive))";

export function FreeAssetsGrowthChart({
  projection,
  retirementAge,
  planningHorizonAge,
  annualRetirementExpenses,
  annualFixedPensionIncome,
  annualNetExpenseGap,
  endCapital,
  monthlyIncome,
}: {
  projection: FreeAssetsYearProjection[];
  retirementAge: number;
  planningHorizonAge?: number;
  annualRetirementExpenses?: number;
  annualFixedPensionIncome?: number;
  annualNetExpenseGap?: number;
  endCapital?: number;
  monthlyIncome?: number;
}) {
  if (projection.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Keine Vermögensprojektion verfügbar.
      </p>
    );
  }

  return (
    <FreeAssetsGrowthChartInner
      projection={projection}
      retirementAge={retirementAge}
      planningHorizonAge={planningHorizonAge}
      annualRetirementExpenses={annualRetirementExpenses}
      annualFixedPensionIncome={annualFixedPensionIncome}
      annualNetExpenseGap={annualNetExpenseGap}
      endCapital={endCapital}
      monthlyIncome={monthlyIncome}
    />
  );
}

function formatAxisValue(tick: number): string {
  if (tick >= 1_000_000) return `${Math.round(tick / 100_000) / 10}M`;
  if (tick >= 1000) return `${Math.round(tick / 1000)}k`;
  return String(tick);
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
        ? "text-foreground"
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
  retirementAge,
}: {
  point: FreeAssetsYearProjection;
  retirementAge: number;
}) {
  const capitalDelta = point.capitalEnd - point.capitalStart;
  const annualNet = point.annualTotalIncome - point.annualTotalExpenses;
  const cashflow = cashflowFromFreeAssetsRow(
    point,
    point.age >= retirementAge,
  );
  const hasIncomeDetails =
    point.savingsContribution > 0 ||
    point.interest > 0 ||
    point.annualPensionIncome > 0 ||
    point.bvgCapitalInjection > 0 ||
    point.pillar3aCapitalInjection > 0;
  const hasExpenseDetails =
    point.annualGrossExpenses > 0 || point.annualTotalTax > 0;

  return (
    <>
      <p className="font-medium text-foreground">
        Alter {point.age} · {point.year}
      </p>

      <dl className="mt-2 space-y-1 text-muted-foreground">
        <p className="text-[10px] font-medium uppercase tracking-wide text-foreground/70">
          Vermögen
        </p>
        <TooltipRow
          label="Jahresanfang"
          value={formatCHF(point.capitalStart)}
        />
        <TooltipRow label="Jahresende" value={formatCHF(point.capitalEnd)} />
        <TooltipRow
          label="Veränderung"
          value={`${capitalDelta >= 0 ? "+" : "−"}${formatCHF(Math.abs(capitalDelta))}`}
          tone={capitalDelta >= 0 ? "positive" : "negative"}
        />

        {hasIncomeDetails || point.annualTotalIncome > 0 ? (
          <>
            <p className="border-t border-border/60 pt-2 text-[10px] font-medium uppercase tracking-wide text-foreground/70">
              Einnahmen (Jahr)
            </p>
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
            {point.annualPensionIncome > 0 ? (
              <TooltipRow
                label="AHV/BVG-Rente"
                value={`+${formatCHF(point.annualPensionIncome)}`}
                tone="positive"
              />
            ) : null}
            {point.bvgCapitalInjection > 0 ? (
              <TooltipRow
                label="BVG Kapitalbezug"
                value={`+${formatCHF(point.bvgCapitalInjection)}`}
                tone="positive"
                color={BVG_INJECTION_COLOR}
              />
            ) : null}
            {point.pillar3aCapitalInjection > 0 ? (
              <TooltipRow
                label="Säule 3a Bezug"
                value={`+${formatCHF(point.pillar3aCapitalInjection)}`}
                tone="positive"
                color={PILLAR3A_INJECTION_COLOR}
              />
            ) : null}
            <TooltipRow
              label="Total Einnahmen"
              value={`+${formatCHF(point.annualTotalIncome)}`}
              color={INCOME_LINE_COLOR}
            />
          </>
        ) : null}

        {cashflow ? (
          <HouseholdCashflowBreakdown cashflow={cashflow} showPhaseBadge={false} />
        ) : hasExpenseDetails || point.annualTotalExpenses > 0 ? (
          <>
            <p className="border-t border-border/60 pt-2 text-[10px] font-medium uppercase tracking-wide text-foreground/70">
              Ausgaben (Jahr)
            </p>
            <TooltipRow
              label="Total Ausgaben"
              value={`−${formatCHF(point.annualTotalExpenses)}`}
              color={EXPENSE_LINE_COLOR}
            />
          </>
        ) : null}

        {(point.annualTotalIncome > 0 || point.annualTotalExpenses > 0) && (
          <div className="border-t border-border/60 pt-2">
            <TooltipRow
              label="Jahres-Saldo"
              value={`${annualNet >= 0 ? "+" : "−"}${formatCHF(Math.abs(annualNet))}`}
              tone={annualNet >= 0 ? "positive" : "negative"}
            />
          </div>
        )}
      </dl>
    </>
  );
}

function FreeAssetsGrowthChartInner({
  projection,
  retirementAge,
  planningHorizonAge,
  annualRetirementExpenses,
  annualFixedPensionIncome,
  annualNetExpenseGap,
  endCapital,
  monthlyIncome,
}: {
  projection: FreeAssetsYearProjection[];
  retirementAge: number;
  planningHorizonAge?: number;
  annualRetirementExpenses?: number;
  annualFixedPensionIncome?: number;
  annualNetExpenseGap?: number;
  endCapital?: number;
  monthlyIncome?: number;
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

  const maxCapital = Math.max(...projection.map((p) => p.capitalEnd), 1);
  const maxAnnualFlow = Math.max(
    ...projection.map((p) =>
      Math.max(
        p.savingsContribution,
        p.annualTotalIncome,
        p.annualTotalExpenses,
        p.annualGrossExpenses,
      ),
    ),
    1,
  );

  const yCapital = (v: number) =>
    PAD.top + innerH - (v / maxCapital) * innerH;
  const yAnnualFlow = (v: number) =>
    PAD.top + innerH - (v / maxAnnualFlow) * innerH;

  const linePathFor = (
    value: (p: FreeAssetsYearProjection) => number,
    scale: (v: number) => number,
  ) =>
    projection
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.age)} ${scale(value(p))}`)
      .join(" ");

  const linePath = linePathFor((p) => p.capitalEnd, yCapital);
  const savingsLinePath = linePathFor(
    (p) => p.savingsContribution,
    yAnnualFlow,
  );
  const incomeLinePath = linePathFor(
    (p) => p.annualTotalIncome,
    yAnnualFlow,
  );
  const expenseLinePath = linePathFor(
    (p) => p.annualTotalExpenses,
    yAnnualFlow,
  );
  const grossExpenseLinePath = linePathFor(
    (p) => p.annualGrossExpenses,
    yAnnualFlow,
  );

  const yTicks = 4;
  const capitalTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((maxCapital / yTicks) * i),
  );
  const flowTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((maxAnnualFlow / yTicks) * i),
  );

  const ageLabels = projection.filter(
    (_, i) =>
      i % Math.ceil(projection.length / 6) === 0 ||
      i === projection.length - 1,
  );

  const retirementPoint = projection.find((p) => p.age === retirementAge);
  const horizonPoint =
    planningHorizonAge != null
      ? projection.find((p) => p.age === planningHorizonAge)
      : projection[projection.length - 1];

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

  const injectionMarkerOffset = (p: FreeAssetsYearProjection): number => {
    const hasBvg = p.bvgCapitalInjection > 0;
    const has3a = p.pillar3aCapitalInjection > 0;
    if (hasBvg && has3a) return 4;
    return 0;
  };

  return (
    <div className="relative space-y-3">
      <p className="text-xs text-muted-foreground">
        Linke Skala: Vermögen (CHF). Rechte Skala: Sparquote, Einnahmen und
        Ausgaben (CHF/J.). Markierungen = Kapitalzuflüsse (BVG, 3a).
      </p>
      <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full max-w-full touch-none"
        role="img"
        aria-label="Vermögensentwicklung freies Vermögen"
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
          y={PAD.top - 6}
          textAnchor="end"
          className="fill-muted-foreground text-[9px]"
        >
          Vermögen
        </text>
        <text
          x={WIDTH - PAD.right + 8}
          y={PAD.top - 6}
          textAnchor="start"
          className="fill-muted-foreground text-[9px]"
        >
          CHF/J.
        </text>

        {retirementPoint && (
          <line
            x1={x(retirementPoint.age)}
            y1={PAD.top}
            x2={x(retirementPoint.age)}
            y2={HEIGHT - PAD.bottom}
            className="stroke-primary/40"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        {horizonPoint &&
        horizonPoint.age !== retirementPoint?.age &&
        horizonPoint.age !== projection[projection.length - 1]?.age ? (
          <line
            x1={x(horizonPoint.age)}
            y1={PAD.top}
            x2={x(horizonPoint.age)}
            y2={HEIGHT - PAD.bottom}
            className="stroke-muted-foreground/30"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ) : null}

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

        {isVisible("savings") ? (
          <path
            d={savingsLinePath}
            fill="none"
            stroke={SAVINGS_LINE_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeDasharray={RIGHT_AXIS_STROKE_DASH}
          />
        ) : null}
        {isVisible("income") ? (
          <path
            d={incomeLinePath}
            fill="none"
            stroke={INCOME_LINE_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeDasharray={RIGHT_AXIS_STROKE_DASH}
            opacity={0.85}
          />
        ) : null}
        {isVisible("expenses") ? (
          <path
            d={expenseLinePath}
            fill="none"
            stroke={EXPENSE_LINE_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeDasharray={RIGHT_AXIS_STROKE_DASH}
            opacity={0.85}
          />
        ) : null}
        {isVisible("grossExpenses") ? (
          <path
            d={grossExpenseLinePath}
            fill="none"
            stroke={GROSS_EXPENSE_LINE_COLOR}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeDasharray={RIGHT_AXIS_STROKE_DASH}
            opacity={0.7}
          />
        ) : null}
        {isVisible("wealth") ? (
          <path
            d={linePath}
            fill="none"
            stroke={WEALTH_LINE_COLOR}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        ) : null}

        {projection.map((p) => {
          const active = hovered?.year === p.year;
          const isPostRetirement = p.age >= retirementAge;
          const hasBvg = p.bvgCapitalInjection > 0;
          const has3a = p.pillar3aCapitalInjection > 0;
          const hasInjection = hasBvg || has3a;
          const offset = injectionMarkerOffset(p);
          const baseR = active ? 6 : hasInjection ? 5 : 2.5;

          return (
            <g key={p.year}>
              {hasInjection &&
              ((hasBvg && isVisible("bvg")) || (has3a && isVisible("pillar3a"))) ? (
                <>
                  <line
                    x1={x(p.age)}
                    y1={PAD.top}
                    x2={x(p.age)}
                    y2={HEIGHT - PAD.bottom}
                    stroke={hasBvg ? BVG_INJECTION_COLOR : PILLAR3A_INJECTION_COLOR}
                    strokeWidth={1}
                    strokeDasharray="2 4"
                    strokeOpacity={0.35}
                  />
                  <text
                    x={x(p.age)}
                    y={PAD.top + 10}
                    textAnchor="middle"
                    className="text-[9px] font-medium"
                    style={{
                      fill: hasBvg ? BVG_INJECTION_COLOR : PILLAR3A_INJECTION_COLOR,
                    }}
                  >
                    {hasBvg && has3a ? "Kapital" : hasBvg ? "BVG" : "3a"}
                  </text>
                </>
              ) : null}
              {isVisible("wealth") && !hasInjection ? (
                <circle
                  cx={x(p.age)}
                  cy={yCapital(p.capitalEnd)}
                  r={baseR}
                  className={
                    isPostRetirement && p.annualWithdrawal > 0
                      ? "fill-[hsl(var(--chart-3))]"
                      : "fill-primary transition-[r]"
                  }
                />
              ) : null}
              {hasBvg && isVisible("bvg") ? (
                <circle
                  cx={x(p.age) - offset}
                  cy={yCapital(p.capitalEnd)}
                  r={baseR}
                  fill={BVG_INJECTION_COLOR}
                />
              ) : null}
              {has3a && isVisible("pillar3a") ? (
                <circle
                  cx={x(p.age) + offset}
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

        {retirementPoint && (
          <text
            x={x(retirementPoint.age)}
            y={PAD.top - 4}
            textAnchor="middle"
            className="fill-primary text-[10px] font-medium"
          >
            Pension
          </text>
        )}
      </svg>

      {hovered && cursor && (
        <ChartFloatingTooltip
          cursor={cursor}
          containerWidth={svgRef.current?.clientWidth ?? 400}
          containerHeight={svgRef.current?.clientHeight ?? HEIGHT}
          tooltipWidth={240}
          className="min-w-[15rem] max-w-[18rem]"
        >
          <YearTooltip point={hovered} retirementAge={retirementAge} />
        </ChartFloatingTooltip>
      )}

      </div>

      <ChartLegend
        hidden={hidden}
        toggle={toggle}
        items={[
          {
            id: "wealth",
            label: "Vermögen (links)",
            color: WEALTH_LINE_COLOR,
          },
          {
            id: "savings",
            label: "Sparquote/J. (rechts)",
            color: SAVINGS_LINE_COLOR,
            variant: "dashed-line",
          },
          {
            id: "income",
            label: "Einnahmen/J. (rechts)",
            color: INCOME_LINE_COLOR,
            variant: "dashed-line",
          },
          {
            id: "expenses",
            label: "Ausgaben inkl. Steuern/J.",
            color: EXPENSE_LINE_COLOR,
            variant: "dashed-line",
          },
          {
            id: "grossExpenses",
            label: "Lebenshaltung/J. (Hochrechnung)",
            color: GROSS_EXPENSE_LINE_COLOR,
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
            id: "pension-line",
            label: `Pensionierung (${retirementAge} J.)`,
            interactive: false,
            className: "text-muted-foreground",
          },
          ...(planningHorizonAge != null && planningHorizonAge > retirementAge
            ? [
                {
                  id: "horizon-line",
                  label: `Planungshorizont (${planningHorizonAge} J.)`,
                  interactive: false,
                  className: "text-muted-foreground",
                },
              ]
            : []),
          ...((annualRetirementExpenses ?? 0) > 0
            ? [
                {
                  id: "retirement-expenses-info",
                  label: `Ausgaben ${formatCHF(annualRetirementExpenses ?? 0)}/J.${
                    (annualFixedPensionIncome ?? 0) > 0
                      ? ` · netto ${formatCHF(annualNetExpenseGap ?? 0)}/J.`
                      : ""
                  }`,
                  interactive: false,
                },
              ]
            : []),
        ]}
      />

      <p className="text-xs text-muted-foreground">
        Endvermögen (Alter {planningHorizonAge ?? maxAge}):{" "}
        {formatCHF(endCapital ?? projection[projection.length - 1].capitalEnd)}
        {monthlyIncome != null && monthlyIncome > 0
          ? ` · Vermögens-Entnahme ${formatCHF(monthlyIncome)}/Mt.`
          : ""}
        {(annualRetirementExpenses ?? 0) > 0
          ? ` · Ausgaben ${formatCHF(annualRetirementExpenses ?? 0)}/J.${(annualFixedPensionIncome ?? 0) > 0 ? ` abzgl. AHV/BVG ${formatCHF(annualFixedPensionIncome ?? 0)}/J.` : ""}`
          : ""}
      </p>
    </div>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";

import {
  ChartLegend,
  useChartSeriesVisibility,
} from "@/components/charts/chart-legend";
import type { CombinedWealthYearProjection } from "@/lib/household/types";
import { formatCHF } from "@/lib/engine";
import {
  PERSON1_COLOR,
  PERSON2_COLOR,
  personLabel,
} from "@/lib/household/person-colors";

const WIDTH = 640;
const HEIGHT = 280;
const PAD = { top: 36, right: 52, bottom: 40, left: 64 };

const PRIMARY_COLOR = PERSON1_COLOR;
const PARTNER_COLOR = PERSON2_COLOR;
const TOTAL_COLOR = "hsl(var(--chart-2))";
const BVG_COLOR = "hsl(var(--chart-2))";
const PILLAR3A_COLOR = "hsl(var(--chart-4))";

function formatAxisValue(tick: number): string {
  if (tick >= 1_000_000) return `${Math.round(tick / 100_000) / 10}M`;
  if (tick >= 1000) return `${Math.round(tick / 1000)}k`;
  return String(tick);
}

type Props = {
  projection: CombinedWealthYearProjection[];
  householdRetirementAge?: number;
  planningHorizonAge?: number;
  showSplit?: boolean;
  primaryLabel?: string;
  partnerLabel?: string;
};

export function CombinedWealthChart({
  projection,
  householdRetirementAge,
  planningHorizonAge,
  showSplit = true,
  primaryLabel = "Person 1",
  partnerLabel = "Person 2",
}: Props) {
  if (projection.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Keine gemeinsame Vermögensprojektion verfügbar.
      </p>
    );
  }

  const ages = projection.map((row) => row.primaryAge);
  const totals = projection.map((row) => row.capitalEnd);
  const primaryValues = projection.map((row) => row.primaryCapitalEnd);
  const partnerValues = projection.map((row) => row.partnerCapitalEnd);

  const maxY = Math.max(...totals, 1);
  const minAge = ages[0];
  const maxAge = ages[ages.length - 1];

  const xScale = (age: number) =>
    PAD.left +
    ((age - minAge) / Math.max(maxAge - minAge, 1)) * (WIDTH - PAD.left - PAD.right);
  const yScale = (value: number) =>
    PAD.top + (1 - value / maxY) * (HEIGHT - PAD.top - PAD.bottom);

  const totalPath = projection
    .map((row, i) => `${i === 0 ? "M" : "L"} ${xScale(row.primaryAge)} ${yScale(row.capitalEnd)}`)
    .join(" ");

  const primaryPath = projection
    .map(
      (row, i) =>
        `${i === 0 ? "M" : "L"} ${xScale(row.primaryAge)} ${yScale(row.primaryCapitalEnd)}`,
    )
    .join(" ");

  const partnerPath = projection
    .map(
      (row, i) =>
        `${i === 0 ? "M" : "L"} ${xScale(row.primaryAge)} ${yScale(row.partnerCapitalEnd)}`,
    )
    .join(" ");

  const endTotal = totals[totals.length - 1] ?? 0;
  const endPrimary = primaryValues[primaryValues.length - 1] ?? 0;
  const endPartner = partnerValues[partnerValues.length - 1] ?? 0;

  return (
    <CombinedWealthChartInteractive
      projection={projection}
      householdRetirementAge={householdRetirementAge}
      planningHorizonAge={planningHorizonAge}
      showSplit={showSplit}
      primaryLabel={primaryLabel}
      partnerLabel={partnerLabel}
      totalPath={totalPath}
      primaryPath={primaryPath}
      partnerPath={partnerPath}
      xScale={xScale}
      yScale={yScale}
      minAge={minAge}
      maxAge={maxAge}
      maxY={maxY}
      endTotal={endTotal}
      endPrimary={endPrimary}
      endPartner={endPartner}
    />
  );
}

function CombinedWealthChartInteractive({
  projection,
  householdRetirementAge,
  planningHorizonAge,
  showSplit,
  primaryLabel,
  partnerLabel,
  totalPath,
  primaryPath,
  partnerPath,
  xScale,
  yScale,
  minAge,
  maxAge,
  maxY,
  endTotal,
  endPrimary,
  endPartner,
}: Props & {
  totalPath: string;
  primaryPath: string;
  partnerPath: string;
  xScale: (age: number) => number;
  yScale: (value: number) => number;
  minAge: number;
  maxAge: number;
  maxY: number;
  endTotal: number;
  endPrimary: number;
  endPartner: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { hidden, toggle, isVisible } = useChartSeriesVisibility();

  const handleMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
      const age = minAge + ((x - PAD.left) / (WIDTH - PAD.left - PAD.right)) * (maxAge - minAge);
      let best = 0;
      let bestDist = Infinity;
      projection.forEach((row, index) => {
        const dist = Math.abs(row.primaryAge - age);
        if (dist < bestDist) {
          bestDist = dist;
          best = index;
        }
      });
      setHoverIndex(best);
    },
    [maxAge, minAge, projection],
  );

  const hover = hoverIndex != null ? projection[hoverIndex] : null;

  const yTicks = [0, maxY * 0.25, maxY * 0.5, maxY * 0.75, maxY];
  const xTicks: number[] = [];
  const step = Math.max(5, Math.round((maxAge - minAge) / 6 / 5) * 5);
  for (let age = minAge; age <= maxAge; age += step) xTicks.push(age);
  if (xTicks[xTicks.length - 1] !== maxAge) xTicks.push(maxAge);

  return (
    <div className="space-y-3">
      <ChartLegend
        hidden={hidden}
        toggle={toggle}
        className="text-muted-foreground"
        items={[
          {
            id: "total",
            label: `Haushalt gesamt: ${formatCHF(endTotal)}`,
            color: TOTAL_COLOR,
          },
          ...(showSplit
            ? [
                {
                  id: "primary",
                  label: `${primaryLabel}: ${formatCHF(endPrimary)}`,
                  color: PRIMARY_COLOR,
                },
                {
                  id: "partner",
                  label: `${partnerLabel}: ${formatCHF(endPartner)}`,
                  color: PARTNER_COLOR,
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

          {householdRetirementAge != null &&
          householdRetirementAge >= minAge &&
          householdRetirementAge <= maxAge ? (
            <line
              x1={xScale(householdRetirementAge)}
              x2={xScale(householdRetirementAge)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="hsl(var(--primary))"
              strokeDasharray="4 3"
              strokeOpacity={0.5}
            />
          ) : null}

          {planningHorizonAge != null &&
          planningHorizonAge >= minAge &&
          planningHorizonAge <= maxAge ? (
            <line
              x1={xScale(planningHorizonAge)}
              x2={xScale(planningHorizonAge)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="2 4"
              strokeOpacity={0.35}
            />
          ) : null}

          {showSplit ? (
            <>
              {isVisible("primary") ? (
                <path
                  d={primaryPath}
                  fill="none"
                  stroke={PRIMARY_COLOR}
                  strokeWidth={1.5}
                  strokeOpacity={0.65}
                />
              ) : null}
              {isVisible("partner") ? (
                <path
                  d={partnerPath}
                  fill="none"
                  stroke={PARTNER_COLOR}
                  strokeWidth={1.5}
                  strokeOpacity={0.65}
                />
              ) : null}
            </>
          ) : null}

          {isVisible("total") ? (
            <path d={totalPath} fill="none" stroke={TOTAL_COLOR} strokeWidth={2.5} />
          ) : null}

          {projection.map((row) => {
            const hasBvg = row.bvgCapitalInjection > 0;
            const has3a = row.pillar3aCapitalInjection > 0;
            const hasSurvivor =
              showSplit && (row.survivorWealthTransfer ?? 0) > 0;
            if (!hasBvg && !has3a && !hasSurvivor) return null;
            let offset = 0;
            if (hasBvg && has3a) offset = 5;
            return (
              <g key={`evt-${row.year}`}>
                {hasBvg ? (
                  <circle
                    cx={xScale(row.primaryAge) - offset}
                    cy={yScale(row.capitalEnd)}
                    r={4}
                    fill={BVG_COLOR}
                  />
                ) : null}
                {has3a ? (
                  <circle
                    cx={xScale(row.primaryAge) + offset}
                    cy={yScale(row.capitalEnd)}
                    r={4}
                    fill={PILLAR3A_COLOR}
                  />
                ) : null}
                {hasSurvivor ? (
                  <circle
                    cx={xScale(row.primaryAge)}
                    cy={yScale(row.capitalEnd) - 8}
                    r={4}
                    fill={PARTNER_COLOR}
                  />
                ) : null}
              </g>
            );
          })}

          {hover ? (
            <>
              <line
                x1={xScale(hover.primaryAge)}
                x2={xScale(hover.primaryAge)}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                stroke="currentColor"
                strokeOpacity={0.2}
              />
              <circle
                cx={xScale(hover.primaryAge)}
                cy={yScale(hover.capitalEnd)}
                r={4}
                fill={TOTAL_COLOR}
              />
            </>
          ) : null}
        </svg>
      </div>

      {hover ? (
        <div className="rounded-md border bg-background/80 px-3 py-2 text-xs">
          <p>
            Alter Person 1: <strong>{hover.primaryAge}</strong>
            {hover.partnerAge != null ? (
              <> · Person 2: <strong>{hover.partnerAge}</strong></>
            ) : null}
          </p>
          <p>
            Haushalt: <strong>{formatCHF(hover.capitalEnd)}</strong>
            {showSplit ? (
              <>
                {" "}
                ({primaryLabel} {formatCHF(hover.primaryCapitalEnd)}
                {hover.partnerAge != null
                  ? ` · ${partnerLabel} ${formatCHF(hover.partnerCapitalEnd)}`
                  : ""}
                )
              </>
            ) : null}
          </p>
          {(hover.bvgCapitalInjection > 0 ||
            hover.pillar3aCapitalInjection > 0 ||
            (showSplit && (hover.survivorWealthTransfer ?? 0) > 0)) && (
            <dl className="mt-2 space-y-1 border-t border-border/60 pt-2">
              {hover.primaryBvgCapitalInjection > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt style={{ color: PRIMARY_COLOR }}>
                    BVG Bezug {personLabel("primary")}
                  </dt>
                  <dd className="font-mono tabular-nums">
                    +{formatCHF(hover.primaryBvgCapitalInjection)}
                  </dd>
                </div>
              ) : null}
              {hover.partnerBvgCapitalInjection > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt style={{ color: PARTNER_COLOR }}>
                    BVG Bezug {personLabel("partner")}
                  </dt>
                  <dd className="font-mono tabular-nums">
                    +{formatCHF(hover.partnerBvgCapitalInjection)}
                  </dd>
                </div>
              ) : null}
              {hover.primaryPillar3aCapitalInjection > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt style={{ color: PILLAR3A_COLOR }}>
                    3a Bezug {personLabel("primary")}
                  </dt>
                  <dd className="font-mono tabular-nums">
                    +{formatCHF(hover.primaryPillar3aCapitalInjection)}
                  </dd>
                </div>
              ) : null}
              {hover.partnerPillar3aCapitalInjection > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt style={{ color: PILLAR3A_COLOR }}>
                    3a Bezug {personLabel("partner")}
                  </dt>
                  <dd className="font-mono tabular-nums">
                    +{formatCHF(hover.partnerPillar3aCapitalInjection)}
                  </dd>
                </div>
              ) : null}
              {showSplit && (hover.survivorWealthTransfer ?? 0) > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt style={{ color: PARTNER_COLOR }}>
                    Erbschaft P1 → P2
                  </dt>
                  <dd className="font-mono tabular-nums">
                    +{formatCHF(hover.survivorWealthTransfer ?? 0)}
                  </dd>
                </div>
              ) : null}
            </dl>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          X-Achse: Alter Person 1 · Markierungen: Kapitalbezüge (BVG, 3a) und
          Erbschaft beim Planungshorizont von Person 1
        </p>
      )}
    </div>
  );
}

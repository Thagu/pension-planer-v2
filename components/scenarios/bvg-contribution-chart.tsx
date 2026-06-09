"use client";

import { useCallback, useRef, useState } from "react";

import {
  ChartLegend,
  useChartSeriesVisibility,
} from "@/components/charts/chart-legend";
import {
  ChartFloatingTooltip,
} from "@/components/charts/chart-tooltip";
import type { BvgYearProjection } from "@/lib/engine";
import { formatCHF } from "@/lib/engine";

const INTEREST_COLOR = "hsl(215 50% 45%)";

const WIDTH = 560;
const HEIGHT = 220;
const PAD = { top: 20, right: 16, bottom: 40, left: 56 };

export function BvgContributionChart({
  projection,
  accentColor = "hsl(var(--primary))",
  personLabel: personName,
}: {
  projection: BvgYearProjection[];
  accentColor?: string;
  personLabel?: string;
}) {
  const points = projection.filter(
    (p) => p.contribution > 0 || p.interest > 0,
  );

  if (points.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Keine projizierten Beitragsjahre (zu kurze Restlaufzeit oder kein koordinierter
        Lohn).
      </p>
    );
  }

  return <BvgContributionChartInner points={points} accentColor={accentColor} personLabel={personName} />;
}

function BvgContributionChartInner({
  points,
  accentColor,
  personLabel: personName,
}: {
  points: BvgYearProjection[];
  accentColor: string;
  personLabel?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<BvgYearProjection | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const { hidden, toggle, isVisible } = useChartSeriesVisibility();

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const minAge = points[0].age;
  const maxAge = points[points.length - 1].age;

  const maxY = Math.max(
    ...points.map((p) => Math.max(p.contribution, p.interest)),
    1,
  );

  const x = (age: number) =>
    PAD.left + ((age - minAge) / Math.max(maxAge - minAge, 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / maxY) * innerH;

  const pathFor = (key: "contribution" | "interest") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.age)} ${y(p[key])}`)
      .join(" ");

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((maxY / yTicks) * i),
  );

  const ageLabels = points.filter(
    (_, i) => i % Math.ceil(points.length / 6) === 0 || i === points.length - 1,
  );

  const findNearestPoint = useCallback(
    (clientX: number, clientY: number): BvgYearProjection | null => {
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

      let nearest = points[0];
      let minDist = Math.abs(points[0].age - ageAtX);
      for (const p of points) {
        const dist = Math.abs(p.age - ageAtX);
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      }
      return nearest;
    },
    [innerW, maxAge, minAge, points],
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

  const totalContributions = points.reduce((sum, p) => sum + p.contribution, 0);
  const totalInterest = points.reduce((sum, p) => sum + p.interest, 0);
  const capitalGrowth =
    (points[points.length - 1]?.capitalEnd ?? 0) - (points[0]?.capitalStart ?? 0);

  return (
    <div className="relative space-y-3">
      {personName ? (
        <p className="text-xs font-medium" style={{ color: accentColor }}>
          {personName}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Jährliche BVG-Einzahlung (Altersgutschrift) und Verzinsung nach Alter. Mit der
        Maus über die Grafik fahren, um die Werte pro Jahr zu sehen.
      </p>
      <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-full h-auto touch-none"
        role="img"
        aria-label="BVG Beiträge und Verzinsung nach Alter"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {yTickValues.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              y1={y(tick)}
              x2={WIDTH - PAD.right}
              y2={y(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {tick >= 1000 ? `${Math.round(tick / 1000)}k` : tick}
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

        {isVisible("contribution") ? (
          <path
            d={pathFor("contribution")}
            fill="none"
            stroke={accentColor}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ) : null}
        {isVisible("interest") ? (
          <path
            d={pathFor("interest")}
            fill="none"
            stroke={INTEREST_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ) : null}

        {points.map((p) => {
          const active = hovered?.year === p.year;
          return (
            <g key={p.year}>
              {isVisible("contribution") ? (
                <circle
                  cx={x(p.age)}
                  cy={y(p.contribution)}
                  r={active ? 5 : 3}
                  fill={accentColor}
                  className="transition-[r]"
                />
              ) : null}
              {isVisible("interest") ? (
                <circle
                  cx={x(p.age)}
                  cy={y(p.interest)}
                  r={active ? 5 : 3}
                  fill={INTEREST_COLOR}
                  className="transition-[r]"
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
          tooltipWidth={176}
          className="min-w-[11rem]"
        >
          <p className="font-medium text-foreground">
            Alter {hovered.age} · {hovered.year}
          </p>
          <dl className="mt-1.5 space-y-1 text-muted-foreground">
            <div className="flex justify-between gap-4">
              <dt style={{ color: accentColor }}>Altersgutschrift</dt>
              <dd className="font-mono tabular-nums text-foreground">
                {formatCHF(hovered.contribution)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt style={{ color: INTEREST_COLOR }}>Verzinsung</dt>
              <dd className="font-mono tabular-nums text-foreground">
                {formatCHF(hovered.interest)}
              </dd>
            </div>
          </dl>
        </ChartFloatingTooltip>
      )}

      </div>

      <ChartLegend
        hidden={hidden}
        toggle={toggle}
        items={[
          { id: "contribution", label: "Altersgutschrift", color: accentColor },
          {
            id: "interest",
            label: "Verzinsung",
            color: INTEREST_COLOR,
          },
        ]}
      />

      <p className="text-xs text-muted-foreground">
        Summe Altersgutschriften: {formatCHF(totalContributions)} · Summe
        Verzinsung: {formatCHF(totalInterest)} · Kapitalzuwachs (Beiträge +
        Zinsen): {formatCHF(capitalGrowth)}
        <br />
        Max. Altersgutschrift ca.{" "}
        {formatCHF(
          points.reduce((best, p) =>
            p.contribution > best.contribution ? p : best,
          ).contribution,
        )}
        /Jahr · Endkapital{" "}
        {formatCHF(points[points.length - 1].capitalEnd)}
      </p>
    </div>
  );
}

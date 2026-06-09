"use client";

import { useCallback, useRef, useState } from "react";

import {
  ChartLegend,
  useChartSeriesVisibility,
} from "@/components/charts/chart-legend";
import {
  ChartFloatingTooltip,
} from "@/components/charts/chart-tooltip";
import type { Pillar3aResult } from "@/lib/engine";
import { formatCHF } from "@/lib/engine";

const WIDTH = 560;
const HEIGHT = 220;
const PAD = { top: 20, right: 16, bottom: 40, left: 64 };

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function Pillar3aProjectionChart({ result }: { result: Pillar3aResult }) {
  const accounts = result.accounts.filter((a) => a.projection.length > 0);
  if (accounts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Keine 3a-Projektion verfügbar.
      </p>
    );
  }

  return <Pillar3aProjectionChartInner accounts={accounts} />;
}

function Pillar3aProjectionChartInner({
  accounts,
}: {
  accounts: Pillar3aResult["accounts"];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredAge, setHoveredAge] = useState<number | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const { hidden, toggle, isVisible } = useChartSeriesVisibility();

  const allPoints = accounts.flatMap((a) => a.projection);
  const minAge = Math.min(...allPoints.map((p) => p.age));
  const maxAge = Math.max(...allPoints.map((p) => p.age));
  const maxY = Math.max(...allPoints.map((p) => p.capitalEnd), 1);

  const ages = [...new Set(allPoints.map((p) => p.age))].sort((a, b) => a - b);

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const x = (age: number) =>
    PAD.left + ((age - minAge) / Math.max(maxAge - minAge, 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / maxY) * innerH;

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((maxY / yTicks) * i),
  );

  const ageLabels = ages.filter(
    (_, i) => i % Math.ceil(ages.length / 6) === 0 || i === ages.length - 1,
  );

  const findNearestAge = useCallback(
    (clientX: number, clientY: number): number | null => {
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

      let nearest = ages[0];
      let minDist = Math.abs(ages[0] - ageAtX);
      for (const age of ages) {
        const dist = Math.abs(age - ageAtX);
        if (dist < minDist) {
          minDist = dist;
          nearest = age;
        }
      }
      return nearest;
    },
    [ages, innerW, maxAge, minAge],
  );

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const age = findNearestAge(e.clientX, e.clientY);
    if (age == null) {
      setHoveredAge(null);
      setCursor(null);
      return;
    }
    setHoveredAge(age);
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setCursor({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  return (
    <div className="relative space-y-3">
      <p className="text-xs text-muted-foreground">
        Kapitalentwicklung pro 3a-Konto bis zur Pensionierung (Einzahlung +
        Verzinsung).
      </p>
      <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full max-w-full touch-none"
        role="img"
        aria-label="3a Kapitalentwicklung"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          setHoveredAge(null);
          setCursor(null);
        }}
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

        {hoveredAge != null && (
          <line
            x1={x(hoveredAge)}
            y1={PAD.top}
            x2={x(hoveredAge)}
            y2={HEIGHT - PAD.bottom}
            className="stroke-muted-foreground/50"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        {accounts.map((account, index) => {
          if (!isVisible(account.id)) return null;
          const color = COLORS[index % COLORS.length];
          const path = account.projection
            .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.age)} ${y(p.capitalEnd)}`)
            .join(" ");
          return (
            <path
              key={account.id}
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          );
        })}

        {ageLabels.map((age) => (
          <text
            key={`age-${age}`}
            x={x(age)}
            y={HEIGHT - 8}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {age} J.
          </text>
        ))}
      </svg>

      {hoveredAge != null && cursor && (
        <ChartFloatingTooltip
          cursor={cursor}
          containerWidth={svgRef.current?.clientWidth ?? 400}
          containerHeight={svgRef.current?.clientHeight ?? HEIGHT}
          tooltipWidth={200}
          className="min-w-[12rem]"
        >
          <p className="font-medium text-foreground">Alter {hoveredAge}</p>
          <dl className="mt-1.5 space-y-1">
            {accounts.map((account, index) => {
              const point = account.projection.find((p) => p.age === hoveredAge);
              if (!point) return null;
              const color = COLORS[index % COLORS.length];
              return (
                <div
                  key={account.id}
                  className="flex justify-between gap-4 text-muted-foreground"
                >
                  <dt style={{ color }}>{account.name}</dt>
                  <dd className="font-mono tabular-nums text-foreground">
                    {formatCHF(point.capitalEnd)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </ChartFloatingTooltip>
      )}

      </div>

      <ChartLegend
        hidden={hidden}
        toggle={toggle}
        items={accounts.map((account, index) => ({
          id: account.id,
          label: `${account.name} → ${formatCHF(account.projectedCapital)}`,
          color: COLORS[index % COLORS.length],
        }))}
      />
    </div>
  );
}

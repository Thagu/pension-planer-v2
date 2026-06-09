"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  ChartLegend,
  useChartSeriesVisibility,
} from "@/components/charts/chart-legend";
import type { Pillar3aResult } from "@/lib/engine";
import { formatCHF } from "@/lib/engine";
import {
  PERSON1_COLOR,
  PERSON2_COLOR,
  personLabel,
} from "@/lib/household/person-colors";

const WIDTH = 640;
const HEIGHT = 260;
const PAD = { top: 24, right: 16, bottom: 44, left: 64 };

const TOTAL_COLOR = "hsl(var(--chart-2))";

type Series = {
  id: string;
  name: string;
  person: "primary" | "partner";
  color: string;
  points: { year: number; age: number; capitalEnd: number }[];
  withdrawal?: { year: number; age: number; amount: number };
};

type Props = {
  primary: Pillar3aResult;
  partner: Pillar3aResult | null;
  primaryBirthDate: string;
  partnerBirthDate?: string | null;
  primaryHorizonAge?: number;
  partnerHorizonAge?: number;
};

function birthYear(birthDate: string): number {
  return new Date(birthDate).getFullYear();
}

function isYounger(birthA: string, birthB: string): boolean {
  return new Date(birthB) > new Date(birthA);
}

function buildSeries(
  result: Pillar3aResult,
  person: "primary" | "partner",
  color: string,
): Series[] {
  return result.accounts
    .filter((account) => account.projection.length > 0)
    .map((account) => {
      const withdrawal = result.scheduledWithdrawals.find(
        (w) => w.accountId === account.id,
      );
      return {
        id: account.id,
        name: account.name,
        person,
        color,
        points: account.projection.map((p) => ({
          year: p.year,
          age: p.age,
          capitalEnd: p.capitalEnd,
        })),
        withdrawal: withdrawal
          ? {
              year: withdrawal.withdrawalYear,
              age: withdrawal.withdrawalAge,
              amount: withdrawal.amount,
            }
          : undefined,
      };
    });
}

export function HouseholdPillar3aChart({
  primary,
  partner,
  primaryBirthDate,
  partnerBirthDate,
  primaryHorizonAge = 90,
  partnerHorizonAge = 90,
}: Props) {
  const series = useMemo(() => {
    const items = buildSeries(primary, "primary", PERSON1_COLOR);
    if (partner) {
      items.push(...buildSeries(partner, "partner", PERSON2_COLOR));
    }
    return items;
  }, [primary, partner]);

  const { minYear, maxYear, totalByYear, withdrawals } = useMemo(() => {
    const allYears = new Set<number>();
    for (const s of series) {
      for (const p of s.points) allYears.add(p.year);
      if (s.withdrawal) allYears.add(s.withdrawal.year);
    }

    let endYear = Math.max(...allYears, birthYear(primaryBirthDate) + primaryHorizonAge);
    if (partnerBirthDate) {
      const youngerEnd = isYounger(primaryBirthDate, partnerBirthDate)
        ? birthYear(partnerBirthDate) + partnerHorizonAge
        : birthYear(primaryBirthDate) + primaryHorizonAge;
      endYear = Math.max(endYear, youngerEnd);
    }

    const minY = Math.min(...allYears);
    const years: number[] = [];
    for (let y = minY; y <= endYear; y++) years.push(y);

    const totalByYear = new Map<number, number>();
    for (const year of years) {
      let sum = 0;
      for (const s of series) {
        if (s.withdrawal && year >= s.withdrawal.year) continue;
        const point =
          s.points.find((p) => p.year === year) ??
          s.points.filter((p) => p.year <= year).at(-1);
        if (point) sum += point.capitalEnd;
      }
      totalByYear.set(year, sum);
    }

    const withdrawals = series
      .filter((s) => s.withdrawal)
      .map((s) => ({
        ...s.withdrawal!,
        person: s.person,
        accountName: s.name,
        color: s.color,
      }));

    return { minYear: minY, maxYear: endYear, totalByYear, withdrawals };
  }, [
    series,
    primaryBirthDate,
    partnerBirthDate,
    primaryHorizonAge,
    partnerHorizonAge,
  ]);

  if (series.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Keine 3a-Projektion verfügbar.
      </p>
    );
  }

  return (
    <HouseholdPillar3aChartInner
      series={series}
      minYear={minYear}
      maxYear={maxYear}
      totalByYear={totalByYear}
      withdrawals={withdrawals}
    />
  );
}

function HouseholdPillar3aChartInner({
  series,
  minYear,
  maxYear,
  totalByYear,
  withdrawals,
}: {
  series: Series[];
  minYear: number;
  maxYear: number;
  totalByYear: Map<number, number>;
  withdrawals: {
    year: number;
    age: number;
    amount: number;
    person: "primary" | "partner";
    accountName: string;
    color: string;
  }[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const { hidden, toggle, isVisible } = useChartSeriesVisibility();

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = minYear; y <= maxYear; y++) list.push(y);
    return list;
  }, [minYear, maxYear]);

  const maxY = Math.max(...totalByYear.values(), 1);
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const x = (year: number) =>
    PAD.left + ((year - minYear) / Math.max(maxYear - minYear, 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / maxY) * innerH;

  const totalPath = years
    .map((year, i) => {
      const total = totalByYear.get(year) ?? 0;
      return `${i === 0 ? "M" : "L"} ${x(year)} ${y(total)}`;
    })
    .join(" ");

  const findNearestYear = useCallback(
    (clientX: number): number | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const svgX = ((clientX - rect.left) / rect.width) * WIDTH;
      if (svgX < PAD.left || svgX > WIDTH - PAD.right) return null;
      const yearAtX =
        minYear + ((svgX - PAD.left) / innerW) * Math.max(maxYear - minYear, 1);
      let nearest = years[0];
      let minDist = Math.abs(years[0] - yearAtX);
      for (const year of years) {
        const dist = Math.abs(year - yearAtX);
        if (dist < minDist) {
          minDist = dist;
          nearest = year;
        }
      }
      return nearest;
    },
    [innerW, maxYear, minYear, years],
  );

  const endTotal = totalByYear.get(maxYear) ?? 0;

  return (
    <div className="relative space-y-3">
      <p className="text-xs text-muted-foreground">
        Kapitalentwicklung beider Personen (Kalenderjahr). Gestrichelte Markierungen =
        Kapitalbezüge. Zeithorizont orientiert sich an der jüngeren Person.
      </p>

      <ChartLegend
        hidden={hidden}
        toggle={toggle}
        items={[
          {
            id: "total",
            label: `Gesamt: ${formatCHF(endTotal)}`,
            color: TOTAL_COLOR,
          },
          ...series.map((s) => ({
            id: s.id,
            label: `${personLabel(s.person)} · ${s.name}`,
            color: s.color,
          })),
        ]}
      />

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full max-w-full touch-none"
        role="img"
        aria-label="3a Kapitalentwicklung Haushalt"
        onPointerMove={(e) => setHoverYear(findNearestYear(e.clientX))}
        onPointerLeave={() => setHoverYear(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const tick = Math.round(maxY * frac);
          return (
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
          );
        })}

        {series.map((s) => {
          if (!isVisible(s.id)) return null;
          const path = s.points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.year)} ${y(p.capitalEnd)}`)
            .join(" ");
          return (
            <path
              key={s.id}
              d={path}
              fill="none"
              stroke={s.color}
              strokeWidth={1.5}
              strokeOpacity={0.75}
              strokeLinejoin="round"
            />
          );
        })}

        {isVisible("total") ? (
          <path
            d={totalPath}
            fill="none"
            stroke={TOTAL_COLOR}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        ) : null}

        {withdrawals.map((w) => {
          const seriesId = series.find((s) => s.name === w.accountName)?.id;
          if (seriesId && !isVisible(seriesId)) return null;
          return (
          <g key={`${w.accountName}-${w.year}`}>
            <line
              x1={x(w.year)}
              y1={PAD.top}
              x2={x(w.year)}
              y2={HEIGHT - PAD.bottom}
              stroke={w.color}
              strokeWidth={1}
              strokeDasharray="3 3"
              strokeOpacity={0.6}
            />
            <text
              x={x(w.year)}
              y={PAD.top - 4}
              textAnchor="middle"
              className="text-[9px]"
              style={{ fill: w.color }}
            >
              3a
            </text>
          </g>
          );
        })}

        {hoverYear != null && (
          <line
            x1={x(hoverYear)}
            y1={PAD.top}
            x2={x(hoverYear)}
            y2={HEIGHT - PAD.bottom}
            className="stroke-muted-foreground/50"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        {years
          .filter(
            (_, i) =>
              i % Math.ceil(years.length / 7) === 0 || i === years.length - 1,
          )
          .map((year) => (
            <text
              key={year}
              x={x(year)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {year}
            </text>
          ))}
      </svg>

      {hoverYear != null && (
        <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-sm">
          <p className="font-medium">Jahr {hoverYear}</p>
          <dl className="mt-1.5 space-y-1">
            <div className="flex justify-between gap-4">
              <dt style={{ color: TOTAL_COLOR }}>Gesamt 3a</dt>
              <dd className="font-mono tabular-nums">
                {formatCHF(totalByYear.get(hoverYear) ?? 0)}
              </dd>
            </div>
            {series.map((s) => {
              const point = s.points.find((p) => p.year === hoverYear);
              if (!point) return null;
              const withdrawn =
                s.withdrawal != null && hoverYear >= s.withdrawal.year;
              return (
                <div
                  key={s.id}
                  className="flex justify-between gap-4 text-muted-foreground"
                >
                  <dt style={{ color: s.color }}>
                    {personLabel(s.person)} · {s.name}
                    {withdrawn ? " (bezogen)" : ""}
                  </dt>
                  <dd className="font-mono tabular-nums text-foreground">
                    {formatCHF(withdrawn ? 0 : point.capitalEnd)}
                  </dd>
                </div>
              );
            })}
            {withdrawals
              .filter((w) => w.year === hoverYear)
              .map((w) => (
                <div
                  key={`w-${w.accountName}`}
                  className="flex justify-between gap-4 border-t border-border/60 pt-1"
                >
                  <dt style={{ color: w.color }}>
                    Bezug {personLabel(w.person)} · {w.accountName}
                  </dt>
                  <dd className="font-mono tabular-nums text-emerald-600">
                    +{formatCHF(w.amount)}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      )}
    </div>
  );
}

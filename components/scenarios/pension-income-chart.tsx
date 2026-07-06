"use client";

import { useMemo } from "react";

import {
  ChartLegend,
  useChartSeriesVisibility,
} from "@/components/charts/chart-legend";
import type { ScenarioPensionResult } from "@/lib/engine";
import { formatCHF } from "@/lib/engine";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
];

export function countPensionIncomeSources(result: ScenarioPensionResult): number {
  const displayAge = result.summary.employmentEndAge;
  let count = 0;
  if (
    displayAge >= result.ahv.pensionStartAge &&
    result.ahv.monthlyPension > 0
  ) {
    count += 1;
  }
  if (
    displayAge >= result.bvg.pensionStartAge &&
    result.bvg.monthlyPension > 0
  ) {
    count += 1;
  }
  if (result.summary.monthlyFreeAssets > 0) count += 1;
  return count;
}

export function PensionIncomeChart({ result }: { result: ScenarioPensionResult }) {
  const displayAge = result.summary.employmentEndAge;

  const segments = useMemo(() => {
    const items = [
      {
        key: "ahv",
        label: "AHV",
        value:
          displayAge >= result.ahv.pensionStartAge
            ? result.ahv.monthlyPension
            : 0,
        note:
          displayAge < result.ahv.pensionStartAge
            ? `ab ${result.ahv.pensionStartAge} J.`
            : undefined,
      },
      {
        key: "bvg",
        label: "BVG",
        value:
          displayAge >= result.bvg.pensionStartAge
            ? result.bvg.monthlyPension
            : 0,
        note:
          displayAge < result.bvg.pensionStartAge
            ? `ab ${result.bvg.pensionStartAge} J.`
            : undefined,
      },
      {
        key: "free",
        label: "Vermögen",
        value: result.summary.monthlyFreeAssets,
      },
    ].filter((item) => item.value > 0);

    const total = items.reduce((sum, item) => sum + item.value, 0);
    return { items, total };
  }, [result, displayAge]);

  if (segments.total <= 0) {
    return null;
  }

  return (
    <PensionIncomeChartInner segments={segments} displayAge={displayAge} />
  );
}

function PensionIncomeChartInner({
  segments,
  displayAge,
}: {
  segments: {
    items: {
      key: string;
      label: string;
      value: number;
      note?: string;
    }[];
    total: number;
  };
  displayAge: number;
}) {
  const { hidden, toggle, isVisible } = useChartSeriesVisibility();

  const visibleItems = segments.items.filter((item) => isVisible(item.key));
  const visibleTotal = visibleItems.reduce((sum, item) => sum + item.value, 0);

  const WIDTH = 560;
  const BAR_H = 36;
  const PAD = { left: 0, right: 0, top: 8, bottom: 8 };
  const innerW = WIDTH - PAD.left - PAD.right;

  let offset = PAD.left;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Monatliches Einkommen ab Erwerbsaufgabe ({displayAge} J.). AHV/BVG
        erscheinen erst ab dem jeweiligen Bezugsalter.
      </p>
      <svg
        viewBox={`0 0 ${WIDTH} ${BAR_H + PAD.top + PAD.bottom}`}
        className="h-auto w-full max-w-full"
        role="img"
        aria-label="Einkommensverteilung nach Säule"
      >
        {visibleTotal > 0
          ? visibleItems.map((item, index) => {
              const originalIndex = segments.items.findIndex(
                (s) => s.key === item.key,
              );
              const width = (item.value / visibleTotal) * innerW;
              const x = offset;
              offset += width;
              const color = COLORS[originalIndex % COLORS.length];
              const showLabel = width > 56;

              return (
                <g key={item.key}>
                  <rect
                    x={x}
                    y={PAD.top}
                    width={Math.max(width, 2)}
                    height={BAR_H}
                    rx={index === 0 ? 4 : 0}
                    fill={color}
                    opacity={0.9}
                  />
                  {showLabel ? (
                    <text
                      x={x + width / 2}
                      y={PAD.top + BAR_H / 2 + 4}
                      textAnchor="middle"
                      className="fill-primary-foreground text-[11px] font-medium"
                    >
                      {item.label}
                    </text>
                  ) : null}
                </g>
              );
            })
          : null}
      </svg>

      <ChartLegend
        hidden={hidden}
        toggle={toggle}
        items={[
          ...segments.items.map((item, index) => ({
            id: item.key,
            label: `${item.label} ${formatCHF(item.value)}/Mt.${
              item.note ? ` (${item.note})` : ""
            } (${Math.round((item.value / segments.total) * 100)}%)`,
            color: COLORS[index % COLORS.length],
            variant: "square" as const,
          })),
          {
            id: "total-label",
            label: `Total ${formatCHF(segments.total)}/Mt.`,
            interactive: false,
            className: "font-mono font-semibold text-primary",
          },
        ]}
      />
    </div>
  );
}

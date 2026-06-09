"use client";

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Dashed stroke for series mapped to the right Y-axis. */
export const RIGHT_AXIS_STROKE_DASH = "6 4";

export const WEALTH_LINE_COLOR = "hsl(var(--primary))";

const DEFAULT_OFFSET = 12;

export type ChartTooltipPositionInput = {
  cursorX: number;
  cursorY: number;
  containerWidth: number;
  containerHeight?: number;
  tooltipWidth: number;
  tooltipHeight?: number;
  offset?: number;
};

export function getChartTooltipStyle({
  cursorX,
  cursorY,
  containerWidth,
  containerHeight,
  tooltipWidth,
  tooltipHeight = 140,
  offset = DEFAULT_OFFSET,
}: ChartTooltipPositionInput): CSSProperties {
  const spaceRight = containerWidth - cursorX;
  const spaceLeft = cursorX;

  let left: number;
  if (spaceRight >= tooltipWidth + offset) {
    left = cursorX + offset;
  } else if (spaceLeft >= tooltipWidth + offset) {
    left = cursorX - tooltipWidth - offset;
  } else {
    left = Math.max(
      offset,
      Math.min(cursorX + offset, containerWidth - tooltipWidth - offset),
    );
  }

  let top = cursorY - 8;
  if (containerHeight != null) {
    const spaceBelow = containerHeight - cursorY;
    if (spaceBelow < tooltipHeight + offset && cursorY > tooltipHeight + offset) {
      top = cursorY - tooltipHeight - offset;
    }
  }

  return {
    left: Math.max(0, left),
    top: Math.max(0, top),
  };
}

export function ChartFloatingTooltip({
  cursor,
  containerWidth,
  containerHeight,
  tooltipWidth,
  tooltipHeight,
  className,
  children,
}: {
  cursor: { x: number; y: number };
  containerWidth: number;
  containerHeight?: number;
  tooltipWidth: number;
  tooltipHeight?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-10 rounded-md border bg-popover px-3 py-2 text-xs shadow-md",
        className,
      )}
      style={getChartTooltipStyle({
        cursorX: cursor.x,
        cursorY: cursor.y,
        containerWidth,
        containerHeight,
        tooltipWidth,
        tooltipHeight,
      })}
    >
      {children}
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

export type ChartLegendItem = {
  id: string;
  label: string;
  color?: string;
  variant?: "line" | "dashed-line" | "dotted-line" | "dot" | "square";
  className?: string;
  /** Reference-only entries (e.g. milestone lines) are not clickable. */
  interactive?: boolean;
};

export function useChartSeriesVisibility() {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isVisible = useCallback((id: string) => !hidden.has(id), [hidden]);

  return { hidden, toggle, isVisible };
}

function LegendSwatch({
  item,
  dimmed,
}: {
  item: ChartLegendItem;
  dimmed: boolean;
}) {
  const opacity = dimmed ? 0.35 : 1;

  switch (item.variant) {
    case "dashed-line":
      return (
        <span
          className="inline-block h-0.5 w-6 border-t-2 border-dashed"
          style={{ borderColor: item.color, opacity }}
        />
      );
    case "dotted-line":
      return (
        <span
          className="inline-block h-0.5 w-6 border-t-2 border-dotted"
          style={{ borderColor: item.color, opacity }}
        />
      );
    case "dot":
      return (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: item.color, opacity }}
        />
      );
    case "square":
      return (
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: item.color, opacity }}
        />
      );
    default:
      return (
        <span
          className="inline-block h-0.5 w-6"
          style={{ backgroundColor: item.color, opacity }}
        />
      );
  }
}

export function ChartLegend({
  items,
  hidden,
  toggle,
  className,
}: {
  items: ChartLegendItem[];
  hidden: Set<string>;
  toggle: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-2 text-xs", className)}>
      {items.map((item) => {
        const isHidden = hidden.has(item.id);
        const interactive = item.interactive !== false;

        if (!interactive) {
          return (
            <span
              key={item.id}
              className={cn(
                "flex items-center gap-2 text-muted-foreground",
                item.className,
              )}
            >
              <LegendSwatch item={item} dimmed={false} />
              {item.label}
            </span>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            className={cn(
              "flex items-center gap-2 rounded-sm transition-opacity hover:opacity-80",
              isHidden && "opacity-50 line-through",
              item.className,
            )}
            aria-pressed={!isHidden}
          >
            <LegendSwatch item={item} dimmed={isHidden} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

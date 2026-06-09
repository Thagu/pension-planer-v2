"use client";

import type { ReactNode } from "react";

export function HouseholdSplitLayout({
  planningMode,
  leftLabel = "Person 1",
  rightLabel = "Person 2",
  left,
  right,
  shared,
}: {
  planningMode: "single" | "couple";
  leftLabel?: string;
  rightLabel?: string;
  left: ReactNode;
  right?: ReactNode;
  shared?: ReactNode;
}) {
  if (planningMode === "single") {
    return (
      <div className="space-y-6">
        {shared}
        <div className="rounded-xl border bg-primary/[0.03] p-4 md:p-6">{left}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {shared}
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="min-w-0 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 md:p-6">
          <p className="mb-4 text-sm font-semibold text-primary">{leftLabel}</p>
          {left}
        </div>
        <div className="min-w-0 rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-4 md:p-6">
          <p className="mb-4 text-sm font-semibold text-violet-700 dark:text-violet-300">
            {rightLabel}
          </p>
          {right}
        </div>
      </div>
    </div>
  );
}

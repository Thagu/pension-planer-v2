"use client";

import { formatCHF, type HouseholdPensionResult } from "@/lib/engine";
import { CollapsibleCard } from "@/components/ui/collapsible-card";

export function HouseholdPensionSummary({
  result,
}: {
  result: HouseholdPensionResult;
}) {
  const primaryMonthly = result.primary.summary.monthlyTotalAtHorizon;
  const partnerMonthly = result.partner?.summary.monthlyTotalAtHorizon ?? 0;
  const combinedMonthly = primaryMonthly + partnerMonthly;
  const endCapital =
    result.combinedProjection[result.combinedProjection.length - 1]?.capitalEnd ?? 0;

  return (
    <CollapsibleCard
      title="Haushalts-Rentenvorschau"
      description={`Person 1: Erwerbsaufgabe ${result.primary.summary.employmentEndAge} J.${
        result.partner
          ? ` · Person 2: ${result.partner.summary.employmentEndAge} J.`
          : ""
      } · Haushaltspensionierung ab ${result.householdRetirementAge} J.${
        result.ahvCouplePlafonierungApplied
          ? " · AHV-Plafonierung (Ehepaar) angewendet"
          : ""
      }`}
      className="border-primary/25 bg-primary/5"
      defaultOpen
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Person 1 / Mt.</p>
          <p className="text-xl font-semibold tabular-nums">{formatCHF(primaryMonthly)}</p>
        </div>
        {result.partner ? (
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">Person 2 / Mt.</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatCHF(partnerMonthly)}
            </p>
          </div>
        ) : null}
        <div className="rounded-lg border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Haushalt gesamt / Mt.</p>
          <p className="text-xl font-semibold tabular-nums text-primary">
            {formatCHF(combinedMonthly)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Freies Vermögen am Horizont: {formatCHF(endCapital)}
          </p>
        </div>
      </div>
    </CollapsibleCard>
  );
}

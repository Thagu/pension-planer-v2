"use client";

import { LineChart } from "lucide-react";

import { CombinedWealthChart } from "@/components/household/combined-wealth-chart";
import { FreeAssetsGrowthChart } from "@/components/scenarios/free-assets-growth-chart";
import { LivePreviewCard } from "@/components/ui/live-preview-card";
import type {
  HouseholdPensionResult,
  ScenarioPensionResult,
} from "@/lib/engine";

type Props = {
  result: ScenarioPensionResult;
  householdResult: HouseholdPensionResult | null;
  effectiveRetirementAge: number;
  planningHorizonAge: number;
};

export function ScenarioWealthPreview({
  result,
  householdResult,
  effectiveRetirementAge,
  planningHorizonAge,
}: Props) {
  const showCombined =
    householdResult != null && householdResult.combinedProjection.length > 1;
  const showSingle =
    !showCombined &&
    result.freeAssets != null &&
    result.freeAssets.projection.length > 1;

  if (!showCombined && !showSingle) {
    return (
      <LivePreviewCard
        title="Vermögensentwicklung"
        description="Grafik erscheint, sobald freies Vermögen oder Sparquote erfasst sind."
        icon={<LineChart className="h-5 w-5 text-primary" />}
        className="border-dashed border-primary/15"
      >
        <p className="text-sm text-muted-foreground">
          Erfassen Sie in den Stammdaten freies Vermögen oder eine Sparquote.
        </p>
      </LivePreviewCard>
    );
  }

  return (
    <LivePreviewCard
      title="Vermögensentwicklung"
      description="Live-Vorschau — aktualisiert sich bei jeder Szenario-Änderung."
      icon={<LineChart className="h-5 w-5 text-primary" />}
      className="border-primary/20 bg-primary/[0.02]"
    >
      {showCombined ? (
        <CombinedWealthChart
          projection={householdResult!.combinedProjection}
          householdRetirementAge={householdResult!.householdRetirementAge}
          planningHorizonAge={planningHorizonAge}
          showSplit
        />
      ) : (
        <FreeAssetsGrowthChart
          projection={result.freeAssets!.projection}
          retirementAge={effectiveRetirementAge}
          planningHorizonAge={result.freeAssets!.planningHorizonAge}
          annualRetirementExpenses={result.freeAssets!.annualRetirementExpenses}
          annualFixedPensionIncome={result.freeAssets!.annualFixedPensionIncome}
          annualNetExpenseGap={result.freeAssets!.annualNetExpenseGap}
          endCapital={result.freeAssets!.projectedCapital}
          monthlyIncome={result.freeAssets!.monthlyIncome}
        />
      )}
    </LivePreviewCard>
  );
}

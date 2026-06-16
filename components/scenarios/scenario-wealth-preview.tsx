"use client";

import { LineChart } from "lucide-react";

import { FinancialIndependenceTimelineChart } from "@/components/master-data/financial-independence-timeline-chart";
import { LivePreviewCard } from "@/components/ui/live-preview-card";
import {
  combinedProjectionToFreeAssets,
  type FinancialIndependenceTimeline,
  type HouseholdPensionResult,
  type ScenarioPensionResult,
} from "@/lib/engine";

type Props = {
  result: ScenarioPensionResult;
  householdResult: HouseholdPensionResult | null;
  effectiveRetirementAge: number;
  planningHorizonAge: number;
  profileRetirementAge?: number;
};

function buildHouseholdTimeline(
  householdResult: HouseholdPensionResult,
): FinancialIndependenceTimeline | null {
  const projection = combinedProjectionToFreeAssets(
    householdResult.combinedProjection,
  );
  if (projection.length < 2) return null;

  const isCouple =
    householdResult.planningMode === "couple" && householdResult.partner != null;

  return {
    projection,
    employmentEndAge: householdResult.primary.summary.employmentEndAge,
    ahvPensionStartAge: householdResult.primary.summary.ahvPensionStartAge,
    bvgPensionStartAge: householdResult.primary.summary.bvgPensionStartAge,
    sustainable: true,
    householdMode: isCouple,
    partnerEmploymentEndAge: householdResult.partner?.summary.employmentEndAge,
    partnerAhvPensionStartAge:
      householdResult.partner?.summary.ahvPensionStartAge,
    partnerBvgPensionStartAge:
      householdResult.partner?.summary.bvgPensionStartAge,
    combinedDetail: isCouple ? householdResult.combinedProjection : undefined,
  };
}

function buildSingleTimeline(
  result: ScenarioPensionResult,
  effectiveRetirementAge: number,
): FinancialIndependenceTimeline | null {
  const projection = result.freeAssets?.projection;
  if (!projection || projection.length < 2) return null;

  return {
    projection,
    employmentEndAge: effectiveRetirementAge,
    ahvPensionStartAge: result.summary.ahvPensionStartAge,
    bvgPensionStartAge: result.summary.bvgPensionStartAge,
    sustainable: true,
  };
}

export function ScenarioWealthPreview({
  result,
  householdResult,
  effectiveRetirementAge,
  planningHorizonAge,
  profileRetirementAge,
}: Props) {
  const householdTimeline =
    householdResult != null ? buildHouseholdTimeline(householdResult) : null;
  const singleTimeline = buildSingleTimeline(result, effectiveRetirementAge);
  const timeline = householdTimeline ?? singleTimeline;

  if (!timeline) {
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
      <FinancialIndependenceTimelineChart
        timeline={timeline}
        profileRetirementAge={profileRetirementAge}
        planningHorizonAge={planningHorizonAge}
      />
    </LivePreviewCard>
  );
}

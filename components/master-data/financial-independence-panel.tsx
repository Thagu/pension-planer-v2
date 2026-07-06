"use client";

import { useMemo } from "react";
import { Target } from "lucide-react";

import { FinancialIndependenceTimelineChart } from "@/components/master-data/financial-independence-timeline-chart";
import { LivePreviewCard } from "@/components/ui/live-preview-card";
import {
  calculateFinancialIndependence,
  calculateHouseholdFinancialIndependence,
  formatCHF,
  type FinancialIndependenceResult,
} from "@/lib/engine";
import type { HouseholdProfileForScenario } from "@/lib/household/types";
import { personLabel } from "@/lib/household/person-colors";

export function FinancialIndependencePanel({
  household,
}: {
  household: HouseholdProfileForScenario | null;
}) {
  const primaryLabel = personLabel("primary", household?.primary?.firstName);
  const partnerLabel = personLabel("partner", household?.partner?.firstName);
  const result = useMemo((): FinancialIndependenceResult | null => {
    if (!household) return null;
    if (household.planningMode === "couple" && household.partner) {
      return calculateHouseholdFinancialIndependence(household);
    }
    return calculateFinancialIndependence(household.primary);
  }, [household]);

  const isCouple =
    household?.planningMode === "couple" && household.partner != null;

  if (!household) {
    return (
      <LivePreviewCard
        title="Finanzielle Unabhängigkeit"
        description="Bitte Geburtsdatum und Bruttojahreslohn erfassen — die Berechnung aktualisiert sich automatisch bei jeder Änderung."
        icon={<Target className="h-5 w-5 text-primary" />}
        className="border-dashed border-primary/20"
      >
        <p className="text-sm text-muted-foreground">
          Sobald die Pflichtfelder ausgefüllt sind, erscheint hier die Live-Vorschau.
        </p>
      </LivePreviewCard>
    );
  }

  return (
    <LivePreviewCard
      title={
        isCouple
          ? "Finanzielle Unabhängigkeit (Haushalt)"
          : "Finanzielle Unabhängigkeit"
      }
      description="Live-Vorschau — aktualisiert sich bei jeder Änderung, auch vor dem Speichern."
      icon={<Target className="h-5 w-5 text-primary" />}
      className="border-primary/20 bg-primary/[0.02]"
    >
      {!result ? (
        <p className="text-sm text-muted-foreground">Berechnung läuft…</p>
      ) : !result.ok ? (
        <div className="space-y-4">
          <div
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
            role="alert"
          >
            <p className="font-medium text-foreground">{result.reason}</p>
            {result.missingFields && result.missingFields.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                {result.missingFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            ) : null}
          </div>
          {result.timeline ? (
            <FinancialIndependenceTimelineChart
              timeline={result.timeline}
              profileRetirementAge={result.profileRetirementAge}
              planningHorizonAge={result.planningHorizonAge}
              primaryLabel={primaryLabel}
              partnerLabel={partnerLabel}
            />
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">
            {result.summaryText}
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <Metric
              label={isCouple ? `FI-Alter ${primaryLabel}` : "FI-Alter"}
              value={`${result.independenceAge} Jahre`}
              highlight
            />
            <Metric
              label="Noch bis dahin"
              value={
                result.yearsUntil === 0
                  ? "Jetzt"
                  : `${result.yearsUntil} Jahr${result.yearsUntil === 1 ? "" : "e"}`
              }
            />
            <Metric
              label={
                isCouple
                  ? `Geplante Pension ${primaryLabel}`
                  : "Geplante Pension"
              }
              value={`${result.profileRetirementAge} J.`}
              detail={
                result.yearsEarlierThanPlanned
                  ? `${result.yearsEarlierThanPlanned} J. früher`
                  : undefined
              }
            />
            <Metric
              label={
                isCouple
                  ? `Endvermögen Horizont ${primaryLabel} (${result.planningHorizonAge} J.)`
                  : `Endvermögen (${result.planningHorizonAge} J.)`
              }
              value={formatCHF(result.endCapitalAtHorizon)}
            />
            <Metric
              label="Tiefster Stand (Ruhestand)"
              value={formatCHF(result.minCapitalDuringRetirement)}
              detail="Puffer über 0 = tragfähig"
            />
          </div>

          <FinancialIndependenceTimelineChart
            timeline={result.timeline}
            profileRetirementAge={result.profileRetirementAge}
            planningHorizonAge={result.planningHorizonAge}
            independenceAge={result.independenceAge}
            primaryLabel={primaryLabel}
            partnerLabel={partnerLabel}
          />
        </div>
      )}
    </LivePreviewCard>
  );
}

function Metric({
  label,
  value,
  detail,
  highlight = false,
}: {
  label: string;
  value: string;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`font-mono tabular-nums ${highlight ? "text-base font-semibold text-primary" : "text-sm font-medium text-foreground"}`}
      >
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

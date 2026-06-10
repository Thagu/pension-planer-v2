"use client";

import { useEffect, useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatCHF,
  optimizeCapitalWithdrawal,
  type CapitalWithdrawalOptimizationResult,
  type ProfileForScenario,
  type ScenarioOverrides,
} from "@/lib/engine";

type CapitalWithdrawalOptimizerCardProps = {
  profile: ProfileForScenario;
  overrides: ScenarioOverrides;
  onApply: (result: CapitalWithdrawalOptimizationResult) => void;
};

export function CapitalWithdrawalOptimizerCard({
  profile,
  overrides,
  onApply,
}: CapitalWithdrawalOptimizerCardProps) {
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<CapitalWithdrawalOptimizationResult | null>(
    null,
  );

  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setResult(null);
    setApplied(false);
  }, [overrides]);

  const handleAnalyze = () => {
    setApplied(false);
    setComputing(true);
    window.setTimeout(() => {
      try {
        setResult(optimizeCapitalWithdrawal(profile, overrides));
      } finally {
        setComputing(false);
      }
    }, 0);
  };

  return (
    <div className="space-y-4">
        <Button
          type="button"
          variant="secondary"
          onClick={handleAnalyze}
          disabled={computing}
          className="gap-2"
        >
          {computing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Lightbulb className="h-4 w-4" />
          )}
          Optimiervorschlag berechnen
        </Button>

        {result ? (
          <div className="space-y-3 rounded-md border bg-muted/30 p-4 text-sm">
            <p className="text-foreground">{result.summaryText}</p>

            {result.hasImprovement ? (
              <>
                <div className="grid gap-2 rounded-md border bg-background p-3 text-xs sm:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground">Steuern heute</p>
                    <p className="font-mono tabular-nums text-foreground">
                      {formatCHF(result.baselineTotalTax)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mit Vorschlag</p>
                    <p className="font-mono tabular-nums text-foreground">
                      {formatCHF(result.suggestedTotalTax)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ersparnis</p>
                    <p className="font-mono tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCHF(result.taxSavings)}
                    </p>
                  </div>
                </div>

                {result.explanation.length > 0 ? (
                  <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
                    {result.explanation.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}

                <Button
                  type="button"
                  onClick={() => {
                    onApply(result);
                    setApplied(true);
                  }}
                  className="gap-2"
                  disabled={applied}
                >
                  {applied ? "Vorschlag übernommen" : "Vorschlag übernehmen"}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Schätzung auf Basis der Szenario-Eingaben und Steuer-Referenz aus den
          Stammdaten. Nach Anpassungen erneut berechnen.
        </p>
    </div>
  );
}

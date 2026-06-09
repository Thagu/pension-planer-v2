"use client";

import { Label } from "@/components/ui/label";
import { NUM_STEP } from "@/components/shared/numeric-steps";
import { NumberStepperInput } from "@/components/shared/stepper-inputs";
import type { WorkloadReduction } from "@/lib/engine/workload";
import { MAX_WORKLOAD_REDUCTIONS } from "@/lib/engine/workload";

function emptyReductions(): WorkloadReduction[] {
  return Array.from({ length: MAX_WORKLOAD_REDUCTIONS }, () => ({
    fromAge: 0,
    workloadPercent: 0,
  }));
}

function toEditableRows(reductions: WorkloadReduction[] | undefined): WorkloadReduction[] {
  const rows = emptyReductions();
  for (let i = 0; i < MAX_WORKLOAD_REDUCTIONS; i++) {
    if (reductions?.[i]) {
      rows[i] = { ...reductions[i] };
    }
  }
  return rows;
}

export function WorkloadReductionFields({
  idPrefix,
  reductions,
  onChange,
  namePrefix = "workloadReduction",
}: {
  idPrefix: string;
  reductions: WorkloadReduction[];
  onChange: (next: WorkloadReduction[]) => void;
  /** Form field prefix for master data submit */
  namePrefix?: string;
}) {
  const rows = toEditableRows(reductions);

  const updateRow = (index: number, patch: Partial<WorkloadReduction>) => {
    const next = toEditableRows(reductions);
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const parseOptionalInt = (raw: string): number => {
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    const parsed = parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div
          key={`${idPrefix}-workload-${index}`}
          className="grid gap-3 rounded-md border bg-muted/10 p-3 sm:grid-cols-2"
        >
          <p className="text-sm font-medium text-foreground sm:col-span-2">
            Reduktion {index + 1}
          </p>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-from-age-${index}`}>Ab Alter (Jahre)</Label>
            <NumberStepperInput
              id={`${idPrefix}-from-age-${index}`}
              name={`${namePrefix}${index + 1}FromAge`}
              value={row.fromAge > 0 ? String(row.fromAge) : ""}
              onChange={(e) =>
                updateRow(index, {
                  fromAge: parseOptionalInt(e.target.value),
                })
              }
              step={NUM_STEP.age}
              min={18}
              max={70}
              placeholder="z. B. 58"
              ariaLabel="Ab Alter"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-percent-${index}`}>Arbeitspensum (%)</Label>
            <NumberStepperInput
              id={`${idPrefix}-percent-${index}`}
              name={`${namePrefix}${index + 1}Percent`}
              value={row.workloadPercent > 0 ? String(row.workloadPercent) : ""}
              onChange={(e) =>
                updateRow(index, {
                  workloadPercent: parseOptionalInt(e.target.value),
                })
              }
              step={NUM_STEP.workload}
              min={0}
              max={100}
              placeholder="z. B. 80"
              ariaLabel="Arbeitspensum"
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Vor der ersten Reduktion gilt 100&nbsp;%. BVG- und 3a-Beiträge sinken
        proportional zum Pensum. Die Sparquote ins freie Vermögen sinkt stärker:
        um den Betrag, den das Bruttoeinkommen gegenüber Vollzeit einbusst.
        Leer lassen = keine Reduktion.
      </p>
    </div>
  );
}

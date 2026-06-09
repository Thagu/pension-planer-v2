"use client";

import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatSwissNumber } from "@/lib/format/numbers";
import {
  TAX_MARITAL_STATUS_LABELS,
  TAX_REFERENCE_INCOME_LEVELS,
  type TaxMaritalStatus,
} from "@/lib/tax/types";

export type FederalBracketFormRow = {
  maritalStatus: TaxMaritalStatus;
  taxAmounts: Record<string, number | "">;
  sourceNotes: string;
  updatedAt?: string | null;
  fromDb: boolean;
};

type FederalBracketEditorProps = {
  rows: FederalBracketFormRow[];
};

export function FederalBracketEditor({ rows }: FederalBracketEditorProps) {
  const levelsLabel = useMemo(
    () =>
      TAX_REFERENCE_INCOME_LEVELS.map((l) =>
        l >= 1_000_000 ? "1'000'000" : l.toLocaleString("de-CH"),
      ),
    [],
  );

  return (
    <div className="space-y-8">
      {rows.map((row) => (
        <section key={row.maritalStatus} className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {TAX_MARITAL_STATUS_LABELS[row.maritalStatus]}
            </h2>
            <p className="text-xs text-muted-foreground">
              {row.fromDb
                ? `Gespeichert${row.updatedAt ? ` · ${new Date(row.updatedAt).toLocaleDateString("de-CH")}` : ""}`
                : "Noch nicht gespeichert – Vorschlagswerte (ESTV-Fallback)"}
            </p>
          </div>

          <input type="hidden" name={`maritalStatus_${row.maritalStatus}`} value={row.maritalStatus} />

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2 font-medium">Zusatzeinkommen (CHF)</th>
                  {levelsLabel.map((label) => (
                    <th key={label} className="px-3 py-2 font-medium tabular-nums">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Steuer Bund (CHF)</td>
                  {TAX_REFERENCE_INCOME_LEVELS.map((level) => {
                    const key = String(level);
                    const value = row.taxAmounts[key];
                    return (
                      <td key={key} className="px-2 py-2">
                        <Input
                          name={`tax_${row.maritalStatus}_${key}`}
                          defaultValue={
                            value === "" || value == null
                              ? ""
                              : formatSwissNumber(Number(value))
                          }
                          inputMode="decimal"
                          className="h-9 font-mono tabular-nums"
                          placeholder="0"
                        />
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`sourceNotes_${row.maritalStatus}`}>Quelle / Notizen</Label>
            <Input
              id={`sourceNotes_${row.maritalStatus}`}
              name={`sourceNotes_${row.maritalStatus}`}
              defaultValue={row.sourceNotes}
              placeholder="z. B. ESTV Form. 58c 2025, Art. 38 DBG"
            />
          </div>
        </section>
      ))}
    </div>
  );
}

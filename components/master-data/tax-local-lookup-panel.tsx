"use client";

import { useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";

import {
  lookupAndSaveLocalTaxReference,
  type LocalTaxReferenceStatus,
} from "@/app/master-data/tax-lookup-actions";
import { Button } from "@/components/ui/button";
import {
  TAX_MARITAL_STATUS_LABELS,
  TAX_REFERENCE_INCOME_LEVELS,
  type TaxMaritalStatus,
} from "@/lib/tax/types";
import { formatSwissNumber } from "@/lib/format/numbers";

type TaxLocalLookupPanelProps = {
  initialStatus: LocalTaxReferenceStatus | null;
};

export function TaxLocalLookupPanel({ initialStatus }: TaxLocalLookupPanelProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAmounts, setLastAmounts] = useState<Record<string, number> | null>(
    null,
  );
  const [status, setStatus] = useState(initialStatus);

  const readFormValues = () => {
    const cantonCode =
      (document.getElementById("taxCanton") as HTMLSelectElement | null)?.value ??
      "";
    const postalCode =
      (document.getElementById("taxPostalCode") as HTMLInputElement | null)?.value ??
      "";
    const municipality =
      (document.getElementById("taxMunicipality") as
        | HTMLInputElement
        | HTMLSelectElement
        | null)?.value ?? "";
    const maritalStatus =
      (document.getElementById("maritalStatus") as HTMLSelectElement | null)
        ?.value ?? "single";
    return { cantonCode, postalCode, municipality, maritalStatus };
  };

  const handleLookup = () => {
    setMessage(null);
    setError(null);
    setLastAmounts(null);

    const values = readFormValues();
    if (!values.postalCode.trim() || values.postalCode.replace(/\D/g, "").length !== 4) {
      setError("Bitte eine gültige 4-stellige PLZ eingeben.");
      return;
    }
    if (!values.municipality.trim()) {
      setError("Bitte zuerst PLZ und Kanton eingeben — Gemeinde wird daraus abgeleitet.");
      return;
    }

    startTransition(async () => {
      const result = await lookupAndSaveLocalTaxReference(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setLastAmounts(result.taxAmounts);
      setStatus({
        exists: true,
        updatedAt: new Date().toISOString(),
        sourceNotes: result.sourceNotes,
        maritalStatus: values.maritalStatus as TaxMaritalStatus,
        cantonCode: values.cantonCode.toUpperCase(),
        municipality: values.municipality.trim(),
      });

      const statusLabel =
        TAX_MARITAL_STATUS_LABELS[values.maritalStatus as TaxMaritalStatus];
      setMessage(
        result.replacedExisting
          ? `Bestehende Referenz für ${values.municipality} (${statusLabel}) aktualisiert. Confidence: ${result.confidence}.`
          : `Neue globale Referenz für ${values.municipality} (${statusLabel}) gespeichert. Confidence: ${result.confidence}.`,
      );
    });
  };

  return (
    <div className="md:col-span-2 space-y-3 rounded-md border bg-background p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Lokale Steuer-Referenz (ESTV)</h3>
        <p className="text-xs text-muted-foreground">
          Liest die Kanton+Gemeinde-Kapitalsteuer für 5 Stützpunkte aus dem
          offiziellen ESTV-Steuerrechner und speichert sie global für alle Nutzer.
        </p>
      </div>

      {status?.exists ? (
        <p className="text-xs text-muted-foreground">
          Bereits vorhanden
          {status.updatedAt
            ? ` · ${new Date(status.updatedAt).toLocaleDateString("de-CH")}`
            : ""}
          {status.sourceNotes ? ` · ${status.sourceNotes.slice(0, 120)}…` : ""}
        </p>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Für diese Gemeinde/Zivilstand liegt noch keine globale Referenz vor —
          es wird ein Kantons-Fallback verwendet.
        </p>
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={handleLookup}
        disabled={pending}
        className="gap-2"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        Steuerdaten aus Netz ziehen
      </Button>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}

      {lastAmounts ? (
        <div className="overflow-x-auto rounded border text-xs">
          <table className="w-full min-w-[420px]">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-2 py-1.5">Bezug (CHF)</th>
                <th className="px-2 py-1.5">Steuer Kanton+Gemeinde</th>
              </tr>
            </thead>
            <tbody>
              {TAX_REFERENCE_INCOME_LEVELS.map((level) => (
                <tr key={level} className="border-b last:border-0">
                  <td className="px-2 py-1.5 tabular-nums">
                    {formatSwissNumber(level)}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {formatSwissNumber(lastAmounts[String(level)] ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

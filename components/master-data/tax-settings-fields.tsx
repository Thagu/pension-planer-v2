"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { LocalTaxReferenceStatus } from "@/app/master-data/tax-lookup-actions";
import { TaxLocalLookupPanel } from "@/components/master-data/tax-local-lookup-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_TAX_CANTON_CODE,
  getCantonsSortedByName,
} from "@/lib/tax/canton-reference";
import {
  TAX_MARITAL_STATUS_LABELS,
  type TaxMaritalStatus,
} from "@/lib/tax/types";
import {
  resolveMunicipalityFromPostalCode,
  sortLocalitiesByName,
  validatePostalCodeForCanton,
} from "@/lib/swiss/postal-codes";

type TaxProfileFields = {
  marital_status?: string | null;
  tax_canton?: string | null;
  tax_postal_code?: string | null;
  tax_municipality?: string | null;
};

export function TaxSettingsFields({
  profile,
  localTaxStatus,
}: {
  profile: TaxProfileFields | null;
  localTaxStatus?: LocalTaxReferenceStatus | null;
}) {
  const cantons = useMemo(() => getCantonsSortedByName(), []);
  const [cantonCode, setCantonCode] = useState(
    profile?.tax_canton ?? DEFAULT_TAX_CANTON_CODE,
  );
  const [postalCode, setPostalCode] = useState(profile?.tax_postal_code ?? "");
  const [municipality, setMunicipality] = useState(
    profile?.tax_municipality ?? "",
  );
  const [plzError, setPlzError] = useState<string | null>(null);

  const reference = cantons.find((c) => c.code === cantonCode);

  const localitiesForPlz = useMemo(() => {
    if (postalCode.trim().length !== 4) return [];
    const validation = validatePostalCodeForCanton(postalCode, cantonCode);
    if (!validation.ok) return [];
    return sortLocalitiesByName(validation.localities);
  }, [postalCode, cantonCode]);

  const showLocalitySelect = localitiesForPlz.length > 1;

  const maritalStatus = (profile?.marital_status ?? "single") as TaxMaritalStatus;

  const syncFromPostalCode = (
    nextPlz: string,
    nextCanton: string,
    municipalityHint?: string,
  ) => {
    if (!nextPlz.trim()) {
      setPlzError(null);
      setMunicipality("");
      return;
    }

    const resolved = resolveMunicipalityFromPostalCode(
      nextPlz,
      nextCanton,
      municipalityHint,
    );
    if (!resolved.ok) {
      setPlzError(resolved.error);
      if (!municipalityHint) setMunicipality("");
      return;
    }

    setPlzError(null);
    if (resolved.municipality) {
      setMunicipality(resolved.municipality);
    }
  };

  useEffect(() => {
    if (postalCode.length === 4) {
      syncFromPostalCode(
        postalCode,
        cantonCode,
        (profile?.tax_municipality ?? municipality) || undefined,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePostalCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setPostalCode(digits);
    if (digits.length === 4) {
      syncFromPostalCode(digits, cantonCode, showLocalitySelect ? municipality : undefined);
    } else {
      setPlzError(null);
      setMunicipality("");
    }
  };

  const handleCantonChange = (nextCanton: string) => {
    setCantonCode(nextCanton);
    if (postalCode.length === 4) {
      syncFromPostalCode(postalCode, nextCanton, showLocalitySelect ? municipality : undefined);
    }
  };

  const handleLocalityChange = (name: string) => {
    setMunicipality(name);
    syncFromPostalCode(postalCode, cantonCode, name);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="maritalStatus">Zivilstand</Label>
        <select
          id="maritalStatus"
          name="maritalStatus"
          defaultValue={maritalStatus}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {(Object.entries(TAX_MARITAL_STATUS_LABELS) as [TaxMaritalStatus, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
        <p className="text-xs text-muted-foreground">
          Steuertarif für Kapitalbezüge und Renten (ohne Lohn).
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="taxCanton">Kanton</Label>
        <select
          id="taxCanton"
          name="taxCanton"
          value={cantonCode}
          onChange={(e) => handleCantonChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {cantons.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="taxPostalCode">Postleitzahl</Label>
        <Input
          id="taxPostalCode"
          name="taxPostalCode"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={postalCode}
          onChange={(e) => handlePostalCodeChange(e.target.value)}
          placeholder="z. B. 6340"
          aria-invalid={plzError ? true : undefined}
        />
        {plzError ? (
          <p className="text-xs text-destructive" role="alert">
            {plzError}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Die Gemeinde wird aus PLZ und Kanton abgeleitet.
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="taxMunicipality">Gemeinde</Label>
        {showLocalitySelect ? (
          <select
            id="taxMunicipality"
            name="taxMunicipality"
            value={municipality}
            onChange={(e) => handleLocalityChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            <option value="">Ortschaft wählen…</option>
            {localitiesForPlz.map((loc) => (
              <option key={loc.name} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <Input
              id="taxMunicipality"
              name="taxMunicipality"
              value={municipality}
              readOnly
              placeholder={
                postalCode.length === 4 && !plzError
                  ? "Wird ermittelt…"
                  : reference?.defaultMunicipality ?? "Zürich"
              }
              className="bg-muted/40"
            />
            <p className="text-xs text-muted-foreground">
              Automatisch aus PLZ abgeleitet (nur lesbar).
            </p>
          </>
        )}
      </div>

      <div className="md:col-span-2 rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
        <p>
          Steuerbeträge stammen aus globalen Referenztabellen (5 Stützpunkte:
          50k–1M CHF) für Bund sowie Kanton+Gemeinde. Fehlen Gemeindedaten,
          wird ein Kantons-Fallback verwendet.
        </p>
        <p className="mt-2">
          <Link
            href="/tax-reference/federal"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Bundessteuer-Referenz pflegen
          </Link>
        </p>
      </div>

      <TaxLocalLookupPanel initialStatus={localTaxStatus ?? null} />
    </div>
  );
}

"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { lookupLocalTaxFromEstv } from "@/lib/tax/estv/local-tax-lookup";
import { loadTaxLocalReference } from "@/lib/tax/load-tax-reference";
import { upsertLocalTaxReference } from "@/lib/tax/upsert-local-reference";
import {
  normalizeMaritalStatus,
  type TaxMaritalStatus,
} from "@/lib/tax/types";

export type LocalTaxLookupActionResult =
  | {
      ok: true;
      replacedExisting: boolean;
      confidence: "high" | "medium" | "low";
      sourceNotes: string;
      sources: string[];
      taxAmounts: Record<string, number>;
    }
  | { ok: false; error: string };

export async function lookupAndSaveLocalTaxReference(input: {
  cantonCode: string;
  municipality: string;
  postalCode?: string | null;
  maritalStatus: string;
}): Promise<LocalTaxLookupActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Nicht angemeldet" };
  }

  const cantonCode = input.cantonCode.trim().toUpperCase();
  const municipality = input.municipality.trim();
  const maritalStatus = normalizeMaritalStatus(
    input.maritalStatus,
  ) as TaxMaritalStatus;

  if (!cantonCode || cantonCode.length !== 2) {
    return { ok: false, error: "Ungültiger Kanton" };
  }
  if (!municipality) {
    return { ok: false, error: "Bitte Gemeinde angeben" };
  }

  const existing = await loadTaxLocalReference(
    supabase,
    cantonCode,
    municipality,
    maritalStatus,
  );

  try {
    const lookup = await lookupLocalTaxFromEstv({
      cantonCode,
      municipality,
      postalCode: input.postalCode,
      maritalStatus,
    });

    const sourceNotes = [
      lookup.sourceNotes,
      lookup.sources.length > 0 ? `Quelle: ${lookup.sources.join(", ")}` : null,
      `ESTV TaxLocationID: ${lookup.taxLocationId}`,
    ]
      .filter(Boolean)
      .join(" · ");

    const saveResult = await upsertLocalTaxReference(supabase, {
      cantonCode,
      municipality,
      maritalStatus,
      taxAmounts: lookup.taxAmounts,
      sourceNotes,
      contributedBy: user.id,
      defaultSteuerfuss: lookup.steuerfuss,
    });

    if (!saveResult.ok) {
      return { ok: false, error: saveResult.message };
    }

    revalidatePath("/master-data");
    revalidatePath("/scenarios");
    revalidatePath("/scenarios/new");

    return {
      ok: true,
      replacedExisting: Boolean(existing),
      confidence: lookup.confidence,
      sourceNotes,
      sources: lookup.sources,
      taxAmounts: lookup.taxAmounts,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ESTV-Abfrage fehlgeschlagen";
    console.error("[lookupAndSaveLocalTaxReference]", message);
    return { ok: false, error: message };
  }
}

export type LocalTaxReferenceStatus = {
  exists: boolean;
  updatedAt?: string | null;
  sourceNotes?: string | null;
  maritalStatus: TaxMaritalStatus;
  cantonCode: string;
  municipality: string;
};

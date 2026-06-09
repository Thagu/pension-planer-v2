"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { parseSwissNumber } from "@/lib/format/numbers";
import { buildDefaultFederalTaxAmounts } from "@/lib/tax/default-brackets";
import {
  TAX_REFERENCE_INCOME_LEVELS,
  type TaxMaritalStatus,
} from "@/lib/tax/types";

const MARITAL_STATUSES: TaxMaritalStatus[] = ["single", "married"];

function parseTaxAmountsFromForm(
  formData: FormData,
  maritalStatus: TaxMaritalStatus,
): Record<string, number> {
  const amounts: Record<string, number> = {};
  for (const level of TAX_REFERENCE_INCOME_LEVELS) {
    const key = String(level);
    const raw = formData.get(`tax_${maritalStatus}_${key}`);
    const parsed =
      typeof raw === "string" && raw.trim()
        ? parseSwissNumber(raw)
        : buildDefaultFederalTaxAmounts(maritalStatus)[key] ?? 0;
    amounts[key] = Math.round(Math.max(0, parsed));
  }
  return amounts;
}

export async function saveFederalTaxReference(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  for (const maritalStatus of MARITAL_STATUSES) {
    const taxAmounts = parseTaxAmountsFromForm(formData, maritalStatus);
    const sourceRaw = formData.get(`sourceNotes_${maritalStatus}`);
    const sourceNotes =
      typeof sourceRaw === "string" && sourceRaw.trim() ? sourceRaw.trim() : null;

    const { error } = await supabase.from("tax_federal_reference").upsert(
      {
        marital_status: maritalStatus,
        tax_amounts: taxAmounts,
        source_notes: sourceNotes,
        updated_by: user.id,
      },
      { onConflict: "marital_status" },
    );

    if (error) {
      console.error("[saveFederalTaxReference]", maritalStatus, error.message);
      redirect(
        `/tax-reference/federal?error=${encodeURIComponent("save_failed")}`,
      );
    }
  }

  revalidatePath("/tax-reference/federal");
  revalidatePath("/master-data");
  revalidatePath("/scenarios");
  redirect("/tax-reference/federal?saved=1");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ensureProfileExtensionColumns } from "@/lib/db/ensure-profile-columns";
import {
  buildExtensionsPayload,
  isMissingProfileColumnError,
  metadataPatchForExtensions,
} from "@/lib/profile/extensions";
import { resolveMunicipalityFromPostalCode } from "@/lib/swiss/postal-codes";
import {
  metadataPatchForPillar3aAccounts,
  pillar3aAccountsToMetadata,
  type Pillar3aAccountMeta,
} from "@/lib/pillar3a/metadata";
import { persistedPillar3aAccountIdOrNull } from "@/lib/pillar3a/accounts";
import { createClient } from "@/lib/supabase/server";
import { parseDbAmount } from "@/lib/format/db-numbers";
import { parsePercentToDecimal, parseSwissNumber } from "@/lib/format/numbers";
import {
  partnerProfileFromForm,
  parsePlanningMode,
} from "@/lib/household/partner-profile";

function toYearOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBvgContributionRates(
  raw: FormDataEntryValue | null,
): Record<string, number> | null {
  if (typeof raw !== "string" || !raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    const converted: Record<string, number> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val !== "number" || !Number.isFinite(val)) continue;
      converted[key] = val > 1 || val < -1 ? val / 100 : val;
    }
    return Object.keys(converted).length > 0 ? converted : null;
  } catch {
    return null;
  }
}

function parsePillar3aAccountsJson(
  raw: FormDataEntryValue | null,
): Array<{
  id: string | null;
  name: string;
  provider: string | null;
  currentValue: number;
  annualContribution: number;
  returnRatePercent: number | null;
  sortOrder: number;
}> {
  if (typeof raw !== "string" || !raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    return parsed
      .map((item, index) => ({
        id: persistedPillar3aAccountIdOrNull(
          typeof item.id === "string" ? item.id : null,
        ),
        name:
          typeof item.name === "string" && item.name.trim()
            ? item.name.trim()
            : `3a-Konto ${index + 1}`,
        provider:
          typeof item.provider === "string" && item.provider.trim()
            ? item.provider.trim()
            : null,
        currentValue: parseDbAmount(item.currentValue),
        annualContribution: parseDbAmount(item.annualContribution),
        returnRatePercent:
          item.returnRatePercent != null && item.returnRatePercent !== ""
            ? Number(item.returnRatePercent)
            : null,
        sortOrder: Number(item.sortOrder) || index,
      }));
  } catch {
    return [];
  }
}

async function syncPillar3aAccounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  accounts: ReturnType<typeof parsePillar3aAccountsJson>,
  person: "primary" | "partner" = "primary",
): Promise<Pillar3aAccountMeta[]> {
  const totalCapital = accounts.reduce((sum, a) => sum + a.currentValue, 0);
  const saved: Pillar3aAccountMeta[] = [];

  const { data: existing, error: loadError } = await supabase
    .from("pillar3a_accounts")
    .select("id, person")
    .eq("user_id", userId);

  if (loadError) {
    if (/pillar3a_accounts|does not exist/i.test(loadError.message)) {
      if (person === "primary") {
        await supabase
          .from("profiles")
          .update({ pillar3a_current_capital: totalCapital })
          .eq("id", userId);
      }
      return pillar3aAccountsToMetadata(accounts);
    }
    throw loadError;
  }

  const existingForPerson = (existing ?? []).filter(
    (row) => ((row as { person?: string }).person ?? "primary") === person,
  );

  const keepIds = new Set(
    accounts
      .map((a) => persistedPillar3aAccountIdOrNull(a.id))
      .filter((id): id is string => id != null),
  );

  const toDelete = existingForPerson
    .map((row) => row.id as string)
    .filter((id) => !keepIds.has(id));

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("pillar3a_accounts")
      .delete()
      .in("id", toDelete)
      .eq("user_id", userId);
    if (deleteError) throw deleteError;
  }

  for (const account of accounts) {
    const payload = {
      user_id: userId,
      name: account.name,
      provider: account.provider,
      current_value: account.currentValue,
      annual_contribution: account.annualContribution,
      return_rate:
        account.returnRatePercent != null
          ? account.returnRatePercent / 100
          : null,
      withdrawal_year_offset: 0,
      sort_order: account.sortOrder,
      person,
    };

    const dbId = persistedPillar3aAccountIdOrNull(account.id);

    if (dbId) {
      const { error: updateError } = await supabase
        .from("pillar3a_accounts")
        .update(payload)
        .eq("id", dbId)
        .eq("user_id", userId);
      if (updateError) throw updateError;
      saved.push({
        id: dbId,
        name: account.name,
        provider: account.provider,
        currentValue: account.currentValue,
        annualContribution: account.annualContribution,
        returnRate: payload.return_rate,
        sortOrder: account.sortOrder,
      });
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("pillar3a_accounts")
        .insert(payload)
        .select("id")
        .single();
      if (insertError || !inserted) throw insertError ?? new Error("3a insert failed");
      saved.push({
        id: inserted.id as string,
        name: account.name,
        provider: account.provider,
        currentValue: account.currentValue,
        annualContribution: account.annualContribution,
        returnRate: payload.return_rate,
        sortOrder: account.sortOrder,
      });
    }
  }

  if (person === "primary") {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ pillar3a_current_capital: totalCapital })
      .eq("id", userId);
    if (profileError) throw profileError;
  }

  return saved;
}

export async function saveMasterData(formData: FormData) {
  await ensureProfileExtensionColumns();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const birthDateRaw = formData.get("birthDate");
  const genderRaw = formData.get("gender");

  const basePayload = {
    id: user.id,
    birth_date:
      typeof birthDateRaw === "string" && birthDateRaw.trim()
        ? birthDateRaw
        : null,
    gender:
      typeof genderRaw === "string" && genderRaw.trim() ? genderRaw : null,
    employment_start_year: toYearOrNull(formData.get("employmentStartYear")),
    retirement_age: toYearOrNull(formData.get("retirementAge")) ?? 65,
    current_salary_brutto: parseSwissNumber(
      (formData.get("currentSalaryBrutto") as string) ?? "",
    ),
    bvg_current_capital: parseSwissNumber(
      (formData.get("bvgCurrentCapital") as string) ?? "",
    ),
    free_assets: parseSwissNumber((formData.get("freeAssets") as string) ?? ""),
    bvg_interest_rate: parsePercentToDecimal(
      (formData.get("bvgInterestRate") as string) ?? "",
    ),
    bvg_conversion_rate: parsePercentToDecimal(
      (formData.get("bvgConversionRate") as string) ?? "",
    ),
    bvg_contribution_rates: parseBvgContributionRates(
      formData.get("bvgContributionRates"),
    ),
    pillar3a_interest_rate: parsePercentToDecimal(
      (formData.get("pillar3aInterestRate") as string) ?? "",
    ),
    free_assets_interest_rate: parsePercentToDecimal(
      (formData.get("freeAssetsInterestRate") as string) ?? "",
    ),
  };

  const extensions = buildExtensionsPayload(formData);

  if (extensions.tax_postal_code || extensions.tax_canton || extensions.tax_municipality) {
    if (!extensions.tax_postal_code || !extensions.tax_canton) {
      redirect(
        `/master-data?error=${encodeURIComponent("tax_postal_code_required")}`,
      );
    }
    const resolved = resolveMunicipalityFromPostalCode(
      extensions.tax_postal_code,
      extensions.tax_canton,
      extensions.tax_municipality,
    );
    if (!resolved.ok || !resolved.municipality) {
      redirect(
        `/master-data?error=${encodeURIComponent("tax_postal_code_invalid")}&detail=${encodeURIComponent(resolved.ok ? "Gemeinde fehlt" : resolved.error)}`,
      );
    }
    extensions.tax_municipality = resolved.municipality;
  }

  const planningMode = parsePlanningMode(formData.get("planningMode"));
  const partnerProfile =
    planningMode === "couple" ? partnerProfileFromForm(formData) : null;

  const extendedPayload = {
    bvg_coordinated_salary_override: extensions.bvg_coordinated_salary_override,
    annual_savings_to_free_assets: extensions.annual_savings_to_free_assets,
    planning_horizon_age: extensions.planning_horizon_age,
    annual_retirement_expenses: extensions.annual_retirement_expenses,
    annual_survivor_expenses: extensions.annual_survivor_expenses,
    pillar3a_auto_split_enabled: extensions.pillar3a_auto_split_enabled,
    pillar3a_auto_split_threshold: extensions.pillar3a_auto_split_threshold,
    pillar3a_auto_split_contribution_mode:
      extensions.pillar3a_auto_split_contribution_mode,
    pillar3a_auto_split_name_prefix: extensions.pillar3a_auto_split_name_prefix,
    marital_status: extensions.marital_status,
    tax_canton: extensions.tax_canton,
    tax_postal_code: extensions.tax_postal_code,
    tax_municipality: extensions.tax_municipality,
    tax_municipality_steuerfuss: extensions.tax_municipality_steuerfuss,
    workload_reductions: extensions.workload_reductions,
    planning_mode: planningMode,
    partner_profile: partnerProfile,
    inflation_rate: extensions.inflation_rate,
  };

  let { error } = await supabase
    .from("profiles")
    .upsert({ ...basePayload, ...extendedPayload }, { onConflict: "id" });

  if (error && isMissingProfileColumnError(error.message)) {
    const retry = await supabase
      .from("profiles")
      .upsert(basePayload, { onConflict: "id" });
    error = retry.error;
  }

  if (error) {
    console.error("[saveMasterData]", error.message);
    redirect(`/master-data?error=${encodeURIComponent("save_failed")}`);
  }

  let savedPillar3a: Pillar3aAccountMeta[] = [];
  try {
    const pillar3aAccounts = parsePillar3aAccountsJson(
      formData.get("pillar3aAccountsJson"),
    );
    savedPillar3a = await syncPillar3aAccounts(
      supabase,
      user.id,
      pillar3aAccounts,
      "primary",
    );

    if (planningMode === "couple") {
      const partnerPillar3a = parsePillar3aAccountsJson(
        formData.get("pillar3aPartnerAccountsJson"),
      );
      await syncPillar3aAccounts(
        supabase,
        user.id,
        partnerPillar3a,
        "partner",
      );
    }
  } catch (syncError) {
    console.error("[saveMasterData] pillar3a", syncError);
    redirect(`/master-data?error=${encodeURIComponent("save_failed")}`);
  }

  // Metadata-Sync als Backup (primär: profiles + pillar3a_accounts Tabellen)
  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      ...metadataPatchForExtensions(extensions),
      ...metadataPatchForPillar3aAccounts(savedPillar3a),
    },
  });

  if (metaError) {
    console.error("[saveMasterData] metadata", metaError.message);
  }

  revalidatePath("/master-data");
  revalidatePath("/scenarios");
  revalidatePath("/scenarios/new");
  redirect("/master-data?saved=1");
}

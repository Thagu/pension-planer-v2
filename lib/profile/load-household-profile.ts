import type { SupabaseClient } from "@supabase/supabase-js";

import type { HouseholdProfileForScenario } from "@/lib/household/types";
import {
  partnerDataToProfileForScenario,
  parsePartnerProfileData,
  parsePlanningMode,
} from "@/lib/household/partner-profile";
import { loadPillar3aAccounts } from "@/lib/pillar3a/load-accounts";
import { mergeProfileWithExtensions } from "@/lib/profile/extensions";
import {
  profileRowToScenarioInput,
  type ProfileRow,
} from "@/lib/scenarios/profile";
import type { ProfileForScenario } from "@/lib/engine";
import { loadResolvedTaxReferences } from "@/lib/tax/load-tax-reference";
import { taxSettingsFromProfile } from "@/lib/tax/profile-tax";

export async function loadHouseholdProfileForScenario(
  supabase: SupabaseClient,
  userId: string,
): Promise<HouseholdProfileForScenario | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const merged = mergeProfileWithExtensions(profile, (
    await supabase.auth.getUser()
  ).data.user);

  if (!merged) return null;

  const row = merged as ProfileRow & {
    planning_mode?: string | null;
    partner_profile?: unknown;
  };

  const allPillar3a = await loadPillar3aAccounts(
    supabase,
    userId,
    row.pillar3a_current_capital,
  );

  const primaryPillar3a = allPillar3a.filter(
    (a) => (a as { person?: string }).person !== "partner",
  );
  const partnerPillar3a = allPillar3a.filter(
    (a) => (a as { person?: string }).person === "partner",
  );

  const resolvedTax = await loadResolvedTaxReferences(supabase, {
    maritalStatus: row.marital_status,
    cantonCode: row.tax_canton,
    municipality: row.tax_municipality,
    municipalitySteuerfuss: row.tax_municipality_steuerfuss,
  });

  const primaryInput = profileRowToScenarioInput(row, primaryPillar3a);
  if (!primaryInput) return null;

  const primary: ProfileForScenario = {
    ...primaryInput,
    taxSettings: taxSettingsFromProfile(row, resolvedTax),
  };

  const planningMode = parsePlanningMode(row.planning_mode);
  const partnerData = parsePartnerProfileData(row.partner_profile);
  const partner =
    planningMode === "couple"
      ? partnerDataToProfileForScenario(partnerData, partnerPillar3a, {
          planningHorizonAge: primary.planningHorizonAge,
          annualRetirementExpenses: 0,
          taxSettings: primary.taxSettings,
          pillar3aDefaultReturnRate: primary.pillar3aDefaultReturnRate ?? null,
          pillar3aAutoSplit: primary.pillar3aAutoSplit,
          inflationRate: primary.inflationRate,
          freeAssetsReturnRate: primary.freeAssetsInterestRate ?? null,
        })
      : null;

  return {
    planningMode,
    primary,
    partner,
    partnerEmploymentEndOffsetYears:
      partnerData?.employment_end_offset_years ?? 0,
  };
}

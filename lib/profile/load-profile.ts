import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";

import { loadPillar3aAccounts } from "@/lib/pillar3a/load-accounts";
import { mergeProfileWithExtensions } from "@/lib/profile/extensions";
import {
  profileRowToScenarioInput,
  type ProfileRow,
} from "@/lib/scenarios/profile";
import type { ProfileForScenario } from "@/lib/engine";
import { loadResolvedTaxReferences } from "@/lib/tax/load-tax-reference";
import { taxSettingsFromProfile } from "@/lib/tax/profile-tax";

export async function loadUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRow | null> {
  noStore();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  return mergeProfileWithExtensions(profile, user);
}

export async function loadProfileForScenario(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileForScenario | null> {
  noStore();
  const profile = await loadUserProfile(supabase, userId);
  const pillar3aAccounts = await loadPillar3aAccounts(
    supabase,
    userId,
    profile?.pillar3a_current_capital,
  );

  const resolvedTax = await loadResolvedTaxReferences(supabase, {
    maritalStatus: profile?.marital_status,
    cantonCode: profile?.tax_canton,
    municipality: profile?.tax_municipality,
    municipalitySteuerfuss: profile?.tax_municipality_steuerfuss,
  });

  const scenarioInput = profileRowToScenarioInput(profile, pillar3aAccounts);
  if (!scenarioInput) return null;

  return {
    ...scenarioInput,
    taxSettings: taxSettingsFromProfile(profile, resolvedTax),
  };
}

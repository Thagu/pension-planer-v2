import { redirect } from "next/navigation";

import { MasterDataForm } from "@/components/master-data/master-data-form";
import { loadHouseholdProfileForScenario } from "@/lib/profile/load-household-profile";
import { loadUserProfile } from "@/lib/profile/load-profile";
import { loadTaxLocalReference } from "@/lib/tax/load-tax-reference";
import { normalizeMaritalStatus } from "@/lib/tax/types";
import { loadPillar3aAccounts } from "@/lib/pillar3a/load-accounts";
import { createClient } from "@/lib/supabase/server";

export async function MasterDataContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const profile = await loadUserProfile(supabase, user.id);
  const household = await loadHouseholdProfileForScenario(supabase, user.id);
  const allPillar3a = await loadPillar3aAccounts(
    supabase,
    user.id,
    profile?.pillar3a_current_capital,
  );
  const primaryPillar3aAccounts = allPillar3a.filter(
    (account) => (account.person ?? "primary") !== "partner",
  );
  const partnerPillar3aAccounts = allPillar3a.filter(
    (account) => account.person === "partner",
  );

  const cantonCode = profile?.tax_canton ?? "ZH";
  const municipality = profile?.tax_municipality ?? "";
  const maritalStatus = normalizeMaritalStatus(profile?.marital_status);

  const localTaxRow =
    municipality.trim().length > 0
      ? await loadTaxLocalReference(
          supabase,
          cantonCode,
          municipality,
          maritalStatus,
        )
      : null;

  const localTaxStatus = localTaxRow
    ? {
        exists: true,
        updatedAt: localTaxRow.updated_at ?? null,
        sourceNotes: localTaxRow.source_notes ?? null,
        maritalStatus,
        cantonCode: cantonCode.toUpperCase(),
        municipality: municipality.trim(),
      }
    : {
        exists: false,
        maritalStatus,
        cantonCode: cantonCode.toUpperCase(),
        municipality: municipality.trim(),
      };

  return (
    <MasterDataForm
      profile={profile}
      household={household}
      primaryPillar3aAccounts={primaryPillar3aAccounts}
      partnerPillar3aAccounts={partnerPillar3aAccounts}
      localTaxStatus={localTaxStatus}
    />
  );
}

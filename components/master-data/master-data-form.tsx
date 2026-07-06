"use client";

import { useCallback, useState } from "react";

import { FinancialIndependencePanel } from "@/components/master-data/financial-independence-panel";
import { StickyPreviewLayout } from "@/components/layout/sticky-preview-layout";
import { MasterDataFormBody } from "@/components/master-data/master-data-form-body";
import type { LocalTaxReferenceStatus } from "@/app/master-data/tax-lookup-actions";
import type { HouseholdProfileForScenario } from "@/lib/household/types";
import type { Pillar3aAccountRow } from "@/lib/pillar3a/accounts";

export type ProfileRow = {
  updated_at?: string | null;
  first_name?: string | null;
  birth_date: string | null;
  gender: string | null;
  employment_start_year: number | null;
  retirement_age: number | null;
  current_salary_brutto: number | null;
  bvg_current_capital: number | null;
  pillar3a_current_capital: number | null;
  free_assets: number | null;
  bvg_interest_rate: number | null;
  bvg_conversion_rate: number | null;
  bvg_contribution_rates: Record<string, number> | null;
  bvg_coordinated_salary_override: number | null;
  pillar3a_interest_rate: number | null;
  free_assets_interest_rate: number | null;
  annual_savings_to_free_assets: number | null;
  planning_horizon_age: number | null;
  annual_retirement_expenses: number | null;
  annual_survivor_expenses?: number | null;
  pillar3a_auto_split_enabled: boolean | null;
  pillar3a_auto_split_threshold: number | null;
  pillar3a_auto_split_contribution_mode: string | null;
  pillar3a_auto_split_name_prefix: string | null;
  tax_canton: string | null;
  tax_postal_code: string | null;
  tax_municipality: string | null;
  tax_municipality_steuerfuss: number | null;
  marital_status: string | null;
  workload_reductions: import("@/lib/engine/workload").WorkloadReduction[] | null;
  inflation_rate?: number | null;
  planning_mode?: string | null;
  partner_profile?: unknown;
};

export function MasterDataForm({
  profile,
  household = null,
  primaryPillar3aAccounts = [],
  partnerPillar3aAccounts = [],
  localTaxStatus = null,
}: {
  profile: ProfileRow | null;
  household?: HouseholdProfileForScenario | null;
  primaryPillar3aAccounts?: Pillar3aAccountRow[];
  partnerPillar3aAccounts?: Pillar3aAccountRow[];
  localTaxStatus?: LocalTaxReferenceStatus | null;
}) {
  const [liveHousehold, setLiveHousehold] =
    useState<HouseholdProfileForScenario | null>(household);

  const handlePreviewUpdate = useCallback(
    (next: HouseholdProfileForScenario | null) => {
      setLiveHousehold(next);
    },
    [],
  );

  return (
    <StickyPreviewLayout
      preview={<FinancialIndependencePanel household={liveHousehold} />}
      previewLabel="Finanzielle Unabhängigkeit"
    >
      <MasterDataFormBody
        profile={profile}
        primaryPillar3aAccounts={primaryPillar3aAccounts}
        partnerPillar3aAccounts={partnerPillar3aAccounts}
        localTaxStatus={localTaxStatus}
        onPreviewUpdate={handlePreviewUpdate}
      />
    </StickyPreviewLayout>
  );
}

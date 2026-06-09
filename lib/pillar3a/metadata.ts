import type { User } from "@supabase/supabase-js";

import type { Pillar3aAccountRow } from "@/lib/pillar3a/accounts";

export type Pillar3aAccountMeta = {
  id: string;
  name: string;
  provider: string | null;
  currentValue: number;
  annualContribution: number;
  returnRate: number | null;
  sortOrder: number;
};

const METADATA_KEY = "pension_planner_pillar3a_accounts";

export function pillar3aAccountsFromMetadata(
  user: User | null | undefined,
): Pillar3aAccountMeta[] {
  const raw = user?.user_metadata?.[METADATA_KEY];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id =
        typeof row.id === "string" && row.id.trim()
          ? row.id.trim()
          : `meta-${index}`;
      return {
        id,
        name:
          typeof row.name === "string" && row.name.trim()
            ? row.name.trim()
            : `3a-Konto ${index + 1}`,
        provider:
          typeof row.provider === "string" && row.provider.trim()
            ? row.provider.trim()
            : null,
        currentValue: Number(row.currentValue) || 0,
        annualContribution: Number(row.annualContribution) || 0,
        returnRate:
          row.returnRate != null && Number.isFinite(Number(row.returnRate))
            ? Number(row.returnRate)
            : null,
        sortOrder: Number(row.sortOrder) || index,
      };
    })
    .filter((item): item is Pillar3aAccountMeta => item != null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function metaToPillar3aRow(
  meta: Pillar3aAccountMeta,
  userId: string,
): Pillar3aAccountRow {
  return {
    id: meta.id,
    user_id: userId,
    name: meta.name,
    provider: meta.provider,
    current_value: meta.currentValue,
    annual_contribution: meta.annualContribution,
    return_rate: meta.returnRate,
    withdrawal_year_offset: 0,
    sort_order: meta.sortOrder,
  };
}

export function pillar3aAccountsToMetadata(
  accounts: Array<{
    id: string | null;
    name: string;
    provider: string | null;
    currentValue: number;
    annualContribution: number;
    returnRatePercent: number | null;
    sortOrder: number;
  }>,
): Pillar3aAccountMeta[] {
  return accounts.map((account, index) => ({
    id: account.id ?? `meta-${index}`,
    name: account.name,
    provider: account.provider,
    currentValue: account.currentValue,
    annualContribution: account.annualContribution,
    returnRate:
      account.returnRatePercent != null
        ? account.returnRatePercent / 100
        : null,
    sortOrder: account.sortOrder,
  }));
}

export function metadataPatchForPillar3aAccounts(
  accounts: Pillar3aAccountMeta[],
): Record<string, unknown> {
  return {
    [METADATA_KEY]: accounts,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseDbAmount } from "@/lib/format/db-numbers";
import { normalizeDbRate } from "@/lib/format/numbers";
import {
  legacyProfileToPillar3aDraft,
  type Pillar3aAccountRow,
} from "@/lib/pillar3a/accounts";
import {
  metaToPillar3aRow,
  pillar3aAccountsFromMetadata,
} from "@/lib/pillar3a/metadata";

function normalizeRow(row: Pillar3aAccountRow): Pillar3aAccountRow {
  return {
    ...row,
    current_value: parseDbAmount(row.current_value),
    annual_contribution: parseDbAmount(row.annual_contribution),
    return_rate:
      row.return_rate != null ? normalizeDbRate(row.return_rate, 0.03) : null,
    withdrawal_year_offset: Number(row.withdrawal_year_offset) || 0,
    sort_order: Number(row.sort_order) || 0,
  };
}

export async function loadPillar3aAccounts(
  supabase: SupabaseClient,
  userId: string,
  legacyCapital?: number | null,
): Promise<Pillar3aAccountRow[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("pillar3a_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (!error) {
    if (data && data.length > 0) {
      return (data as Pillar3aAccountRow[]).map(normalizeRow);
    }
  } else if (!/pillar3a_accounts|does not exist/i.test(error.message)) {
    console.error("[loadPillar3aAccounts]", error.message);
  }

  const metaRows = pillar3aAccountsFromMetadata(user);
  if (metaRows.length > 0) {
    return metaRows.map((meta) =>
      normalizeRow(metaToPillar3aRow(meta, userId)),
    );
  }

  if (legacyCapital && legacyCapital > 0) {
    const legacy = legacyProfileToPillar3aDraft(legacyCapital);
    if (legacy) {
      return [
        normalizeRow({
          id: legacy.id,
          user_id: userId,
          name: legacy.name,
          provider: null,
          current_value: legacy.currentValue,
          annual_contribution: legacy.annualContribution,
          return_rate: null,
          withdrawal_year_offset: 0,
          sort_order: 0,
        }),
      ];
    }
  }

  return [];
}

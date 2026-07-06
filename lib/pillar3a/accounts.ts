import { PILLAR_3A_MAX_CONTRIBUTION } from "@/lib/engine/constants";

import { parseDbAmount } from "@/lib/format/db-numbers";

export type Pillar3aPerson = "primary" | "partner";

export type Pillar3aAccountRow = {
  id: string;
  user_id: string;
  name: string;
  provider: string | null;
  current_value: number;
  annual_contribution: number;
  return_rate: number | null;
  withdrawal_year_offset: number;
  sort_order: number;
  person?: Pillar3aPerson | null;
};

export type Pillar3aAccountDraft = {
  id: string;
  name: string;
  provider: string;
  currentValue: number;
  annualContribution: number;
  returnRatePercent: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Nur echte DB-UUIDs – Metadata/Legacy-IDs (meta-0, legacy, new-…) → Insert */
export function isPersistedPillar3aAccountId(id: string | null | undefined): boolean {
  return typeof id === "string" && UUID_RE.test(id);
}

export function persistedPillar3aAccountIdOrNull(
  id: string | null | undefined,
): string | null {
  return isPersistedPillar3aAccountId(id) ? (id as string) : null;
}

/** Verbleibender abzugsfähiger Betrag für ein neues/weiteres Konto */
export function suggestedPillar3aContribution(
  existingContributions: number[],
): number {
  const used = existingContributions.reduce((sum, v) => sum + Math.max(0, v), 0);
  return Math.max(0, PILLAR_3A_MAX_CONTRIBUTION - used);
}

/** Serialisiert Konto-Entwürfe in das FormData-JSON-Format (Stammdaten & Wizard). */
export function serializePillar3aDrafts(items: Pillar3aAccountDraft[]): string {
  return JSON.stringify(
    items.map((item, index) => ({
      id: persistedPillar3aAccountIdOrNull(item.id),
      name: item.name.trim() || `3a-Konto ${index + 1}`,
      provider: item.provider.trim() || null,
      currentValue: item.currentValue,
      annualContribution: item.annualContribution,
      returnRatePercent: item.returnRatePercent.trim()
        ? parseFloat(item.returnRatePercent.replace(",", "."))
        : null,
      sortOrder: index,
    })),
  );
}

/** Liest das FormData-JSON-Format zurück in Konto-Entwürfe (z. B. Wizard-Replay). */
export function parsePillar3aDraftsJson(json: string): Pillar3aAccountDraft[] {
  if (typeof json !== "string" || !json.trim()) return [];
  try {
    const parsed = JSON.parse(json) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, index) => {
      const rate = item.returnRatePercent;
      return {
        id:
          persistedPillar3aAccountIdOrNull(
            typeof item.id === "string" ? item.id : null,
          ) ?? `new-${index}`,
        name:
          typeof item.name === "string" && item.name.trim()
            ? item.name
            : `3a-Konto ${index + 1}`,
        provider: typeof item.provider === "string" ? item.provider : "",
        currentValue: Number(item.currentValue) || 0,
        annualContribution: Number(item.annualContribution) || 0,
        returnRatePercent:
          rate != null && rate !== "" && Number.isFinite(Number(rate))
            ? String(rate)
            : "",
      };
    });
  } catch {
    return [];
  }
}

export function rowToPillar3aDraft(row: Pillar3aAccountRow): Pillar3aAccountDraft {
  const rate = row.return_rate;
  const returnRatePercent =
    rate != null && Number.isFinite(rate)
      ? (Math.abs(rate) <= 1 ? rate * 100 : rate).toFixed(2).replace(/\.?0+$/, "")
      : "";

  return {
    id: isPersistedPillar3aAccountId(row.id)
      ? row.id
      : `new-${row.sort_order}-${row.id.replace(/[^a-z0-9-]/gi, "")}`,
    name: row.name,
    provider: row.provider ?? "",
    currentValue: parseDbAmount(row.current_value),
    annualContribution: parseDbAmount(row.annual_contribution),
    returnRatePercent,
  };
}

export function createEmptyPillar3aAccount(
  index: number,
  existingContributions: number[] = [],
): Pillar3aAccountDraft {
  return {
    id: `new-${Date.now()}-${index}`,
    name: `3a-Konto ${index + 1}`,
    provider: "",
    currentValue: 0,
    annualContribution: suggestedPillar3aContribution(existingContributions),
    returnRatePercent: "",
  };
}

export function legacyProfileToPillar3aDraft(
  capital: number | null | undefined,
): Pillar3aAccountDraft | null {
  if (!capital || capital <= 0) return null;
  return {
    id: "legacy",
    name: "3a-Konto 1",
    provider: "",
    currentValue: capital,
    annualContribution: PILLAR_3A_MAX_CONTRIBUTION,
    returnRatePercent: "",
  };
}

/** Gleichmässig verteilte, eindeutige Integer-Offsets im zulässigen Bereich */
export function spreadUniqueWithdrawalOffsets(
  count: number,
  minOffset: number,
  maxOffset: number,
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [maxOffset];

  const span = maxOffset - minOffset;
  const raw = Array.from({ length: count }, (_, index) =>
    Math.round(minOffset + (index * span) / (count - 1)),
  );

  const offsets = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    let next = raw[i];
    if (next <= offsets[i - 1]) next = offsets[i - 1] + 1;
    offsets.push(Math.min(next, maxOffset));
  }

  while (offsets[offsets.length - 1] > maxOffset) {
    for (let i = offsets.length - 1; i > 0; i--) {
      offsets[i] = Math.min(offsets[i], maxOffset);
      if (offsets[i] <= offsets[i - 1]) {
        offsets[i - 1] = Math.max(minOffset, offsets[i] - 1);
      }
    }
  }

  while (offsets[0] < minOffset) {
    for (let i = 0; i < offsets.length - 1; i++) {
      offsets[i] = Math.max(minOffset, offsets[i]);
      if (offsets[i] >= offsets[i + 1]) {
        offsets[i + 1] = Math.min(maxOffset, offsets[i] + 1);
      }
    }
  }

  return offsets;
}

/**
 * Default-Bezugsplan: gespeicherte Offsets beibehalten, fehlende eindeutig
 * im gesetzlichen Bereich verteilen (nicht pauschal 0 = BVG-Jahr).
 */
export function defaultWithdrawalSchedule(
  accountIds: string[],
  saved?: Record<string, number>,
  options?: {
    bvgPensionStartAge?: number;
    earliestWithdrawalAge?: number;
    latestWithdrawalAge?: number;
  },
): Record<string, number> {
  const schedule: Record<string, number> = {};

  for (const id of accountIds) {
    if (saved?.[id] != null) {
      schedule[id] = saved[id]!;
    }
  }

  const unsetIds = accountIds.filter((id) => schedule[id] === undefined);
  if (unsetIds.length === 0) return schedule;

  const hasAgeOptions =
    options?.bvgPensionStartAge != null &&
    options?.earliestWithdrawalAge != null &&
    options?.latestWithdrawalAge != null;

  if (hasAgeOptions) {
    const minOffset =
      options!.earliestWithdrawalAge! - options!.bvgPensionStartAge!;
    const maxOffset =
      options!.latestWithdrawalAge! - options!.bvgPensionStartAge!;
    const usedOffsets = new Set(Object.values(schedule));
    const availableOffsets: number[] = [];
    for (let offset = minOffset; offset <= maxOffset; offset++) {
      if (!usedOffsets.has(offset)) availableOffsets.push(offset);
    }

    if (unsetIds.length === accountIds.length) {
      const defaults = spreadUniqueWithdrawalOffsets(
        unsetIds.length,
        minOffset,
        maxOffset,
      );
      unsetIds.forEach((id, index) => {
        schedule[id] = defaults[index] ?? maxOffset;
      });
      return schedule;
    }

    let manualIndex = 0;
    unsetIds.forEach((id) => {
      if (id.startsWith("auto-split-")) {
        schedule[id] = maxOffset;
        return;
      }
      schedule[id] =
        availableOffsets[manualIndex] ??
        availableOffsets[availableOffsets.length - 1] ??
        maxOffset;
      manualIndex++;
    });
    return schedule;
  }

  const usedOffsets = new Set(Object.values(schedule));
  let nextOffset = 0;
  for (const id of unsetIds) {
    while (usedOffsets.has(nextOffset)) nextOffset++;
    schedule[id] = nextOffset;
    usedOffsets.add(nextOffset);
  }

  return schedule;
}

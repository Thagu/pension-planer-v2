import type { CapitalInjection } from "@/lib/engine/modules/free-assets";
import type { InheritanceEvent } from "@/lib/household/types";

export function normalizeInheritanceEvents(
  raw: InheritanceEvent[] | null | undefined,
): InheritanceEvent[] {
  if (!raw?.length) return [];
  const seen = new Set<number>();
  const events: InheritanceEvent[] = [];
  for (const event of raw) {
    const atAge = Math.round(Number(event.atAge));
    const amount = Math.round(Number(event.amount));
    if (
      !Number.isFinite(atAge) ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      atAge < 0 ||
      seen.has(atAge)
    ) {
      continue;
    }
    seen.add(atAge);
    events.push({
      atAge,
      amount,
      recipient: event.recipient ?? "household",
    });
  }
  return events.sort((a, b) => a.atAge - b.atAge);
}

export function inheritanceToInjections(
  events: InheritanceEvent[],
  recipient: "household" | "primary" | "partner" = "household",
): CapitalInjection[] {
  return normalizeInheritanceEvents(events)
    .filter((e) => (e.recipient ?? "household") === recipient)
    .map((e) => ({
      atAge: e.atAge,
      amount: e.amount,
      label: "Erbschaft / Schenkung",
      source: "other" as const,
    }));
}

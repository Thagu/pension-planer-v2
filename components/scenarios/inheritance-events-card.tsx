"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Label } from "@/components/ui/label";
import { CHF_STEP, NUM_STEP } from "@/components/shared/numeric-steps";
import {
  ChfStepperInput,
  NumberStepperInput,
} from "@/components/shared/stepper-inputs";
import type { InheritanceEvent } from "@/lib/household/types";
import { formatSwissNumber, parseSwissNumber } from "@/lib/format/numbers";

export type InheritanceEventDraft = {
  atAge: string;
  amount: string;
};

export function inheritanceDraftsFromEvents(
  events: InheritanceEvent[] | null | undefined,
): InheritanceEventDraft[] {
  if (!events?.length) return [];
  return events.map((event) => ({
    atAge: String(event.atAge),
    amount: formatSwissNumber(event.amount),
  }));
}

export function inheritanceEventsFromDrafts(
  drafts: InheritanceEventDraft[],
): InheritanceEvent[] {
  return drafts
    .map((draft) => ({
      atAge: parseInt(draft.atAge, 10),
      amount: parseSwissNumber(draft.amount),
      recipient: "household" as const,
    }))
    .filter(
      (event) =>
        Number.isFinite(event.atAge) &&
        event.atAge >= 0 &&
        Number.isFinite(event.amount) &&
        event.amount > 0,
    );
}

export function InheritanceEventsCard({
  events,
  onChange,
}: {
  events: InheritanceEventDraft[];
  onChange: (events: InheritanceEventDraft[]) => void;
}) {
  const update = (index: number, patch: Partial<InheritanceEventDraft>) => {
    onChange(
      events.map((event, i) => (i === index ? { ...event, ...patch } : event)),
    );
  };

  const addEvent = () => {
    onChange([...events, { atAge: "", amount: "" }]);
  };

  const removeEvent = (index: number) => {
    onChange(events.filter((_, i) => i !== index));
  };

  return (
    <CollapsibleCard
      title="Erbschaft / Schenkung"
      description="Einmaliger Vermögenszufluss ins freie Haushaltsvermögen. Alter bezieht sich auf Person 1."
    >
      <div className="space-y-4">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Erbschaft geplant.
          </p>
        ) : (
          events.map((event, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <div className="grid gap-2">
                <Label htmlFor={`inheritance-age-${index}`}>Alter Person 1</Label>
                <NumberStepperInput
                  id={`inheritance-age-${index}`}
                  value={event.atAge}
                  onChange={(e) => update(index, { atAge: e.target.value })}
                  step={NUM_STEP.age}
                  min={0}
                  max={110}
                  placeholder="55"
                  ariaLabel="Alter Person 1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`inheritance-amount-${index}`}>Betrag</Label>
                <ChfStepperInput
                  id={`inheritance-amount-${index}`}
                  value={event.amount}
                  onChange={(e) =>
                    update(index, {
                      amount: formatSwissNumber(parseSwissNumber(e.target.value)),
                    })
                  }
                  step={CHF_STEP.inheritance}
                  ariaLabel="Erbschaftsbetrag"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEvent(index)}
                  aria-label="Eintrag entfernen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
        <Button type="button" variant="outline" size="sm" onClick={addEvent}>
          <Plus className="mr-1 h-4 w-4" />
          Erbschaft hinzufügen
        </Button>
      </div>
    </CollapsibleCard>
  );
}

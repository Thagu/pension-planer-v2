"use client";

import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHF_STEP } from "@/components/shared/numeric-steps";
import { ChfStepperInput } from "@/components/shared/stepper-inputs";
import { formatSwissNumber, parseSwissNumber } from "@/lib/format/numbers";

type Props = {
  enabled: boolean;
  threshold: number | null | undefined;
  contributionMode: "max" | "last" | null | undefined;
  namePrefix: string | null | undefined;
  onSettingsChange?: () => void;
};

export function Pillar3aAutoSplitSettings({
  enabled: initialEnabled,
  threshold: initialThreshold,
  contributionMode: initialMode,
  namePrefix: initialPrefix,
  onSettingsChange,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [threshold, setThreshold] = useState(() =>
    initialThreshold != null && initialThreshold > 0
      ? formatSwissNumber(initialThreshold)
      : "",
  );
  const [mode, setMode] = useState<"max" | "last">(
    initialMode === "last" ? "last" : "max",
  );
  const [namePrefix, setNamePrefix] = useState(initialPrefix ?? "3a-Konto");

  const notifyChange = () => {
    onSettingsChange?.();
    if (typeof document === "undefined") return;
    document
      .querySelector<HTMLInputElement>(
        'input[name="pillar3aAutoSplitEnabled"]',
      )
      ?.dispatchEvent(new Event("input", { bubbles: true }));
  };

  return (
    <div className="md:col-span-2 space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
      <input
        type="hidden"
        name="pillar3aAutoSplitEnabled"
        value={enabled ? "on" : "off"}
      />
      <input type="hidden" name="pillar3aAutoSplitContributionMode" value={mode} />
      <input type="hidden" name="pillar3aAutoSplitNamePrefix" value={namePrefix} />
      <input
        type="hidden"
        name="pillar3aAutoSplitThreshold"
        value={threshold}
      />

      <div className="flex items-start gap-3">
        <Checkbox
          id="pillar3aAutoSplitEnabledUi"
          checked={enabled}
          onCheckedChange={(v) => {
            setEnabled(v === true);
            notifyChange();
          }}
        />
        <div className="space-y-1">
          <Label htmlFor="pillar3aAutoSplitEnabledUi" className="cursor-pointer">
            Automatisch neues Konto eröffnen
          </Label>
          <p className="text-xs text-muted-foreground">
            Wenn ein Konto den Schwellenwert erreicht, wird in der Projektion ein
            weiteres 3a-Konto eröffnet (gestaffelte Strategie).
          </p>
        </div>
      </div>

      {enabled ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="pillar3aAutoSplitThresholdUi">Schwellenkapital (CHF)</Label>
            <ChfStepperInput
              id="pillar3aAutoSplitThresholdUi"
              value={threshold}
              onChange={(e) => {
                const parsed = parseSwissNumber(e.target.value);
                setThreshold(
                  e.target.value.trim() === ""
                    ? ""
                    : formatSwissNumber(parsed),
                );
                notifyChange();
              }}
              step={CHF_STEP.wealth}
              placeholder="100'000"
              ariaLabel="Schwellenkapital"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pillar3aAutoSplitModeUi">Einzahlung neues Konto</Label>
            <select
              id="pillar3aAutoSplitModeUi"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value === "last" ? "last" : "max");
                notifyChange();
              }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="max">Maximal abzugsfähig</option>
              <option value="last">Wie Vorgänger-Konto</option>
            </select>
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="pillar3aAutoSplitPrefixUi">Namens-Prefix neuer Konten</Label>
            <Input
              id="pillar3aAutoSplitPrefixUi"
              value={namePrefix}
              onChange={(e) => {
                setNamePrefix(e.target.value);
                notifyChange();
              }}
              placeholder="3a-Konto"
            />
            <p className="text-xs text-muted-foreground">
              Automatische Konten heissen z.&nbsp;B. «{namePrefix.trim() || "3a-Konto"} 2».
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

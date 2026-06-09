"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHF_STEP, NUM_STEP } from "@/components/shared/numeric-steps";
import {
  ChfStepperInput,
  PercentStepperInput,
} from "@/components/shared/stepper-inputs";
import { PILLAR_3A_MAX_ACCOUNTS, PILLAR_3A_MAX_CONTRIBUTION } from "@/lib/engine";
import {
  decimalToPercentDisplay,
  formatSwissNumber,
  parseSwissNumber,
} from "@/lib/format/numbers";
import {
  createEmptyPillar3aAccount,
  persistedPillar3aAccountIdOrNull,
  rowToPillar3aDraft,
  suggestedPillar3aContribution,
  type Pillar3aAccountDraft,
  type Pillar3aAccountRow,
} from "@/lib/pillar3a/accounts";

type Props = {
  accounts: Pillar3aAccountRow[];
  defaultReturnRate: number | null | undefined;
  formFieldName?: string;
};

export function Pillar3aAccountsEditor({
  accounts,
  defaultReturnRate,
  formFieldName = "pillar3aAccountsJson",
}: Props) {
  const defaultPct = decimalToPercentDisplay(defaultReturnRate) || "3";

  const [items, setItems] = useState<Pillar3aAccountDraft[]>(() => {
    if (accounts.length > 0) {
      return accounts.map(rowToPillar3aDraft);
    }
    return [];
  });

  const totalContribution = items.reduce(
    (sum, a) => sum + a.annualContribution,
    0,
  );

  const updateItem = (id: string, patch: Partial<Pillar3aAccountDraft>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const updateChf = (
    id: string,
    field: "currentValue" | "annualContribution",
    raw: string,
  ) => {
    const parsed = parseSwissNumber(raw);
    updateItem(id, { [field]: parsed });
  };

  const addAccount = () => {
    if (items.length >= PILLAR_3A_MAX_ACCOUNTS) return;
    setItems((prev) => [
      ...prev,
      createEmptyPillar3aAccount(
        prev.length,
        prev.map((a) => a.annualContribution),
      ),
    ]);
  };

  const applyMaxSuggestion = (id: string) => {
    const others = items
      .filter((a) => a.id !== id)
      .map((a) => a.annualContribution);
    updateItem(id, {
      annualContribution: suggestedPillar3aContribution(others),
    });
  };

  const removeAccount = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-4 md:col-span-2">
      <input
        type="hidden"
        name={formFieldName}
        value={JSON.stringify(
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
        )}
      />

      <p className="text-sm text-muted-foreground">
        Maximal steuerlich abzugsfähig:{" "}
        <strong className="font-mono">{formatSwissNumber(PILLAR_3A_MAX_CONTRIBUTION)}</strong>{" "}
        CHF/Jahr (mit Pensionskasse). Der gestaffelte Bezug wird im Szenario geplant.
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine 3a-Konten erfasst. Beim Hinzufügen wird die maximale Einzahlung
          vorgeschlagen.
        </p>
      ) : null}

      {items.map((item, index) => (
        <div
          key={item.id}
          className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {item.name.trim() || `3a-Konto ${index + 1}`}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeAccount(item.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid items-start gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Bezeichnung</Label>
              <Input
                value={item.name}
                onChange={(e) => updateItem(item.id, { name: e.target.value })}
                placeholder="Bank 3a"
              />
            </div>
            <div className="grid gap-2">
              <Label>Anbieter (optional)</Label>
              <Input
                value={item.provider}
                onChange={(e) => updateItem(item.id, { provider: e.target.value })}
                placeholder="z. B. VIAC, Frankly"
              />
            </div>
            <div className="grid gap-2 self-start">
              <Label>Aktuelles Kapital (CHF)</Label>
              <ChfStepperInput
                value={formatSwissNumber(item.currentValue)}
                onChange={(e) => updateChf(item.id, "currentValue", e.target.value)}
                step={CHF_STEP.wealth}
                ariaLabel="3a Kapital"
              />
            </div>
            <div className="grid gap-2">
              <Label>Jährliche Einzahlung (CHF)</Label>
              <div className="flex flex-wrap items-start gap-2">
                <ChfStepperInput
                  className="min-w-[12rem] flex-1"
                  value={formatSwissNumber(item.annualContribution)}
                  onChange={(e) =>
                    updateChf(item.id, "annualContribution", e.target.value)
                  }
                  step={CHF_STEP.contribution3a}
                  ariaLabel="3a Einzahlung"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyMaxSuggestion(item.id)}
                >
                  Max. vorschlagen
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Vorschlag: verbleibender abzugsfähiger Betrag (
                {formatSwissNumber(
                  suggestedPillar3aContribution(
                    items
                      .filter((a) => a.id !== item.id)
                      .map((a) => a.annualContribution),
                  ),
                )}{" "}
                CHF)
              </p>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Erwartete Rendite (%)</Label>
              <PercentStepperInput
                value={item.returnRatePercent}
                onChange={(e) =>
                  updateItem(item.id, {
                    returnRatePercent: e.target.value.replace(/%/g, ""),
                  })
                }
                placeholder={defaultPct}
                step={NUM_STEP.percent}
                ariaLabel="3a Rendite"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addAccount}
          disabled={items.length >= PILLAR_3A_MAX_ACCOUNTS}
        >
          <Plus className="mr-1 h-4 w-4" />
          3a-Konto hinzufügen
        </Button>
        {totalContribution > PILLAR_3A_MAX_CONTRIBUTION ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Hinweis: Total Einzahlungen ({formatSwissNumber(totalContribution)}/J.)
            übersteigen das abzugsfähige Maximum von{" "}
            {formatSwissNumber(PILLAR_3A_MAX_CONTRIBUTION)}/J.
          </p>
        ) : null}
      </div>
    </div>
  );
}

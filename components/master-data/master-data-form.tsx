"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import { saveMasterData } from "@/app/master-data/actions";
import type { LocalTaxReferenceStatus } from "@/app/master-data/tax-lookup-actions";
import { FinancialIndependencePanel } from "@/components/master-data/financial-independence-panel";
import { SectionTabs } from "@/components/layout/section-tabs";
import { StickyPreviewLayout } from "@/components/layout/sticky-preview-layout";
import { Pillar3aAutoSplitSettings } from "@/components/master-data/pillar3a-auto-split-settings";
import { TaxSettingsFields } from "@/components/master-data/tax-settings-fields";
import { PersonMasterFields } from "@/components/household/person-master-fields";
import { CHF_STEP, NUM_STEP } from "@/components/shared/numeric-steps";
import {
  ChfStepperField,
  NumberStepperField,
  PercentStepperField,
} from "@/components/shared/stepper-inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  decimalToPercentDisplay,
  formatSwissNumber,
  parseSwissNumber,
} from "@/lib/format/numbers";
import type { HouseholdProfileForScenario } from "@/lib/household/types";
import { parsePartnerProfileData } from "@/lib/household/partner-profile";
import { parseMasterDataFormToHousehold, taxSettingsFromFormData } from "@/lib/master-data/parse-form-profile";
import type { PlanningMode } from "@/lib/household/types";
import type { Pillar3aAccountRow } from "@/lib/pillar3a/accounts";

export type ProfileRow = {
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

function useChfField(initial: number | null | undefined) {
  const [value, setValue] = useState(() => formatSwissNumber(initial ?? 0));
  return {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValue(formatSwissNumber(parseSwissNumber(e.target.value))),
    onBlur: () => setValue(formatSwissNumber(parseSwissNumber(value))),
  };
}

function usePercentField(initial: number | null | undefined) {
  const [value, setValue] = useState(() => decimalToPercentDisplay(initial));
  return {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValue(e.target.value.replace(/%/g, "")),
  };
}

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
  const [isPending, startTransition] = useTransition();
  const [planningMode, setPlanningMode] = useState<PlanningMode>(
    profile?.planning_mode === "couple" ? "couple" : "single",
  );
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [liveHousehold, setLiveHousehold] =
    useState<HouseholdProfileForScenario | null>(household);

  const [planningHorizonAge, setPlanningHorizonAge] = useState(() =>
    String(profile?.planning_horizon_age ?? 95),
  );

  const annualRetirementExpenses = useChfField(profile?.annual_retirement_expenses);
  const annualSurvivorExpenses = useChfField(profile?.annual_survivor_expenses);
  const inflationRate = usePercentField(profile?.inflation_rate);
  const pillar3aInterest = usePercentField(profile?.pillar3a_interest_rate);
  const partnerData = parsePartnerProfileData(profile?.partner_profile);

  const refreshLivePreview = useCallback(() => {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    const parsed = parseMasterDataFormToHousehold(
      formData,
      taxSettingsFromFormData(formData),
    );
    setLiveHousehold(parsed);
  }, []);

  const scheduleLivePreview = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refreshLivePreview, 200);
  }, [refreshLivePreview]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("planningMode", planningMode);
    startTransition(() => {
      void saveMasterData(formData);
    });
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onChange={scheduleLivePreview}
      onInput={scheduleLivePreview}
      className="grid gap-6"
    >
      <StickyPreviewLayout
        preview={<FinancialIndependencePanel household={liveHousehold} />}
        previewLabel="Finanzielle Unabhängigkeit"
      >
        <SectionTabs
          key={planningMode}
          defaultValue="person-1"
          tabs={[
            {
              value: "planning",
              label: "Planung",
              description:
                "Einzelperson oder Paar mit separaten Stammdaten pro Person.",
              content: (
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="grid gap-2 xl:col-span-2">
                    <Label htmlFor="planningMode">Modus</Label>
                    <select
                      id="planningMode"
                      name="planningMode"
                      value={planningMode}
                      onChange={(e) => {
                        setPlanningMode(
                          e.target.value === "couple" ? "couple" : "single",
                        );
                        scheduleLivePreview();
                      }}
                      className="h-10 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="single">Einzelperson</option>
                      <option value="couple">Paar / Haushalt</option>
                    </select>
                  </div>
                  <NumberStepperField
                    id="planningHorizonAge"
                    name="planningHorizonAge"
                    label="Planungshorizont (Alter)"
                    value={planningHorizonAge}
                    onChange={(e) => setPlanningHorizonAge(e.target.value)}
                    step={NUM_STEP.age}
                    min={58}
                    max={110}
                  />
                  <p className="text-xs text-muted-foreground xl:col-span-2">
                    Projektion bis beide Partner dieses Alter erreichen (im
                    Paarmodus bis der jüngere Partner den Horizont erreicht).
                    Standard: 95 Jahre.
                  </p>
                  <ChfStepperField
                    id="annualRetirementExpenses"
                    name="annualRetirementExpenses"
                    label="Netto-Lebenshaltung ab Pensionierung"
                    step={CHF_STEP.wealth}
                    {...annualRetirementExpenses}
                  />
                  {planningMode === "couple" ? (
                    <ChfStepperField
                      id="annualSurvivorExpenses"
                      name="annualSurvivorExpenses"
                      label="Netto-Lebenshaltung nach Tod des Partners"
                      step={CHF_STEP.wealth}
                      {...annualSurvivorExpenses}
                    />
                  ) : null}
                  <PercentStepperField
                    id="inflationRate"
                    name="inflationRate"
                    label="Inflation (jährlich)"
                    placeholder="1.0"
                    step={NUM_STEP.percentFine}
                    {...inflationRate}
                  />
                  <p className="text-xs text-muted-foreground xl:col-span-2">
                    Netto-Lebenshaltung (Wohnen, Essen, Freizeit — ohne Steuern,
                    3a, BVG). In der Projektion werden Steuern, Lohn in der
                    Mischphase und Vorsorge separat berechnet. Ab dem ersten
                    Haushalts-Ruhestand wird die Teuerung auf diese Ausgaben
                    angewendet; 3a-Beiträge laufen über Gehalt bzw. die
                    3a-Projektion.
                    {planningMode === "couple"
                      ? " Nach dem Tod des ersten Partners (Planungshorizont des Älteren) gilt die separate Alleinerzieher-Lebenshaltung — Teuerung weiter ab erstem Haushalts-Ruhestand."
                      : null}
                    {inflationRate.value.trim()
                      ? " Inflation wird zusätzlich auf Lohn, Sparquote und 3a-Beiträge angewendet."
                      : " Ohne Inflationssatz bleiben alle Beträge nominal (heutige Kaufkraft)."}
                  </p>
                </div>
              ),
            },
            {
              value: "pillar3a",
              label: "Säule 3a Settings",
              description:
                "Automatische Kontoaufteilung und Standard-Rendite für Konten ohne eigene Rendite.",
              content: (
                <div className="grid gap-4 xl:grid-cols-2">
                  <Pillar3aAutoSplitSettings
                    enabled={Boolean(profile?.pillar3a_auto_split_enabled)}
                    threshold={profile?.pillar3a_auto_split_threshold}
                    contributionMode={
                      profile?.pillar3a_auto_split_contribution_mode === "last"
                        ? "last"
                        : "max"
                    }
                    namePrefix={profile?.pillar3a_auto_split_name_prefix}
                    onSettingsChange={scheduleLivePreview}
                  />
                  <PercentStepperField
                    id="pillar3aInterestRate"
                    name="pillar3aInterestRate"
                    label="Standard-Rendite 3a (Fallback)"
                    placeholder="3"
                    step={NUM_STEP.percent}
                    {...pillar3aInterest}
                  />
                </div>
              ),
            },
            {
              value: "person-1",
              label: "Person 1",
              description:
                "Stammdaten Person 1 — Gehalt, BVG, freies Vermögen, Säule 3a.",
              content: (
                <PersonMasterFields
                  person="primary"
                  profile={profile}
                  pillar3aAccounts={primaryPillar3aAccounts}
                  pillar3aDefaultReturn={profile?.pillar3a_interest_rate}
                  onFieldChange={scheduleLivePreview}
                />
              ),
            },
            {
              value: "person-2",
              label: "Person 2",
              description:
                "Stammdaten Person 2 — Gehalt, BVG, freies Vermögen, Säule 3a.",
              hidden: planningMode !== "couple",
              content: (
                <PersonMasterFields
                  person="partner"
                  partnerData={partnerData}
                  pillar3aAccounts={partnerPillar3aAccounts}
                  pillar3aDefaultReturn={profile?.pillar3a_interest_rate}
                  onFieldChange={scheduleLivePreview}
                />
              ),
            },
            {
              value: "tax",
              label: "Steuerdomizil",
              description:
                "Zivilstand und Steuerort für Kapitalbezüge und Renten.",
              content: (
                <TaxSettingsFields
                  profile={profile}
                  localTaxStatus={localTaxStatus}
                />
              ),
            },
          ]}
        />

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "Speichern…" : "Stammdaten speichern"}
          </Button>
        </div>
      </StickyPreviewLayout>
    </form>
  );
}

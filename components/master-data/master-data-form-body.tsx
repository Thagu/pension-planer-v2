"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { saveMasterData } from "@/app/master-data/actions";
import type { LocalTaxReferenceStatus } from "@/app/master-data/tax-lookup-actions";
import { SectionTabs } from "@/components/layout/section-tabs";
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
import { Label } from "@/components/ui/label";
import {
  decimalToPercentDisplay,
  formatSwissNumber,
  parseSwissNumber,
} from "@/lib/format/numbers";
import type { HouseholdProfileForScenario } from "@/lib/household/types";
import { parsePartnerProfileData } from "@/lib/household/partner-profile";
import {
  parseMasterDataFormToHousehold,
  taxSettingsFromFormData,
} from "@/lib/master-data/parse-form-profile";
import { collectFormDataFromElement } from "@/lib/master-data/collect-form-data";
import type { PlanningMode } from "@/lib/household/types";
import { personLabel } from "@/lib/household/person-colors";
import type { Pillar3aAccountRow } from "@/lib/pillar3a/accounts";

import type { ProfileRow } from "./master-data-form";

function useChfField(initial: number | null | undefined) {
  const [value, setValue] = useState(() => formatSwissNumber(initial ?? 0));
  return {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValue(formatSwissNumber(parseSwissNumber(e.target.value))),
    onBlur: () =>
      setValue((current) =>
        formatSwissNumber(parseSwissNumber(current)),
      ),
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

type MasterDataFormBodyProps = {
  profile: ProfileRow | null;
  primaryPillar3aAccounts?: Pillar3aAccountRow[];
  partnerPillar3aAccounts?: Pillar3aAccountRow[];
  localTaxStatus?: LocalTaxReferenceStatus | null;
  onPreviewUpdate: (household: HouseholdProfileForScenario | null) => void;
};

export const MasterDataFormBody = memo(function MasterDataFormBody({
  profile,
  primaryPillar3aAccounts = [],
  partnerPillar3aAccounts = [],
  localTaxStatus = null,
  onPreviewUpdate,
}: MasterDataFormBodyProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [planningMode, setPlanningMode] = useState<PlanningMode>(
    profile?.planning_mode === "couple" ? "couple" : "single",
  );

  type MasterDataTab =
    | "planning"
    | "pillar3a"
    | "person-1"
    | "person-2"
    | "tax";

  const validTabs = useMemo<MasterDataTab[]>(
    () => [
      "planning",
      "pillar3a",
      "person-1",
      ...(planningMode === "couple" ? (["person-2"] as const) : []),
      "tax",
    ],
    [planningMode],
  );

  const tabFromUrl = searchParams.get("tab");
  const initialTab: MasterDataTab = validTabs.includes(tabFromUrl as MasterDataTab)
    ? (tabFromUrl as MasterDataTab)
    : "person-1";
  const [activeTab, setActiveTab] = useState<MasterDataTab>(initialTab);
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPreviewUpdateRef = useRef(onPreviewUpdate);
  onPreviewUpdateRef.current = onPreviewUpdate;

  const [planningHorizonAge, setPlanningHorizonAge] = useState(() =>
    String(profile?.planning_horizon_age ?? 95),
  );

  const annualRetirementExpenses = useChfField(profile?.annual_retirement_expenses);
  const annualSurvivorExpenses = useChfField(profile?.annual_survivor_expenses);
  const inflationRate = usePercentField(profile?.inflation_rate);
  const pillar3aInterest = usePercentField(profile?.pillar3a_interest_rate);
  const freeAssets = useChfField(profile?.free_assets);
  const freeAssetsInterest = usePercentField(profile?.free_assets_interest_rate);
  const partnerData = useMemo(
    () => parsePartnerProfileData(profile?.partner_profile),
    [profile?.partner_profile],
  );

  const primaryLabel = personLabel("primary", profile?.first_name);
  const partnerLabel = personLabel("partner", partnerData?.first_name);

  const refreshLivePreview = useCallback(() => {
    if (!formRef.current) return;
    const formData = collectFormDataFromElement(formRef.current, {
      planningMode,
    });
    const parsed = parseMasterDataFormToHousehold(
      formData,
      taxSettingsFromFormData(formData),
    );
    onPreviewUpdateRef.current(parsed);
  }, [planningMode]);

  const scheduleLivePreview = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refreshLivePreview, 200);
  }, [refreshLivePreview]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && validTabs.includes(tab as MasterDataTab)) {
      setActiveTab((current) =>
        current === tab ? current : (tab as MasterDataTab),
      );
      return;
    }
    if (planningMode === "single") {
      setActiveTab((current) => (current === "person-2" ? "person-1" : current));
    }
  }, [searchParams, validTabs, planningMode]);

  const handleTabChange = useCallback(
    (nextTab: string) => {
      if (!validTabs.includes(nextTab as MasterDataTab)) return;
      const tab = nextTab as MasterDataTab;
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      params.delete("saved");
      params.delete("error");
      params.delete("detail");
      router.replace(`/master-data?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, validTabs],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = collectFormDataFromElement(e.currentTarget, {
      planningMode,
      activeTab,
    });
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
      autoComplete="off"
      className="grid gap-6"
    >
      <input type="hidden" name="activeTab" value={activeTab} />
      <SectionTabs
        value={activeTab}
        onValueChange={handleTabChange}
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
                <ChfStepperField
                  id="freeAssets"
                  name="freeAssets"
                  label={
                    planningMode === "couple"
                      ? "Freies Vermögen (Haushalt)"
                      : "Freies Vermögen (aktuell)"
                  }
                  step={CHF_STEP.wealth}
                  {...freeAssets}
                />
                <PercentStepperField
                  id="freeAssetsInterestRate"
                  name="freeAssetsInterestRate"
                  label="Rendite freies Vermögen"
                  placeholder="4"
                  step={NUM_STEP.percent}
                  {...freeAssetsInterest}
                />
                <p className="text-xs text-muted-foreground xl:col-span-2">
                  {planningMode === "couple"
                    ? "Gemeinsames freies Vermögen des Haushalts (ein Topf). Die Sparquote wird pro Person erfasst und fliesst bis zur jeweiligen Erwerbsaufgabe in diesen Topf."
                    : `Aktuelles freies Vermögen. Die Sparquote wird bei ${primaryLabel} erfasst.`}
                </p>
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
                  Standard: 95 Jahre. Betrag wird mit Inflationssatz angepasst.
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
            label: primaryLabel,
            description: `Stammdaten ${primaryLabel} — Gehalt, BVG, freies Vermögen, Säule 3a.`,
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
            label: partnerLabel,
            description: `Stammdaten ${partnerLabel} — Gehalt, BVG, freies Vermögen, Säule 3a.`,
            hidden: planningMode !== "couple",
            content: (
              <PersonMasterFields
                person="partner"
                partnerData={partnerData}
                pillar3aAccounts={partnerPillar3aAccounts}
                pillar3aDefaultReturn={profile?.pillar3a_interest_rate}
                primaryLabel={primaryLabel}
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
    </form>
  );
});

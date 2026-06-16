"use client";

import { SectionTabs } from "@/components/layout/section-tabs";
import { HouseholdPillar3aChart } from "@/components/household/household-pillar3a-chart";
import { HouseholdPensionSummary } from "@/components/household/household-pension-summary";
import { HouseholdSplitLayout } from "@/components/household/household-split-layout";
import { InheritanceEventsCard } from "@/components/scenarios/inheritance-events-card";
import { ScenarioAhvSection } from "@/components/scenarios/scenario-ahv-section";
import { ScenarioPersonPanel } from "@/components/scenarios/scenario-person-panel";
import { ScenarioBvgSection } from "@/components/scenarios/scenario-bvg-section";
import { PensionIncomeChart } from "@/components/scenarios/pension-income-chart";
import { VorsorgeIncomeTimelineChart } from "@/components/scenarios/vorsorge-income-timeline-chart";
import { PensionSummary } from "@/components/scenarios/pension-summary";
import { Pillar3aProjectionChart } from "@/components/scenarios/pillar3a-projection-chart";
import { ScenarioPillar3aSection } from "@/components/scenarios/scenario-pillar3a-section";
import {
  ProfileDefaultItem,
  ProfileDefaultsPanel,
  ProfileInheritanceNote,
  ScenarioAdjustmentsHeading,
  ScenarioOverrideRow,
} from "@/components/scenarios/scenario-profile-ui";
import { CHF_STEP } from "@/components/shared/numeric-steps";
import { ChfStepperInput } from "@/components/shared/stepper-inputs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCHF, normalizeWorkloadReductions, type HouseholdPensionResult, type ProfileForScenario, type ScenarioPensionResult } from "@/lib/engine";
import type { HouseholdProfileForScenario } from "@/lib/household/types";
import type { AhvOverrideState } from "@/components/scenarios/scenario-ahv-section";
import type { BvgOverrideState } from "@/components/scenarios/scenario-bvg-section";
import type { Pillar3aAccountOverrideState } from "@/components/scenarios/scenario-pillar3a-section";
import type { InheritanceEventDraft } from "@/components/scenarios/inheritance-events-card";
import type { WorkloadReduction } from "@/lib/engine/workload";

type BvgProfileDefaults = {
  conversionPercent: number;
  interestPercent: number;
  contributionRates: Record<string, number>;
};

type ScenarioFormTabsProps = {
  initialScenario: { id?: string; name: string } | null;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  inheritanceDrafts: InheritanceEventDraft[];
  setInheritanceDrafts: (v: InheritanceEventDraft[]) => void;
  isCouple: boolean;
  partnerProfile: ProfileForScenario | null;
  profile: ProfileForScenario;
  household: HouseholdProfileForScenario | null;
  result: ScenarioPensionResult;
  partnerResult: ScenarioPensionResult | null;
  householdResult: HouseholdPensionResult | null;
  baseResult: ScenarioPensionResult;
  effectiveRetirementAge: number;
  hasPillar3aChart: boolean;
  pensionIncomeSourceCount: number;
  profileFreeAssetsReturnPercent: number;
  profileDefaults: BvgProfileDefaults;
  partnerProfileDefaults: BvgProfileDefaults | null;
  profileBvgPensionStart: number;
  partnerBvgPensionStart: number;
  currentAge: number;
  partnerCurrentAge: number;
  ahvReferenceAge: number;
  ahvEarliestAge: number;
  partnerAhvReferenceAge: number;
  partnerAhvEarliestAge: number;
  primaryAhvState: AhvOverrideState;
  partnerAhvState: AhvOverrideState;
  updatePrimaryAhv: (patch: Partial<AhvOverrideState>) => void;
  setPartnerAhvState: React.Dispatch<React.SetStateAction<AhvOverrideState>>;
  primaryBvgState: BvgOverrideState;
  partnerBvgState: BvgOverrideState;
  updatePrimaryBvg: (patch: Partial<BvgOverrideState>) => void;
  setPartnerBvgState: React.Dispatch<React.SetStateAction<BvgOverrideState>>;
  pillar3aOverrideState: Record<string, Pillar3aAccountOverrideState>;
  partnerPillar3aOverrideState: Record<string, Pillar3aAccountOverrideState>;
  updatePillar3aOverride: (
    accountId: string,
    patch: Partial<Pillar3aAccountOverrideState>,
  ) => void;
  updatePartnerPillar3aOverride: (
    accountId: string,
    patch: Partial<Pillar3aAccountOverrideState>,
  ) => void;
  useRetirementAgeOverride: boolean;
  setUseRetirementAgeOverride: (v: boolean) => void;
  retirementAgeOverride: number;
  setRetirementAgeOverride: (v: number) => void;
  usePartnerRetirementOverride: boolean;
  setUsePartnerRetirementOverride: (v: boolean) => void;
  partnerRetirementAgeOverride: number;
  setPartnerRetirementAgeOverride: (v: number) => void;
  useWorkloadOverride: boolean;
  setUseWorkloadOverride: (v: boolean) => void;
  workloadReductions: WorkloadReduction[];
  setWorkloadReductions: (v: WorkloadReduction[]) => void;
  usePartnerWorkloadOverride: boolean;
  setUsePartnerWorkloadOverride: (v: boolean) => void;
  partnerWorkloadReductions: WorkloadReduction[];
  setPartnerWorkloadReductions: (v: WorkloadReduction[]) => void;
  resolvedPrimaryWorkload: WorkloadReduction[];
  resolvedPartnerWorkload: WorkloadReduction[];
  useFreeAssetsValueOverride: boolean;
  setUseFreeAssetsValueOverride: (v: boolean) => void;
  freeAssetsValueOverride: string;
  handleFreeAssetsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  useFreeAssetsReturnOverride: boolean;
  setUseFreeAssetsReturnOverride: (v: boolean) => void;
  freeAssetsReturnOverride: number;
  setFreeAssetsReturnOverride: (v: number) => void;
  PercentInput: React.ComponentType<{
    value: number;
    onChange: (v: number) => void;
  }>;
};

export function ScenarioFormTabs(props: ScenarioFormTabsProps) {
  const {
    initialScenario,
    name,
    setName,
    description,
    setDescription,
    inheritanceDrafts,
    setInheritanceDrafts,
    isCouple,
    partnerProfile,
    profile,
    household,
    result,
    partnerResult,
    householdResult,
    baseResult,
    effectiveRetirementAge,
    hasPillar3aChart,
    pensionIncomeSourceCount,
    profileFreeAssetsReturnPercent,
    profileDefaults,
    partnerProfileDefaults,
    profileBvgPensionStart,
    partnerBvgPensionStart,
    currentAge,
    partnerCurrentAge,
    ahvReferenceAge,
    ahvEarliestAge,
    partnerAhvReferenceAge,
    partnerAhvEarliestAge,
    primaryAhvState,
    partnerAhvState,
    updatePrimaryAhv,
    setPartnerAhvState,
    primaryBvgState,
    partnerBvgState,
    updatePrimaryBvg,
    setPartnerBvgState,
    pillar3aOverrideState,
    partnerPillar3aOverrideState,
    updatePillar3aOverride,
    updatePartnerPillar3aOverride,
    useRetirementAgeOverride,
    setUseRetirementAgeOverride,
    retirementAgeOverride,
    setRetirementAgeOverride,
    usePartnerRetirementOverride,
    setUsePartnerRetirementOverride,
    partnerRetirementAgeOverride,
    setPartnerRetirementAgeOverride,
    useWorkloadOverride,
    setUseWorkloadOverride,
    workloadReductions,
    setWorkloadReductions,
    usePartnerWorkloadOverride,
    setUsePartnerWorkloadOverride,
    partnerWorkloadReductions,
    setPartnerWorkloadReductions,
    resolvedPrimaryWorkload,
    resolvedPartnerWorkload,
    useFreeAssetsValueOverride,
    setUseFreeAssetsValueOverride,
    freeAssetsValueOverride,
    handleFreeAssetsChange,
    useFreeAssetsReturnOverride,
    setUseFreeAssetsReturnOverride,
    freeAssetsReturnOverride,
    setFreeAssetsReturnOverride,
    PercentInput,
  } = props;

  const personsContent = (
    <HouseholdSplitLayout
      planningMode={isCouple ? "couple" : "single"}
      left={
        <ScenarioPersonPanel
          person="primary"
          profile={profile}
          useRetirementOverride={useRetirementAgeOverride}
          onUseRetirementOverride={setUseRetirementAgeOverride}
          retirementAgeOverride={retirementAgeOverride}
          onRetirementAgeOverride={setRetirementAgeOverride}
          useWorkloadOverride={useWorkloadOverride}
          onUseWorkloadOverride={setUseWorkloadOverride}
          workloadReductions={workloadReductions}
          onWorkloadReductions={setWorkloadReductions}
        />
      }
      right={
        isCouple && partnerProfile ? (
          <ScenarioPersonPanel
            person="partner"
            profile={partnerProfile}
            useRetirementOverride={usePartnerRetirementOverride}
            onUseRetirementOverride={setUsePartnerRetirementOverride}
            retirementAgeOverride={partnerRetirementAgeOverride}
            onRetirementAgeOverride={setPartnerRetirementAgeOverride}
            useWorkloadOverride={usePartnerWorkloadOverride}
            onUseWorkloadOverride={setUsePartnerWorkloadOverride}
            workloadReductions={partnerWorkloadReductions}
            onWorkloadReductions={setPartnerWorkloadReductions}
          />
        ) : undefined
      }
    />
  );

  const ahvContent =
    isCouple && partnerProfile ? (
      <HouseholdSplitLayout
        planningMode="couple"
        left={
          <ScenarioAhvSection
            embedded
            person="primary"
            profile={profile}
            ahvReferenceAge={ahvReferenceAge}
            ahvEarliestAge={ahvEarliestAge}
            state={primaryAhvState}
            onChange={updatePrimaryAhv}
            hideRetirementOverride
          />
        }
        right={
          <ScenarioAhvSection
            embedded
            person="partner"
            profile={partnerProfile}
            ahvReferenceAge={partnerAhvReferenceAge}
            ahvEarliestAge={partnerAhvEarliestAge}
            state={partnerAhvState}
            onChange={(patch) =>
              setPartnerAhvState((prev) => ({ ...prev, ...patch }))
            }
            hideRetirementOverride
          />
        }
      />
    ) : (
      <ScenarioAhvSection
        embedded
        person="primary"
        profile={profile}
        ahvReferenceAge={ahvReferenceAge}
        ahvEarliestAge={ahvEarliestAge}
        state={primaryAhvState}
        onChange={updatePrimaryAhv}
      />
    );

  const bvgContent =
    isCouple && partnerProfile && partnerResult && partnerProfileDefaults ? (
      <HouseholdSplitLayout
        planningMode="couple"
        left={
          <ScenarioBvgSection
            embedded
            person="primary"
            profile={profile}
            result={result.bvg}
            profileDefaults={profileDefaults}
            profileBvgPensionStart={profileBvgPensionStart}
            currentAge={currentAge}
            state={primaryBvgState}
            onChange={updatePrimaryBvg}
          />
        }
        right={
          <ScenarioBvgSection
            embedded
            person="partner"
            profile={partnerProfile}
            result={partnerResult.bvg}
            profileDefaults={partnerProfileDefaults}
            profileBvgPensionStart={partnerBvgPensionStart}
            currentAge={partnerCurrentAge}
            state={partnerBvgState}
            onChange={(patch) =>
              setPartnerBvgState((prev) => ({ ...prev, ...patch }))
            }
          />
        }
      />
    ) : (
      <ScenarioBvgSection
        embedded
        person="primary"
        profile={profile}
        result={result.bvg}
        profileDefaults={profileDefaults}
        profileBvgPensionStart={profileBvgPensionStart}
        currentAge={currentAge}
        state={primaryBvgState}
        onChange={updatePrimaryBvg}
      />
    );

  const pillar3aContent =
    isCouple && partnerProfile && partnerResult ? (
      <HouseholdSplitLayout
        planningMode="couple"
        left={
          <ScenarioPillar3aSection
            embedded
            person="primary"
            profile={profile}
            result={result.pillar3a}
            overrideState={pillar3aOverrideState}
            onChange={updatePillar3aOverride}
          />
        }
        right={
          <ScenarioPillar3aSection
            embedded
            person="partner"
            profile={partnerProfile}
            result={partnerResult.pillar3a}
            overrideState={partnerPillar3aOverrideState}
            onChange={updatePartnerPillar3aOverride}
          />
        }
      />
    ) : (
      <ScenarioPillar3aSection
        embedded
        profile={profile}
        result={result.pillar3a}
        overrideState={pillar3aOverrideState}
        onChange={updatePillar3aOverride}
      />
    );

  return (
    <SectionTabs
      defaultValue="basics"
      tabs={[
        {
          value: "basics",
          label: "Grundlagen",
          description:
            "Szenarien übernehmen Ihre Stammdaten. Nur bei bewussten What-if-Abweichungen pro Säule anpassen.",
          content: (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="scenario-name">Name</Label>
                <Input
                  id="scenario-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Frühpensionierung mit 62"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scenario-desc">Beschreibung (optional)</Label>
                <Input
                  id="scenario-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kurze Beschreibung …"
                />
              </div>
              {!initialScenario?.id ? (
                <p className="text-sm text-muted-foreground">
                  Neues Szenario — Stammdaten werden automatisch übernommen.
                </p>
              ) : null}
            </div>
          ),
        },
        {
          value: "persons",
          label: "Personen",
          description: isCouple
            ? "Erwerbsaufgabe und Arbeitspensum pro Person — überschreibbar gegenüber Stammdaten."
            : "Erwerbsaufgabe und Arbeitspensum — überschreibbar gegenüber Stammdaten.",
          content: personsContent,
        },
        {
          value: "ahv",
          label: "AHV",
          description: isCouple
            ? "AHV-Annahmen pro Person. Erwerbsaufgabe unter «Personen»."
            : "Rentenbeginn und Einkommen aus dem Profil — optional überschreibbar.",
          content: ahvContent,
        },
        {
          value: "bvg",
          label: "BVG",
          description:
            "Kapitalbezug, UWS, Zinssatz und Gutschriften — optional vom Profil abweichend.",
          content: bvgContent,
        },
        {
          value: "pillar3a",
          label: "3a",
          description:
            "Gestaffelter Bezug pro Person und Konto. Auto-Split-Schwellenwert aus Stammdaten.",
          content: pillar3aContent,
        },
        {
          value: "pillar3a-chart",
          label: "3a-Entwicklung",
          description: isCouple
            ? "Kapitalentwicklung beider Personen bis Planungshorizont"
            : "Projektion pro Konto bis zur Pensionierung",
          hidden: !hasPillar3aChart,
          content: (
            <div className="rounded-lg border bg-muted/20 p-4">
              {isCouple && partnerResult && household ? (
                <HouseholdPillar3aChart
                  primary={result.pillar3a}
                  partner={partnerResult.pillar3a}
                  primaryBirthDate={profile.birthDate}
                  partnerBirthDate={partnerProfile?.birthDate}
                  primaryHorizonAge={profile.planningHorizonAge ?? 95}
                  partnerHorizonAge={partnerProfile?.planningHorizonAge ?? 95}
                />
              ) : (
                <Pillar3aProjectionChart result={result.pillar3a} />
              )}
            </div>
          ),
        },
        {
          value: "free-assets",
          label: "Vermögen",
          description:
            "Freies Vermögen: Verzinsung bis Pensionierung, danach Entnahmen abzgl. Renten.",
          content: (
            <>
              <ProfileInheritanceNote>
                Startvermögen und Rendite werden aus dem Profil übernommen. Nur bei
                Abweichungen die entsprechende Checkbox aktivieren.
              </ProfileInheritanceNote>
              <ProfileDefaultsPanel>
                <ProfileDefaultItem
                  label="Freies Vermögen"
                  value={formatCHF(profile.freeAssets)}
                />
                <ProfileDefaultItem
                  label="Erwartete Rendite"
                  value={`${profileFreeAssetsReturnPercent} %`}
                />
              </ProfileDefaultsPanel>
              <ScenarioAdjustmentsHeading />
              <ScenarioOverrideRow
                id="use-free-assets-value"
                checked={useFreeAssetsValueOverride}
                onCheckedChange={setUseFreeAssetsValueOverride}
                label="Vermögensbetrag vom Profil abweichen"
                profileValue={formatCHF(profile.freeAssets)}
              >
                <ChfStepperInput
                  className="w-52"
                  value={freeAssetsValueOverride}
                  onChange={handleFreeAssetsChange}
                  step={CHF_STEP.wealth}
                  ariaLabel="Freies Vermögen"
                />
              </ScenarioOverrideRow>
              <ScenarioOverrideRow
                id="use-free-assets-return"
                checked={useFreeAssetsReturnOverride}
                onCheckedChange={setUseFreeAssetsReturnOverride}
                label="Rendite vom Profil abweichen"
                profileValue={`${profileFreeAssetsReturnPercent} %`}
              >
                <PercentInput
                  value={freeAssetsReturnOverride}
                  onChange={setFreeAssetsReturnOverride}
                />
              </ScenarioOverrideRow>
            </>
          ),
        },
        {
          value: "inheritance",
          label: "Erbschaft",
          description:
            "Einmaliger Vermögenszufluss ins freie Haushaltsvermögen. Alter bezieht sich auf Person 1.",
          content: (
            <InheritanceEventsCard
              events={inheritanceDrafts}
              onChange={setInheritanceDrafts}
            />
          ),
        },
        {
          value: "results",
          label: "Ergebnisse",
          description: `Einkommen im Alter und Rentenvorschau · Erwerbsaufgabe ${effectiveRetirementAge} J.`,
          content: (
            <div className="space-y-8">
              {pensionIncomeSourceCount > 1 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Einkommensverteilung</h3>
                  <PensionIncomeChart result={result} />
                </div>
              ) : null}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Einkommen im Alter</h3>
                <VorsorgeIncomeTimelineChart
                  primary={result}
                  partner={partnerResult}
                  primaryBirthDate={profile.birthDate}
                  partnerBirthDate={partnerProfile?.birthDate}
                  planningHorizonAge={profile.planningHorizonAge ?? 95}
                  partnerPlanningHorizonAge={
                    partnerProfile?.planningHorizonAge ?? undefined
                  }
                />
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Rentenvorschau</h3>
                {householdResult ? (
                  <HouseholdPensionSummary result={householdResult} />
                ) : (
                  <PensionSummary
                    result={result}
                    baseMonthlyTotal={baseResult.summary.monthlyTotalAtHorizon}
                    retirementAge={effectiveRetirementAge}
                  />
                )}
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}

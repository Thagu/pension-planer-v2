"use client";

import { WorkloadReductionFields } from "@/components/shared/workload-reduction-fields";
import {
  ProfileDefaultItem,
  ProfileDefaultsPanel,
  ProfileInheritanceNote,
  ScenarioAdjustmentsHeading,
  ScenarioOverrideRow,
} from "@/components/scenarios/scenario-profile-ui";
import { NUM_STEP } from "@/components/shared/numeric-steps";
import { NumberStepperInput } from "@/components/shared/stepper-inputs";
import {
  formatCHF,
  formatWorkloadReductions,
  type ProfileForScenario,
} from "@/lib/engine";

export function ScenarioPersonPanel({
  person,
  profile,
  useRetirementOverride,
  onUseRetirementOverride,
  retirementAgeOverride,
  onRetirementAgeOverride,
  useWorkloadOverride,
  onUseWorkloadOverride,
  workloadReductions,
  onWorkloadReductions,
}: {
  person: "primary" | "partner";
  profile: ProfileForScenario;
  useRetirementOverride: boolean;
  onUseRetirementOverride: (value: boolean) => void;
  retirementAgeOverride: number;
  onRetirementAgeOverride: (value: number) => void;
  useWorkloadOverride: boolean;
  onUseWorkloadOverride: (value: boolean) => void;
  workloadReductions: import("@/lib/engine/workload").WorkloadReduction[];
  onWorkloadReductions: (
    value: import("@/lib/engine/workload").WorkloadReduction[],
  ) => void;
}) {
  const prefix = person === "partner" ? "partner-" : "";

  return (
    <div className="space-y-5">
      <ProfileInheritanceNote>
        Standardwerte aus den Stammdaten{person === "partner" ? " des Partners" : ""}.
      </ProfileInheritanceNote>

      <ProfileDefaultsPanel>
        <ProfileDefaultItem
          label="Erwerbsaufgabe"
          value={`${profile.retirementAge} Jahre`}
        />
        <ProfileDefaultItem
          label="Bruttojahreslohn"
          value={formatCHF(profile.currentSalaryBrutto)}
        />
        <ProfileDefaultItem
          label="Freies Vermögen"
          value={formatCHF(profile.freeAssets)}
        />
        <ProfileDefaultItem
          label="Arbeitspensum"
          value={formatWorkloadReductions(profile.workloadReductions ?? [])}
          detail="Reduziert Lohn, BVG- und 3a-Beiträge sowie Sparquote proportional zum Pensum."
        />
      </ProfileDefaultsPanel>

      <ScenarioAdjustmentsHeading />

      <ScenarioOverrideRow
        id={`${prefix}use-retirement-override`}
        checked={useRetirementOverride}
        onCheckedChange={onUseRetirementOverride}
        label="Erwerbsaufgabe vom Profil abweichen"
        profileValue={`${profile.retirementAge} Jahre`}
      >
        <NumberStepperInput
          min={58}
          max={70}
          className="w-40"
          value={retirementAgeOverride}
          onChange={(e) =>
            onRetirementAgeOverride(parseInt(e.target.value, 10) || profile.retirementAge)
          }
          step={NUM_STEP.age}
          ariaLabel="Erwerbsaufgabe"
        />
      </ScenarioOverrideRow>

      <ScenarioOverrideRow
        id={`${prefix}use-workload-override`}
        checked={useWorkloadOverride}
        onCheckedChange={onUseWorkloadOverride}
        label="Arbeitspensum vom Profil abweichen"
        profileValue={formatWorkloadReductions(profile.workloadReductions ?? [])}
      >
        <WorkloadReductionFields
          idPrefix={`${prefix}scenario`}
          namePrefix={
            person === "partner" ? "partnerWorkloadReduction" : "workloadReduction"
          }
          reductions={workloadReductions}
          onChange={(next) => {
            onUseWorkloadOverride(true);
            onWorkloadReductions(next);
          }}
        />
      </ScenarioOverrideRow>
    </div>
  );
}

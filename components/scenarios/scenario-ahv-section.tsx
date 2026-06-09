"use client";

import { ShieldCheck } from "lucide-react";

import {
  ProfileDefaultItem,
  ProfileDefaultsPanel,
  ProfileInheritanceNote,
  ScenarioAdjustmentsHeading,
  ScenarioOverrideRow,
} from "@/components/scenarios/scenario-profile-ui";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Label } from "@/components/ui/label";
import { CHF_STEP, NUM_STEP } from "@/components/shared/numeric-steps";
import {
  ChfStepperInput,
  NumberStepperInput,
} from "@/components/shared/stepper-inputs";
import {
  formatCHF,
  formatAhvReferenceAge,
  type ProfileForScenario,
  type ScenarioOverrides,
} from "@/lib/engine";
import { formatSwissNumber, parseSwissNumber } from "@/lib/format/numbers";
import {
  PERSON1_COLOR,
  PERSON2_COLOR,
  personLabel,
} from "@/lib/household/person-colors";

export type AhvOverrideState = {
  useRetirementOverride: boolean;
  retirementAgeOverride: number;
  useAhvPensionStartOverride: boolean;
  ahvPensionStartOverride: number;
  useMissingYears: boolean;
  missingContributionYears: number;
  useIncomeOverride: boolean;
  averageIncomeOverride: string;
};

type Props = {
  person: "primary" | "partner";
  profile: ProfileForScenario;
  ahvReferenceAge: number;
  ahvEarliestAge: number;
  state: AhvOverrideState;
  onChange: (patch: Partial<AhvOverrideState>) => void;
  embedded?: boolean;
  /** Im Paarmodus liegt Erwerbsaufgabe in «Personen & Pensionierung» */
  hideRetirementOverride?: boolean;
};

function AhvSectionBody({
  person,
  profile,
  ahvReferenceAge,
  ahvEarliestAge,
  state,
  onChange,
  hideRetirementOverride = false,
}: Omit<Props, "embedded">) {
  const prefix = person === "partner" ? "partner-" : "";

  const handleIncomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseSwissNumber(e.target.value);
    onChange({ averageIncomeOverride: formatSwissNumber(parsed) });
  };

  return (
    <div className="space-y-5">
      <ProfileInheritanceNote>
        AHV-Werte stammen aus den Stammdaten
        {person === "partner" ? " des Partners" : ""}. Die Rente startet am
        Referenzalter, nicht automatisch bei Erwerbsaufgabe.
      </ProfileInheritanceNote>

      <ProfileDefaultsPanel>
        {!hideRetirementOverride ? (
          <ProfileDefaultItem
            label="Erwerbsaufgabe"
            value={`${profile.retirementAge} Jahre`}
          />
        ) : null}
        <ProfileDefaultItem
          label="AHV-Bezugsalter"
          value={formatAhvReferenceAge(ahvReferenceAge)}
          detail={`Vorbezug frühestens ab ${ahvEarliestAge} J.`}
        />
        <ProfileDefaultItem
          label="Durchschnittseinkommen"
          value={formatCHF(profile.currentSalaryBrutto)}
        />
        <ProfileDefaultItem label="Fehlende Beitragsjahre" value="0" />
      </ProfileDefaultsPanel>

      <ScenarioAdjustmentsHeading />

      {!hideRetirementOverride ? (
        <ScenarioOverrideRow
          id={`${prefix}use-retirement-override`}
          checked={state.useRetirementOverride}
          onCheckedChange={(v) => onChange({ useRetirementOverride: v })}
          label="Erwerbsaufgabe vom Profil abweichen"
          profileValue={`${profile.retirementAge} Jahre`}
        >
          <NumberStepperInput
            min={58}
            max={70}
            className="w-40"
            value={state.retirementAgeOverride}
            onChange={(e) =>
              onChange({
                retirementAgeOverride:
                  parseInt(e.target.value, 10) || profile.retirementAge,
              })
            }
            step={NUM_STEP.age}
            ariaLabel="Erwerbsaufgabe"
          />
        </ScenarioOverrideRow>
      ) : null}

      <ScenarioOverrideRow
        id={`${prefix}use-ahv-pension-start`}
        checked={state.useAhvPensionStartOverride}
        onCheckedChange={(v) => onChange({ useAhvPensionStartOverride: v })}
        label="AHV-Bezugsalter vom Profil abweichen"
        profileValue={formatAhvReferenceAge(ahvReferenceAge)}
      >
        <NumberStepperInput
          min={ahvEarliestAge}
          max={70}
          className="w-40"
          value={state.ahvPensionStartOverride}
          onChange={(e) =>
            onChange({
              ahvPensionStartOverride:
                parseInt(e.target.value, 10) || Math.round(ahvReferenceAge),
            })
          }
          step={NUM_STEP.age}
          ariaLabel="AHV-Bezugsalter"
        />
      </ScenarioOverrideRow>

      <ScenarioOverrideRow
        id={`${prefix}use-missing-years`}
        checked={state.useMissingYears}
        onCheckedChange={(v) => onChange({ useMissingYears: v })}
        label="Fehlende Beitragsjahre angeben"
        profileValue="0 Jahre"
      >
        <NumberStepperInput
          min={0}
          max={20}
          className="w-40"
          value={state.missingContributionYears}
          onChange={(e) =>
            onChange({
              missingContributionYears: Math.max(
                0,
                parseInt(e.target.value, 10) || 0,
              ),
            })
          }
          step={NUM_STEP.age}
          ariaLabel="Fehlende Beitragsjahre"
        />
      </ScenarioOverrideRow>

      <ScenarioOverrideRow
        id={`${prefix}use-income-override`}
        checked={state.useIncomeOverride}
        onCheckedChange={(v) => onChange({ useIncomeOverride: v })}
        label="Anderes Durchschnittseinkommen"
        profileValue={formatCHF(profile.currentSalaryBrutto)}
      >
        <ChfStepperInput
          className="w-52"
          value={state.averageIncomeOverride}
          onChange={handleIncomeChange}
          step={CHF_STEP.income}
          placeholder="120'000"
          ariaLabel="Durchschnittseinkommen"
        />
      </ScenarioOverrideRow>
    </div>
  );
}

export function ScenarioAhvSection({
  person,
  profile,
  ahvReferenceAge,
  ahvEarliestAge,
  state,
  onChange,
  embedded = false,
  hideRetirementOverride = false,
}: Props) {
  const accentColor = person === "partner" ? PERSON2_COLOR : PERSON1_COLOR;

  if (embedded) {
    return (
      <AhvSectionBody
        person={person}
        profile={profile}
        ahvReferenceAge={ahvReferenceAge}
        ahvEarliestAge={ahvEarliestAge}
        state={state}
        onChange={onChange}
        hideRetirementOverride={hideRetirementOverride}
      />
    );
  }

  return (
    <CollapsibleCard
      title={`AHV (1. Säule) · ${personLabel(person)}`}
      description="Rentenbeginn und Einkommen aus dem Profil — optional überschreibbar."
      icon={<ShieldCheck className="h-5 w-5" style={{ color: accentColor }} />}
    >
        <AhvSectionBody
          person={person}
          profile={profile}
          ahvReferenceAge={ahvReferenceAge}
          ahvEarliestAge={ahvEarliestAge}
          state={state}
          onChange={onChange}
          hideRetirementOverride={hideRetirementOverride}
        />
    </CollapsibleCard>
  );
}

export function ahvOverridesFromState(
  state: AhvOverrideState,
  options?: { skipRetirement?: boolean },
): ScenarioOverrides["ahv"] {
  const income = state.useIncomeOverride
    ? parseSwissNumber(state.averageIncomeOverride)
    : null;

  return {
    employmentEndAgeOverride:
      !options?.skipRetirement && state.useRetirementOverride
        ? state.retirementAgeOverride
        : null,
    retirementAgeOverride:
      !options?.skipRetirement && state.useRetirementOverride
        ? state.retirementAgeOverride
        : null,
    pensionStartAgeOverride: state.useAhvPensionStartOverride
      ? state.ahvPensionStartOverride
      : null,
    missingContributionYears: state.useMissingYears
      ? state.missingContributionYears
      : 0,
    averageIncomeOverride: state.useIncomeOverride ? income : null,
  };
}

export function buildInitialAhvState(
  profile: ProfileForScenario,
  saved?: ScenarioOverrides["ahv"],
  ahvReferenceAge?: number,
): AhvOverrideState {
  return {
    useRetirementOverride:
      saved?.employmentEndAgeOverride != null ||
      saved?.retirementAgeOverride != null,
    retirementAgeOverride:
      saved?.employmentEndAgeOverride ??
      saved?.retirementAgeOverride ??
      profile.retirementAge,
    useAhvPensionStartOverride: saved?.pensionStartAgeOverride != null,
    ahvPensionStartOverride:
      saved?.pensionStartAgeOverride ?? Math.round(ahvReferenceAge ?? 65),
    useMissingYears: (saved?.missingContributionYears ?? 0) > 0,
    missingContributionYears: saved?.missingContributionYears ?? 0,
    useIncomeOverride: saved?.averageIncomeOverride != null,
    averageIncomeOverride: formatSwissNumber(saved?.averageIncomeOverride),
  };
}

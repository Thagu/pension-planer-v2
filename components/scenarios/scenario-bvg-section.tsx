"use client";

import { Building2 } from "lucide-react";

import { BvgContributionChart } from "@/components/scenarios/bvg-contribution-chart";
import {
  ProfileDefaultItem,
  ProfileDefaultsPanel,
  ProfileInheritanceNote,
  ScenarioAdjustmentsHeading,
  ScenarioOverrideRow,
} from "@/components/scenarios/scenario-profile-ui";
import { isBvgContributionBucketRelevant } from "@/lib/bvg/contribution-buckets";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Label } from "@/components/ui/label";
import { NUM_STEP } from "@/components/shared/numeric-steps";
import {
  NumberStepperInput,
  PercentStepperNumberInput,
} from "@/components/shared/stepper-inputs";
import {
  BVG_CONTRIBUTION_BUCKETS,
  BVG_CONTRIBUTION_RATES,
  BVG_EARLIEST_PENSION_AGE,
  BVG_GUIDANCE_MAX_CAPITAL_WITHDRAWAL,
  BVG_MAX_CAPITAL_WITHDRAWAL_TRANCHES,
  formatCHF,
  type BvgResult,
  type ProfileForScenario,
} from "@/lib/engine";
import { formatRatePercent, formatPercentOneDecimal } from "@/lib/format/numbers";
import {
  PERSON1_COLOR,
  PERSON2_COLOR,
  personLabel,
} from "@/lib/household/person-colors";

export type BvgOverrideState = {
  useBvgPensionStartOverride: boolean;
  bvgPensionStartOverride: number;
  useConversionRateOverride: boolean;
  conversionRateOverride: number;
  useInterestRateOverride: boolean;
  interestRateOverride: number;
  useCoordDeductionOverride: boolean;
  coordDeductionMode: "standard" | "none" | "custom";
  useContributionRatesOverride: boolean;
  contributionRates: Record<string, number>;
  capitalWithdrawalPercent: number;
  capitalWithdrawalTranches: number;
};

type Props = {
  person: "primary" | "partner";
  profile: ProfileForScenario;
  result: BvgResult;
  profileDefaults: {
    conversionPercent: number;
    interestPercent: number;
    contributionRates: Record<string, number>;
  };
  profileBvgPensionStart: number;
  currentAge: number;
  state: BvgOverrideState;
  onChange: (patch: Partial<BvgOverrideState>) => void;
  embedded?: boolean;
  showCapitalDecision?: boolean;
};

function PercentInput({
  value,
  onChange,
  step = 0.1,
  max = 100,
  disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max?: number;
  disabled?: boolean;
}) {
  const roundToStep = (v: number) => Math.round(v / step) * step;
  return (
    <PercentStepperNumberInput
      value={value}
      onChange={(v) => {
        if (disabled) return;
        onChange(Math.min(max, Math.max(0, roundToStep(v))));
      }}
      step={step}
      max={max}
      disabled={disabled}
    />
  );
}

function BvgSectionBody({
  person,
  profile,
  result,
  profileDefaults,
  profileBvgPensionStart,
  currentAge,
  state,
  onChange,
  showCapitalDecision = true,
}: Omit<Props, "embedded">) {
  const prefix = person === "partner" ? "partner-" : "";
  const accentColor = person === "partner" ? PERSON2_COLOR : PERSON1_COLOR;

  return (
    <div className="space-y-5">
      <ProfileInheritanceNote>
        BVG-Annahmen werden aus den Stammdaten
        {person === "partner" ? " des Partners" : ""} übernommen.
      </ProfileInheritanceNote>

      <ProfileDefaultsPanel>
        <ProfileDefaultItem
          label="Aktuelles BVG-Kapital"
          value={formatCHF(profile.bvgCurrentCapital)}
        />
        <ProfileDefaultItem
          label="BVG-Leistungsbeginn"
          value={`${profileBvgPensionStart} Jahre`}
          detail={`Erwerbsaufgabe ${profile.retirementAge} J., min. ${BVG_EARLIEST_PENSION_AGE} J.`}
        />
        <ProfileDefaultItem
          label="Umwandlungssatz (UWS)"
          value={`${profileDefaults.conversionPercent} %`}
        />
        <ProfileDefaultItem
          label="Zinssatz"
          value={`${profileDefaults.interestPercent} %`}
        />
        <ProfileDefaultItem label="Koordinationsabzug" value="Standard" />
        <ProfileDefaultItem
          label="Altersgutschriften"
          value="Gemäss Stammdaten"
          detail={BVG_CONTRIBUTION_BUCKETS.map(
            (bucket) =>
              `${bucket.label}: ${formatPercentOneDecimal(
                profileDefaults.contributionRates[bucket.key] ??
                  BVG_CONTRIBUTION_RATES[bucket.key] * 100,
              )}`,
          ).join(" · ")}
        />
      </ProfileDefaultsPanel>

      {result.interestRate != null ? (
        <p className="text-xs text-muted-foreground">
          Aktive Berechnung: Zinssatz {formatRatePercent(result.interestRate)} ·
          UWS {formatRatePercent(result.conversionRate, 1)}
        </p>
      ) : null}

      <ScenarioAdjustmentsHeading />

      <ScenarioOverrideRow
        id={`${prefix}use-bvg-pension-start`}
        checked={state.useBvgPensionStartOverride}
        onCheckedChange={(v) => onChange({ useBvgPensionStartOverride: v })}
        label="BVG-Leistungsbeginn vom Profil abweichen"
        profileValue={`${profileBvgPensionStart} Jahre`}
      >
        <NumberStepperInput
          min={BVG_EARLIEST_PENSION_AGE}
          max={70}
          className="w-40"
          value={state.bvgPensionStartOverride}
          onChange={(e) =>
            onChange({
              bvgPensionStartOverride:
                parseInt(e.target.value, 10) || BVG_EARLIEST_PENSION_AGE,
            })
          }
          step={NUM_STEP.age}
          ariaLabel="BVG-Leistungsbeginn"
        />
      </ScenarioOverrideRow>

      <ScenarioOverrideRow
        id={`${prefix}use-conversion-override`}
        checked={state.useConversionRateOverride}
        onCheckedChange={(v) => onChange({ useConversionRateOverride: v })}
        label="Umwandlungssatz vom Profil abweichen"
        profileValue={`${profileDefaults.conversionPercent} %`}
      >
        <PercentInput
          value={state.conversionRateOverride}
          onChange={(v) => onChange({ conversionRateOverride: v })}
        />
      </ScenarioOverrideRow>

      <ScenarioOverrideRow
        id={`${prefix}use-interest-override`}
        checked={state.useInterestRateOverride}
        onCheckedChange={(v) => onChange({ useInterestRateOverride: v })}
        label="Zinssatz vom Profil abweichen"
        profileValue={`${profileDefaults.interestPercent} %`}
      >
        <PercentInput
          value={state.interestRateOverride}
          onChange={(v) => onChange({ interestRateOverride: v })}
          step={0.25}
        />
      </ScenarioOverrideRow>

      <ScenarioOverrideRow
        id={`${prefix}use-coord-override`}
        checked={state.useCoordDeductionOverride}
        onCheckedChange={(v) => {
          onChange({
            useCoordDeductionOverride: v,
            coordDeductionMode: v ? state.coordDeductionMode : "standard",
          });
        }}
        label="Koordinationsabzug vom Profil abweichen"
        profileValue="Standard (Koordinationsabzug)"
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={state.coordDeductionMode === "none"}
            onChange={() => onChange({ coordDeductionMode: "none" })}
          />
          Kein Abzug (voller Lohn versichert)
        </label>
      </ScenarioOverrideRow>

      <ScenarioOverrideRow
        id={`${prefix}use-contribution-rates`}
        checked={state.useContributionRatesOverride}
        onCheckedChange={(v) => onChange({ useContributionRatesOverride: v })}
        label="Altersgutschriften vom Profil abweichen"
        profileValue="Gemäss Stammdaten"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BVG_CONTRIBUTION_BUCKETS.map((bucket) => {
            const relevant = isBvgContributionBucketRelevant(bucket, currentAge);
            return (
              <div
                key={bucket.key}
                className={`space-y-1 ${relevant ? "" : "opacity-40"}`}
              >
                <Label className="text-xs text-muted-foreground">
                  {bucket.label}
                </Label>
                <PercentInput
                  value={
                    state.contributionRates[bucket.key] ??
                    BVG_CONTRIBUTION_RATES[bucket.key] * 100
                  }
                  onChange={(v) =>
                    onChange({
                      contributionRates: {
                        ...state.contributionRates,
                        [bucket.key]: v,
                      },
                    })
                  }
                  step={0.25}
                  disabled={!relevant}
                />
              </div>
            );
          })}
        </div>
      </ScenarioOverrideRow>

      {showCapitalDecision ? (
        <div className="space-y-4 border-t border-border/50 pt-5">
          <div>
            <Label>Kapitalbezug vs. Rente (BVG)</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Szenariospezifisch · max. oft{" "}
              {BVG_GUIDANCE_MAX_CAPITAL_WITHDRAWAL * 100} % auszahlbar
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <Label className="text-xs">Kapitalbezug</Label>
              <PercentInput
                value={state.capitalWithdrawalPercent}
                onChange={(v) => onChange({ capitalWithdrawalPercent: v })}
                max={100}
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">
                Tranchen (1–{BVG_MAX_CAPITAL_WITHDRAWAL_TRANCHES})
              </Label>
              <NumberStepperInput
                min={1}
                max={BVG_MAX_CAPITAL_WITHDRAWAL_TRANCHES}
                className="w-32"
                value={state.capitalWithdrawalTranches}
                onChange={(e) =>
                  onChange({
                    capitalWithdrawalTranches: Math.min(
                      BVG_MAX_CAPITAL_WITHDRAWAL_TRANCHES,
                      Math.max(1, parseInt(e.target.value, 10) || 1),
                    ),
                  })
                }
                step={1}
                ariaLabel="Kapitalbezug Tranchen"
              />
            </div>
          </div>
        </div>
      ) : null}

      {result.projection.length > 0 ? (
        <div className="rounded-lg border bg-muted/20 p-4">
          <BvgContributionChart
            projection={result.projection}
            accentColor={accentColor}
            personLabel={personLabel(person)}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ScenarioBvgSection(props: Props) {
  const accentColor =
    props.person === "partner" ? PERSON2_COLOR : PERSON1_COLOR;

  if (props.embedded) {
    return <BvgSectionBody {...props} />;
  }

  return (
    <CollapsibleCard
      title={`BVG (2. Säule) · ${personLabel(props.person)}`}
      description="Kapital, Zinssatz, Umwandlung und Gutschriften aus den Stammdaten — optional überschreibbar."
      icon={<Building2 className="h-5 w-5" style={{ color: accentColor }} />}
    >
        <BvgSectionBody {...props} />
    </CollapsibleCard>
  );
}

export function bvgOverridesFromState(
  state: BvgOverrideState,
): import("@/lib/engine").ScenarioOverrides["bvg"] {
  return {
    pensionStartAgeOverride: state.useBvgPensionStartOverride
      ? state.bvgPensionStartOverride
      : null,
    conversionRateOverride: state.useConversionRateOverride
      ? state.conversionRateOverride
      : null,
    interestRateOverride: state.useInterestRateOverride
      ? state.interestRateOverride
      : null,
    coordinationDeductionMode: state.useCoordDeductionOverride
      ? state.coordDeductionMode
      : null,
    customContributionRates: state.useContributionRatesOverride
      ? state.contributionRates
      : null,
    capitalWithdrawalPercent: state.capitalWithdrawalPercent,
    capitalWithdrawalTranches: state.capitalWithdrawalTranches,
  };
}

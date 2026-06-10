"use client";

import { useState } from "react";

import { WorkloadReductionFields } from "@/components/shared/workload-reduction-fields";
import { CHF_STEP, NUM_STEP } from "@/components/shared/numeric-steps";
import {
  ChfStepperField,
  NumberStepperField,
  PercentStepperInput,
  PlainChfStepperInput,
} from "@/components/shared/stepper-inputs";
import { defaultBvgContributionRatesJson } from "@/lib/bvg/default-contribution-json";
import {
  BVG_CONVERSION_RATE,
  BVG_MIN_INTEREST_RATE,
} from "@/lib/engine/constants";
import {
  decimalRateToPercent,
  decimalToPercentDisplay,
  formatSwissNumber,
  parseSwissNumber,
  formatRatePercent,
} from "@/lib/format/numbers";
import type { Pillar3aAccountRow } from "@/lib/pillar3a/accounts";
import type { PartnerProfileData } from "@/lib/household/types";
import type { WorkloadReduction } from "@/lib/engine/workload";
import { normalizeWorkloadReductions } from "@/lib/engine/workload";
import { Pillar3aAccountsEditor } from "@/components/master-data/pillar3a-accounts-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function useChfField(
  initial: number | null | undefined,
  allowZero = false,
) {
  const [value, setValue] = useState(() =>
    formatSwissNumber(initial ?? 0, allowZero),
  );
  return {
    value,
    setValue: (next: number) =>
      setValue(formatSwissNumber(next, allowZero)),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValue(formatSwissNumber(parseSwissNumber(e.target.value), allowZero)),
    onBlur: () =>
      setValue(formatSwissNumber(parseSwissNumber(value), allowZero)),
  };
}

function usePercentField(initial: number | null | undefined) {
  const [value, setValue] = useState(() => decimalToPercentDisplay(initial));
  return {
    value,
    setValue: (next: number) =>
      setValue(String(decimalRateToPercent(next)).replace(/\.?0+$/, "")),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValue(e.target.value.replace(/%/g, "")),
  };
}

export function PersonMasterFields({
  person,
  profile,
  partnerData,
  pillar3aAccounts = [],
  pillar3aDefaultReturn,
  onFieldChange,
}: {
  person: "primary" | "partner";
  profile?: {
    birth_date?: string | null;
    gender?: string | null;
    employment_start_year?: number | null;
    retirement_age?: number | null;
    current_salary_brutto?: number | null;
    bvg_current_capital?: number | null;
    free_assets?: number | null;
    bvg_interest_rate?: number | null;
    bvg_conversion_rate?: number | null;
    bvg_contribution_rates?: Record<string, number> | null;
    bvg_coordinated_salary_override?: number | null;
    free_assets_interest_rate?: number | null;
    annual_savings_to_free_assets?: number | null;
    workload_reductions?: WorkloadReduction[] | null;
  } | null;
  partnerData?: PartnerProfileData | null;
  pillar3aAccounts?: Pillar3aAccountRow[];
  pillar3aDefaultReturn?: number | null;
  onFieldChange?: () => void;
}) {
  const isPartner = person === "partner";
  const p = isPartner ? partnerData : profile;
  const field = (name: string) =>
    isPartner
      ? `partner${name.charAt(0).toUpperCase()}${name.slice(1)}`
      : name;

  const salary = useChfField(p?.current_salary_brutto as number | null);
  const bvgCapital = useChfField(p?.bvg_current_capital as number | null, true);
  const freeAssets = useChfField(p?.free_assets as number | null, true);
  const annualSavings = useChfField(
    p?.annual_savings_to_free_assets as number | null,
    true,
  );
  const bvgInterest = usePercentField(p?.bvg_interest_rate as number | null);
  const bvgConversion = usePercentField(
    p?.bvg_conversion_rate as number | null,
  );
  const freeAssetsInterest = usePercentField(
    p?.free_assets_interest_rate as number | null,
  );

  const [bvgCoordinatedSalaryValue, setBvgCoordinatedSalaryValue] = useState(() =>
    p?.bvg_coordinated_salary_override != null
      ? formatSwissNumber(p.bvg_coordinated_salary_override as number)
      : "",
  );

  const [bvgContributionJson, setBvgContributionJson] = useState(() =>
    p?.bvg_contribution_rates
      ? JSON.stringify(
          Object.fromEntries(
            Object.entries(p.bvg_contribution_rates as Record<string, number>).map(
              ([k, v]) => [k, v <= 1 ? Math.round(v * 10000) / 100 : v],
            ),
          ),
          null,
          2,
        )
      : "",
  );

  const [workloadReductions, setWorkloadReductions] = useState<WorkloadReduction[]>(
    () =>
      normalizeWorkloadReductions(
        (p?.workload_reductions as WorkloadReduction[] | null) ?? [],
      ),
  );

  const [employmentStartYear, setEmploymentStartYear] = useState(() =>
    p?.employment_start_year != null ? String(p.employment_start_year) : "",
  );
  const [retirementAge, setRetirementAge] = useState(() =>
    String((p?.retirement_age as number) ?? 65),
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="grid gap-2 xl:col-span-2">
        <Label htmlFor={field("birthDate")}>Geburtsdatum</Label>
        <Input
          id={field("birthDate")}
          name={field("birthDate")}
          type="date"
          defaultValue={(p?.birth_date as string) ?? ""}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={field("gender")}>Geschlecht</Label>
        <select
          id={field("gender")}
          name={field("gender")}
          defaultValue={(p?.gender as string) ?? ""}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Bitte wählen</option>
          <option value="male">Männlich</option>
          <option value="female">Weiblich</option>
        </select>
      </div>
      <NumberStepperField
        id={field("employmentStartYear")}
        name={field("employmentStartYear")}
        label="Jahr Erwerbsbeginn"
        value={employmentStartYear}
        onChange={(e) => setEmploymentStartYear(e.target.value)}
        step={NUM_STEP.year}
        min={1900}
        max={2100}
      />
      <NumberStepperField
        id={field("retirementAge")}
        name={field("retirementAge")}
        label="Pensionierungsalter"
        value={retirementAge}
        onChange={(e) => setRetirementAge(e.target.value)}
        step={NUM_STEP.age}
        min={58}
        max={70}
      />
      <ChfStepperField
        id={field("currentSalaryBrutto")}
        name={field("currentSalaryBrutto")}
        label="Bruttojahreslohn"
        step={CHF_STEP.income}
        {...salary}
      />
      <ChfStepperField
        id={field("bvgCurrentCapital")}
        name={field("bvgCurrentCapital")}
        label="BVG aktuelles Kapital"
        step={CHF_STEP.wealth}
        allowZero
        {...bvgCapital}
      />
      <ChfStepperField
        id={field("freeAssets")}
        name={field("freeAssets")}
        label="Freies Vermögen (aktuell)"
        step={CHF_STEP.wealth}
        allowZero
        {...freeAssets}
      />
      <ChfStepperField
        id={field("annualSavingsToFreeAssets")}
        name={field("annualSavingsToFreeAssets")}
        label="Jährliche Sparquote ins freie Vermögen"
        step={CHF_STEP.savings}
        allowZero
        {...annualSavings}
      />
      <p className="text-xs text-muted-foreground xl:col-span-2">
        Pro Person erfasst. Die Sparquote fliesst nur bis zur Erwerbsaufgabe dieser
        Person ins freie Vermögen (0 nach Pensionierung). 0 ist als Wert erlaubt.
      </p>
      <div className="grid gap-2 xl:col-span-2">
        <Label htmlFor={field("bvgCoordinatedSalaryOverride")}>
          Koordinierter Lohn (Override)
        </Label>
        <PlainChfStepperInput
          id={field("bvgCoordinatedSalaryOverride")}
          name={field("bvgCoordinatedSalaryOverride")}
          value={bvgCoordinatedSalaryValue}
          onChange={setBvgCoordinatedSalaryValue}
          step={CHF_STEP.small}
          placeholder="automatisch"
          ariaLabel="Koordinierter Lohn"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={field("bvgInterestRate")}>BVG Zinssatz (%)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <PercentStepperInput
            id={field("bvgInterestRate")}
            name={field("bvgInterestRate")}
            value={bvgInterest.value}
            onChange={bvgInterest.onChange}
            step={NUM_STEP.percentFine}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              bvgInterest.setValue(BVG_MIN_INTEREST_RATE);
              onFieldChange?.();
            }}
          >
            Vorschlag
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Vorschlag: {formatRatePercent(BVG_MIN_INTEREST_RATE)} (BVG-Minimum)
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={field("bvgConversionRate")}>BVG UWS (%)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <PercentStepperInput
            id={field("bvgConversionRate")}
            name={field("bvgConversionRate")}
            value={bvgConversion.value}
            onChange={bvgConversion.onChange}
            step={NUM_STEP.percentFine}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              bvgConversion.setValue(BVG_CONVERSION_RATE);
              onFieldChange?.();
            }}
          >
            Vorschlag
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Vorschlag: {formatRatePercent(BVG_CONVERSION_RATE)} (obligatorischer
          Umwandlungssatz)
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={field("freeAssetsInterestRate")}>
          Rendite freies Vermögen (%)
        </Label>
        <PercentStepperInput
          id={field("freeAssetsInterestRate")}
          name={field("freeAssetsInterestRate")}
          value={freeAssetsInterest.value}
          onChange={freeAssetsInterest.onChange}
          step={NUM_STEP.percent}
        />
      </div>
      <div className="grid gap-2 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={field("bvgContributionRates")}>
            BVG Gutschriften (JSON %)
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setBvgContributionJson(defaultBvgContributionRatesJson());
              onFieldChange?.();
            }}
          >
            JSON-Vorschlag
          </Button>
        </div>
        <textarea
          id={field("bvgContributionRates")}
          name={field("bvgContributionRates")}
          value={bvgContributionJson}
          onChange={(e) => {
            setBvgContributionJson(e.target.value);
            onFieldChange?.();
          }}
          rows={5}
          placeholder={defaultBvgContributionRatesJson()}
          className="rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Vorschlag: Standard-Altersgutschriften (7 / 10 / 15 / 18 %). Leer =
          Engine-Fallback.
        </p>
      </div>
      <div className="xl:col-span-2">
        <Pillar3aAccountsEditor
          accounts={pillar3aAccounts}
          defaultReturnRate={pillar3aDefaultReturn}
          formFieldName={
            isPartner ? "pillar3aPartnerAccountsJson" : "pillar3aAccountsJson"
          }
          onAccountsChange={onFieldChange}
        />
      </div>
      <div className="xl:col-span-2">
        <WorkloadReductionFields
          idPrefix={person}
          namePrefix={isPartner ? "partnerWorkloadReduction" : "workloadReduction"}
          reductions={workloadReductions}
          onChange={(next) => {
            setWorkloadReductions(next);
            onFieldChange?.();
          }}
        />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

import { WorkloadReductionFields } from "@/components/shared/workload-reduction-fields";
import { CHF_STEP, NUM_STEP } from "@/components/shared/numeric-steps";
import {
  ChfStepperField,
  NumberStepperField,
  NumberStepperInput,
  PercentStepperInput,
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
import { CollapsibleCard } from "@/components/ui/collapsible-card";
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
  primaryLabel = "Person 1",
  onFieldChange,
}: {
  person: "primary" | "partner";
  profile?: {
    first_name?: string | null;
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
  /** Anzeigename der Primärperson (für Partner-Bezüge wie «zusammen mit …»). */
  primaryLabel?: string;
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
  const annualSavings = useChfField(
    p?.annual_savings_to_free_assets as number | null,
    true,
  );
  const bvgInterest = usePercentField(p?.bvg_interest_rate as number | null);
  const bvgConversion = usePercentField(
    p?.bvg_conversion_rate as number | null,
  );

  const bvgCoordinatedSalary = useChfField(
    p?.bvg_coordinated_salary_override as number | null,
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

  const initialOffset =
    (partnerData?.employment_end_offset_years as number | null | undefined) ?? 0;
  const [employmentEndMode, setEmploymentEndMode] = useState<"together" | "later">(
    () => (initialOffset > 0 ? "later" : "together"),
  );
  const [employmentEndOffsetYears, setEmploymentEndOffsetYears] = useState(() =>
    String(initialOffset > 0 ? initialOffset : 2),
  );

  const bindChf = (field: ReturnType<typeof useChfField>) => ({
    ...field,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      field.onChange(e);
      onFieldChange?.();
    },
    onBlur: () => {
      field.onBlur();
      onFieldChange?.();
    },
  });

  const bindPercent = (field: ReturnType<typeof usePercentField>) => ({
    ...field,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      field.onChange(e);
      onFieldChange?.();
    },
  });

  const salaryField = bindChf(salary);
  const bvgCapitalField = bindChf(bvgCapital);
  const bvgCoordinatedSalaryField = bindChf(bvgCoordinatedSalary);
  const annualSavingsField = bindChf(annualSavings);
  const bvgInterestField = bindPercent(bvgInterest);
  const bvgConversionField = bindPercent(bvgConversion);

  return (
    <div className="grid gap-4">
      <CollapsibleCard
        title="Allgemeine Angaben"
        description="Persönliche Daten, Einkommen, Vermögen und Sparquote."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={field("firstName")}>Vorname</Label>
            <Input
              id={field("firstName")}
              name={field("firstName")}
              type="text"
              autoComplete="off"
              placeholder={isPartner ? "Person 2" : "Person 1"}
              defaultValue={(p?.first_name as string) ?? ""}
              onChange={() => onFieldChange?.()}
            />
            <p className="text-xs text-muted-foreground">
              Ersetzt «{isPartner ? "Person 2" : "Person 1"}» in Überschriften
              und Grafiken.
            </p>
          </div>
          <div className="grid gap-2">
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
            onChange={(e) => {
              setEmploymentStartYear(e.target.value);
              onFieldChange?.();
            }}
            step={NUM_STEP.year}
            min={1900}
            max={2100}
          />
          <NumberStepperField
            id={field("retirementAge")}
            name={field("retirementAge")}
            label="Pensionierungsalter"
            value={retirementAge}
            onChange={(e) => {
              setRetirementAge(e.target.value);
              onFieldChange?.();
            }}
            step={NUM_STEP.age}
            min={58}
            max={70}
          />
          {isPartner ? (
            <div className="grid gap-3 xl:col-span-2">
              <Label>Arbeitsstopp relativ zu {primaryLabel} (FI)</Label>
              <div className="grid gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="partnerEmploymentEndMode"
                    value="together"
                    checked={employmentEndMode === "together"}
                    onChange={() => {
                      setEmploymentEndMode("together");
                      onFieldChange?.();
                    }}
                    className="h-4 w-4"
                  />
                  Arbeitsstopp zusammen mit {primaryLabel}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="partnerEmploymentEndMode"
                      value="later"
                      checked={employmentEndMode === "later"}
                      onChange={() => {
                        setEmploymentEndMode("later");
                        onFieldChange?.();
                      }}
                      className="h-4 w-4"
                    />
                    Jahre später
                  </label>
                  <NumberStepperInput
                    id="partnerEmploymentEndOffsetYears"
                    name="partnerEmploymentEndOffsetYears"
                    ariaLabel="Jahre später"
                    value={employmentEndOffsetYears}
                    onChange={(e) => {
                      setEmploymentEndOffsetYears(e.target.value);
                      onFieldChange?.();
                    }}
                    step={NUM_STEP.age}
                    min={1}
                    max={20}
                    disabled={employmentEndMode !== "later"}
                    className="max-w-[10rem]"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Für die Haushalts-FI-Berechnung: ob diese Person gleichzeitig mit{" "}
                {primaryLabel} aufhört zu arbeiten oder erst X Jahre später
                (geclamped 18–70 J.). Das geplante Pensionierungsalter oben gilt
                weiterhin für reguläre Szenarien.
              </p>
            </div>
          ) : null}
          <ChfStepperField
            id={field("currentSalaryBrutto")}
            name={field("currentSalaryBrutto")}
            label="Bruttojahreslohn"
            step={CHF_STEP.income}
            {...salaryField}
          />
          <ChfStepperField
            id={field("annualSavingsToFreeAssets")}
            name={field("annualSavingsToFreeAssets")}
            label="Jährliche Sparquote ins freie Vermögen (ohne Zinsen daraus)"
            step={CHF_STEP.savings}
            allowZero
            {...annualSavingsField}
          />
          <p className="text-xs text-muted-foreground xl:col-span-2">
            Sparquote pro Person: fliesst bis zur Erwerbsaufgabe dieser Person in
            das gemeinsame freie Vermögen (0 nach Pensionierung). Startkapital und
            Rendite des freien Vermögens werden als Haushaltswert unter «Planung»
            erfasst. 0 ist als Wert erlaubt.
          </p>
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
      </CollapsibleCard>

      <CollapsibleCard
        title="BVG"
        description="Pensionskasse: Kapital, Zinssatz, UWS und Gutschriften."
        defaultOpen={false}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <ChfStepperField
            className="w-52"
            id={field("bvgCurrentCapital")}
            name={field("bvgCurrentCapital")}
            label="BVG aktuelles Kapital"
            step={CHF_STEP.wealth}
            allowZero
            {...bvgCapitalField}
          />
          <div className="xl:col-span-2">
            <ChfStepperField
              className="w-52"
              id={field("bvgCoordinatedSalaryOverride")}
              name={field("bvgCoordinatedSalaryOverride")}
              label="Koordinierter Lohn (Override)"
              step={CHF_STEP.wealth}
              placeholder="automatisch"
              {...bvgCoordinatedSalaryField}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={field("bvgInterestRate")}>BVG Zinssatz (%)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <PercentStepperInput
                id={field("bvgInterestRate")}
                name={field("bvgInterestRate")}
                value={bvgInterestField.value}
                onChange={bvgInterestField.onChange}
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
            <Label htmlFor={field("bvgConversionRate")}>BVG Umwandlungssatz (%)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <PercentStepperInput
                id={field("bvgConversionRate")}
                name={field("bvgConversionRate")}
                value={bvgConversionField.value}
                onChange={bvgConversionField.onChange}
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
          <div className="grid gap-2 xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor={field("bvgContributionRates")}>
                BVG Gutschriften pro Altersperiode (JSON %)
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
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="3a"
        description="Säule-3a-Konten mit Kapital, Einzahlungen und Rendite."
        defaultOpen={false}
      >
        <Pillar3aAccountsEditor
          accounts={pillar3aAccounts}
          defaultReturnRate={pillar3aDefaultReturn}
          formFieldName={
            isPartner ? "pillar3aPartnerAccountsJson" : "pillar3aAccountsJson"
          }
          onAccountsChange={onFieldChange}
        />
      </CollapsibleCard>
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import {
  completeOnboarding,
  skipOnboarding,
} from "@/app/onboarding/actions";
import { FinancialIndependencePanel } from "@/components/master-data/financial-independence-panel";
import { SimplificationCallout } from "@/components/onboarding/simplification-callout";
import {
  ChfStepperField,
  NumberStepperField,
  PercentStepperInput,
} from "@/components/shared/stepper-inputs";
import { CHF_STEP } from "@/components/shared/numeric-steps";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  visibleSteps,
  type WizardStepId,
} from "@/lib/onboarding/content";
import {
  buildFormDataFromOnboardingState,
  defaultOnboardingState,
  type OnboardingState,
} from "@/lib/onboarding/wizard-state";
import {
  parseMasterDataFormToHousehold,
  taxSettingsFromFormData,
} from "@/lib/master-data/parse-form-profile";
import { getCantonsSortedByName } from "@/lib/tax/canton-reference";
import {
  resolveMunicipalityFromPostalCode,
  sortLocalitiesByName,
  validatePostalCodeForCanton,
} from "@/lib/swiss/postal-codes";

type Props = {
  initialState?: OnboardingState;
};

export function OnboardingWizard({ initialState }: Props) {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>(
    initialState ?? defaultOnboardingState(),
  );
  const steps = useMemo(
    () => visibleSteps(state.planningMode),
    [state.planningMode],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [skipPending, startSkip] = useTransition();

  const currentStep = steps[stepIndex];
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  const household = useMemo(() => {
    const formData = buildFormDataFromOnboardingState(state);
    return parseMasterDataFormToHousehold(
      formData,
      taxSettingsFromFormData(formData),
    );
  }, [state]);

  const update = useCallback(
    (patch: Partial<OnboardingState>) => {
      setState((prev) => ({ ...prev, ...patch }));
      setError(null);
    },
    [],
  );

  const updatePrimary = useCallback(
    (patch: Partial<OnboardingState["primary"]>) => {
      setState((prev) => ({
        ...prev,
        primary: { ...prev.primary, ...patch },
      }));
      setError(null);
    },
    [],
  );

  const updatePartner = useCallback(
    (patch: Partial<OnboardingState["partner"]>) => {
      setState((prev) => ({
        ...prev,
        partner: { ...prev.partner, ...patch },
      }));
      setError(null);
    },
    [],
  );

  const validateStep = (stepId: WizardStepId): string | null => {
    switch (stepId) {
      case "person1":
        if (!state.primary.birthDate.trim()) return "Geburtsdatum ist erforderlich.";
        if (!state.primary.currentSalaryBrutto.trim())
          return "Bruttojahreslohn ist erforderlich.";
        return null;
      case "partner":
        if (state.planningMode === "couple" && !state.partner.birthDate.trim()) {
          return "Geburtsdatum Person 2 ist erforderlich.";
        }
        return null;
      case "tax":
        if (!state.taxPostalCode.trim()) return "Postleitzahl ist erforderlich.";
        if (!state.taxCanton.trim()) return "Kanton ist erforderlich.";
        {
          const resolved = resolveMunicipalityFromPostalCode(
            state.taxPostalCode,
            state.taxCanton,
            state.taxMunicipality,
          );
          if (!resolved.ok) return resolved.error;
        }
        return null;
      case "scenario":
        if (!state.scenarioName.trim()) return "Szenario-Name fehlt.";
        return null;
      default:
        return null;
    }
  };

  const goNext = () => {
    const err = validateStep(currentStep.id);
    if (err) {
      setError(err);
      return;
    }
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
      setError(null);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
      setError(null);
    }
  };

  const handleFinish = () => {
    const err = validateStep("scenario") ?? validateStep("tax");
    if (err) {
      setError(err);
      return;
    }
    startTransition(async () => {
      const result = await completeOnboarding(state);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/scenarios/${result.scenarioId}?saved=1&onboarding=1`);
    });
  };

  const handleSkip = () => {
    startSkip(() => {
      void skipOnboarding();
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-muted-foreground">
            Schritt {stepIndex + 1} von {steps.length}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={skipPending || pending}
            onClick={handleSkip}
          >
            Später
          </Button>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{currentStep.title}</CardTitle>
          {currentStep.subtitle ? (
            <CardDescription>{currentStep.subtitle}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep.simplification ? (
            <SimplificationCallout note={currentStep.simplification} />
          ) : null}

          {renderStepContent(currentStep.id, {
            state,
            update,
            updatePrimary,
            updatePartner,
            household,
          })}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={stepIndex === 0 || pending || skipPending}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück
            </Button>

            {currentStep.id === "scenario" ? (
              <Button type="button" onClick={handleFinish} disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Speichern…
                  </>
                ) : (
                  "Stammdaten & Szenario speichern"
                )}
              </Button>
            ) : (
              <Button type="button" onClick={goNext} disabled={pending}>
                Weiter
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function renderStepContent(
  stepId: WizardStepId,
  ctx: {
    state: OnboardingState;
    update: (patch: Partial<OnboardingState>) => void;
    updatePrimary: (patch: Partial<OnboardingState["primary"]>) => void;
    updatePartner: (patch: Partial<OnboardingState["partner"]>) => void;
    household: ReturnType<typeof parseMasterDataFormToHousehold>;
  },
) {
  const { state, update, updatePrimary, updatePartner, household } = ctx;

  switch (stepId) {
    case "welcome":
      return (
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Dieser Assistent führt Sie durch die wichtigsten Stammdaten und
            erklärt dabei bewusste Vereinfachungen — damit Sie wissen, was die
            App modelliert und was nicht.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>AHV, BVG, freies Vermögen und Haushaltsausgaben</li>
            <li>Live-Vorschau «Finanzielle Unabhängigkeit»</li>
            <li>Erstes Szenario zum Ausprobieren von Varianten</li>
          </ul>
          <p className="text-xs">
            Säule 3a, Teilpensionierung und detaillierte BVG-Overrides können
            Sie danach unter Stammdaten ergänzen.
          </p>
        </div>
      );

    case "concept":
      return (
        <p className="text-sm text-muted-foreground">
          Im nächsten Schritt legen Sie fest, ob Sie allein oder als Paar planen.
          Stammdaten und Szenarien bleiben dabei klar getrennt — siehe Infobox oben.
        </p>
      );

    case "mode":
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard
              active={state.planningMode === "single"}
              title="Einzelperson"
              description="Eine Person, eigene Ausgaben und Vermögen."
              onClick={() =>
                update({
                  planningMode: "single",
                  maritalStatus: "single",
                })
              }
            />
            <ModeCard
              active={state.planningMode === "couple"}
              title="Paar"
              description="Zwei Personen, gemeinsame Haushaltsausgaben und Steuern."
              onClick={() =>
                update({
                  planningMode: "couple",
                  maritalStatus: "married",
                })
              }
            />
          </div>
        </div>
      );

    case "person1":
      return (
        <PersonFields
          person={state.primary}
          onChange={updatePrimary}
          salaryRequired
        />
      );

    case "wealth":
      return (
        <div className="space-y-4">
          <ChfStepperField
            id="freeAssets"
            label="Freies Vermögen heute"
            value={state.primary.freeAssets}
            onChange={(e) => updatePrimary({ freeAssets: e.target.value })}
            step={CHF_STEP.wealth}
            allowZero
          />
          <div className="grid gap-2">
            <ChfStepperField
              id="annualSavings"
              label="Jährliche Sparquote ins freie Vermögen"
              value={state.primary.annualSavingsToFreeAssets}
              onChange={(e) =>
                updatePrimary({ annualSavingsToFreeAssets: e.target.value })
              }
              step={CHF_STEP.savings}
              allowZero
            />
            <p className="text-xs text-muted-foreground">
              Direkter Zufluss — nicht Brutto minus Ausgaben.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="freeAssetsReturn">Erwartete Rendite freies Vermögen (%)</Label>
            <PercentStepperInput
              id="freeAssetsReturn"
              value={state.primary.freeAssetsInterestRate}
              onChange={(e) =>
                updatePrimary({ freeAssetsInterestRate: e.target.value })
              }
            />
          </div>
        </div>
      );

    case "bvg":
      return (
        <div className="space-y-4">
          <ChfStepperField
            id="bvgCapital"
            label="Aktuelles BVG-Kapital (optional)"
            value={state.primary.bvgCurrentCapital}
            onChange={(e) => updatePrimary({ bvgCurrentCapital: e.target.value })}
            step={CHF_STEP.wealth}
            allowZero
          />
          <p className="text-sm text-muted-foreground">
            Zinssatz, Umwandlungssatz und Beitragssätze verwenden wir vorerst
            mit gesetzlichen Standardwerten. Feinjustierung unter Stammdaten →
            Person 1 → BVG.
          </p>
        </div>
      );

    case "planning":
      return (
        <div className="space-y-4">
          <div className="grid gap-2">
            <ChfStepperField
              id="retirementExpenses"
              label="Jährliche Netto-Lebenshaltung ab Pensionierung (CHF, heutige Kaufkraft)"
              value={state.annualRetirementExpenses}
              onChange={(e) => update({ annualRetirementExpenses: e.target.value })}
              step={CHF_STEP.wealth}
              allowZero
            />
            <p className="text-xs text-muted-foreground">
              Ohne Steuern, ohne BVG/3a-Einzahlungen.
            </p>
          </div>
          {state.planningMode === "couple" ? (
            <ChfStepperField
              id="survivorExpenses"
              label="Netto-Lebenshaltung bei nur einem Partner (optional)"
              value={state.annualSurvivorExpenses}
              onChange={(e) => update({ annualSurvivorExpenses: e.target.value })}
              step={CHF_STEP.wealth}
              allowZero
            />
          ) : null}
          <NumberStepperField
            id="planningHorizon"
            label="Planungshorizont (Alter)"
            value={state.planningHorizonAge}
            onChange={(e) => update({ planningHorizonAge: e.target.value })}
            min={75}
            max={100}
          />
          <div className="space-y-2">
            <Label htmlFor="inflation">Inflation (% p.a.)</Label>
            <PercentStepperInput
              id="inflation"
              value={state.inflationRate}
              onChange={(e) => update({ inflationRate: e.target.value })}
            />
          </div>
        </div>
      );

    case "partner":
      return (
        <div className="space-y-4">
          <PersonFields
            person={state.partner}
            onChange={updatePartner}
            salaryRequired={false}
          />
          <NumberStepperField
            id="partnerOffset"
            label="Person 2 arbeitet länger (+ Jahre nach P1-Erwerbsende)"
            value={state.partnerEmploymentEndOffsetYears}
            onChange={(e) =>
              update({ partnerEmploymentEndOffsetYears: e.target.value })
            }
            min={0}
            max={10}
          />
        </div>
      );

    case "tax":
      return <TaxStep state={state} update={update} />;

    case "review":
      return <FinancialIndependencePanel household={household} />;

    case "scenario":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scenarioName">Name des ersten Szenarios</Label>
            <Input
              id="scenarioName"
              value={state.scenarioName}
              onChange={(e) => update({ scenarioName: e.target.value })}
              placeholder="Basis-Szenario"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Das Szenario startet ohne Overrides — identisch zu Ihren Stammdaten.
            Unter Szenarien können Sie später Kapitalbezug, 3a-Bezug und mehr
            anpassen.
          </p>
        </div>
      );

    default:
      return null;
  }
}

function ModeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-colors ${
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "hover:border-primary/40"
      }`}
    >
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}

function PersonFields({
  person,
  onChange,
  salaryRequired,
}: {
  person: OnboardingState["primary"];
  onChange: (patch: Partial<OnboardingState["primary"]>) => void;
  salaryRequired: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="birthDate">Geburtsdatum *</Label>
        <Input
          id="birthDate"
          type="date"
          value={person.birthDate}
          onChange={(e) => onChange({ birthDate: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gender">Geschlecht (AHV)</Label>
        <select
          id="gender"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={person.gender}
          onChange={(e) =>
            onChange({
              gender: e.target.value as OnboardingState["primary"]["gender"],
            })
          }
        >
          <option value="">—</option>
          <option value="male">Männlich</option>
          <option value="female">Weiblich</option>
        </select>
      </div>
      <NumberStepperField
        id="retirementAge"
        label="Geplantes Pensionierungsalter"
        value={person.retirementAge}
        onChange={(e) => onChange({ retirementAge: e.target.value })}
        min={58}
        max={70}
      />
      <div className="space-y-2 sm:col-span-2">
        <ChfStepperField
          id="salary"
          label={salaryRequired ? "Bruttojahreslohn *" : "Bruttojahreslohn"}
          value={person.currentSalaryBrutto}
          onChange={(e) => onChange({ currentSalaryBrutto: e.target.value })}
          step={CHF_STEP.income}
        />
      </div>
      <NumberStepperField
        id="employmentStart"
        label="Berufseinstieg (Jahr, optional)"
        value={person.employmentStartYear}
        onChange={(e) => onChange({ employmentStartYear: e.target.value })}
        min={1950}
        max={2030}
      />
    </div>
  );
}

function TaxStep({
  state,
  update,
}: {
  state: OnboardingState;
  update: (patch: Partial<OnboardingState>) => void;
}) {
  const cantons = useMemo(() => getCantonsSortedByName(), []);
  const localities = useMemo(() => {
    if (state.taxPostalCode.trim().length !== 4) return [];
    const validation = validatePostalCodeForCanton(
      state.taxPostalCode,
      state.taxCanton,
    );
    if (!validation.ok) return [];
    return sortLocalitiesByName(validation.localities);
  }, [state.taxPostalCode, state.taxCanton]);

  const plzError =
    state.taxPostalCode.trim().length === 4
      ? validatePostalCodeForCanton(state.taxPostalCode, state.taxCanton).ok
        ? null
        : "PLZ passt nicht zum Kanton."
      : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="maritalStatus">Zivilstand (Steuer)</Label>
        <select
          id="maritalStatus"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={state.maritalStatus}
          onChange={(e) =>
            update({
              maritalStatus: e.target.value as "single" | "married",
            })
          }
        >
          <option value="single">Ledig / alleinstehend</option>
          <option value="married">Verheiratet / eingetr. Partnerschaft</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="taxCanton">Kanton *</Label>
        <select
          id="taxCanton"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={state.taxCanton}
          onChange={(e) => update({ taxCanton: e.target.value, taxMunicipality: "" })}
        >
          {cantons.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="taxPlz">Postleitzahl *</Label>
        <Input
          id="taxPlz"
          inputMode="numeric"
          maxLength={4}
          value={state.taxPostalCode}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, 4);
            update({ taxPostalCode: next, taxMunicipality: "" });
            if (next.length === 4) {
              const resolved = resolveMunicipalityFromPostalCode(
                next,
                state.taxCanton,
              );
              if (resolved.ok && resolved.municipality) {
                update({ taxPostalCode: next, taxMunicipality: resolved.municipality });
              }
            }
          }}
        />
        {plzError ? (
          <p className="text-xs text-destructive">{plzError}</p>
        ) : null}
      </div>
      {localities.length > 1 ? (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="taxMunicipality">Gemeinde *</Label>
          <select
            id="taxMunicipality"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={state.taxMunicipality}
            onChange={(e) => update({ taxMunicipality: e.target.value })}
          >
            <option value="">Bitte wählen</option>
            {localities.map((loc) => (
              <option key={loc.name} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      ) : state.taxMunicipality ? (
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Gemeinde: {state.taxMunicipality}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Save,
} from "lucide-react";

import { saveScenario } from "@/app/scenarios/actions";
import {
  inheritanceDraftsFromEvents,
  inheritanceEventsFromDrafts,
  type InheritanceEventDraft,
} from "@/components/scenarios/inheritance-events-card";
import {
  ahvOverridesFromState,
  buildInitialAhvState,
  type AhvOverrideState,
} from "@/components/scenarios/scenario-ahv-section";
import {
  bvgOverridesFromState,
  type BvgOverrideState,
} from "@/components/scenarios/scenario-bvg-section";
import { countPensionIncomeSources } from "@/components/scenarios/pension-income-chart";
import { ScenarioWealthPreview } from "@/components/scenarios/scenario-wealth-preview";
import {
  buildInitialPillar3aOverrides,
  pillar3aOverridesToScenario,
  type Pillar3aAccountOverrideState,
} from "@/components/scenarios/scenario-pillar3a-section";
import { Button } from "@/components/ui/button";
import { ScenarioFormTabs } from "@/components/scenarios/scenario-form-tabs";
import { StickyPreviewLayout } from "@/components/layout/sticky-preview-layout";
import { PercentStepperNumberInput } from "@/components/shared/stepper-inputs";
import {
  BVG_CONTRIBUTION_BUCKETS,
  BVG_CONTRIBUTION_RATES,
  BVG_CONVERSION_RATE,
  BVG_MIN_INTEREST_RATE,
  calculateAge,
  calculateScenarioPension,
  calculateHouseholdPension,
  getAhvEarliestPensionAge,
  getAhvReferenceAge,
  BVG_EARLIEST_PENSION_AGE,
  normalizeWorkloadReductions,
  type ProfileForScenario,
  type ScenarioOverrides,
  type WorkloadReduction,
} from "@/lib/engine";
import {
  formatSwissNumber,
  parseSwissNumber,
  scenarioRateToDisplayPercent,
} from "@/lib/format/numbers";
import {
  profileContributionRatesToPercent,
  profileRateToPercent,
} from "@/lib/scenarios/profile";
import type { HouseholdProfileForScenario } from "@/lib/household/types";
import { personLabel } from "@/lib/household/person-colors";

export type ScenarioRecord = {
  id: string;
  name: string;
  data: ScenarioOverrides & { description?: string };
};

type Props = {
  profile: ProfileForScenario;
  household?: HouseholdProfileForScenario | null;
  initialScenario?: ScenarioRecord;
  cancelHref?: string;
};

export function ScenarioForm({
  profile,
  household = null,
  initialScenario,
  cancelHref = "/scenarios",
}: Props) {
  const isCouple =
    household?.planningMode === "couple" && household.partner != null;
  const partnerProfile = household?.partner ?? null;
  const primaryLabel = personLabel("primary", profile.firstName);
  const partnerLabel = personLabel("partner", partnerProfile?.firstName);
  const partnerProfileDefaults = useMemo(() => {
    if (!partnerProfile) return null;
    return {
      conversionPercent: profileRateToPercent(
        partnerProfile.bvgConversionRate,
        BVG_CONVERSION_RATE,
      ),
      interestPercent: profileRateToPercent(
        partnerProfile.bvgInterestRate,
        BVG_MIN_INTEREST_RATE,
      ),
      contributionRates:
        profileContributionRatesToPercent(partnerProfile.bvgContributionRates) ??
        Object.fromEntries(
          BVG_CONTRIBUTION_BUCKETS.map((b) => [
            b.key,
            BVG_CONTRIBUTION_RATES[b.key] * 100,
          ]),
        ),
    };
  }, [partnerProfile]);

  const partnerCurrentAge = useMemo(
    () => (partnerProfile ? calculateAge(partnerProfile.birthDate) : 0),
    [partnerProfile],
  );
  const profileDefaults = useMemo(
    () => ({
      conversionPercent: profileRateToPercent(
        profile.bvgConversionRate,
        BVG_CONVERSION_RATE,
      ),
      interestPercent: profileRateToPercent(
        profile.bvgInterestRate,
        BVG_MIN_INTEREST_RATE,
      ),
      contributionRates:
        profileContributionRatesToPercent(profile.bvgContributionRates) ??
        Object.fromEntries(
          BVG_CONTRIBUTION_BUCKETS.map((b) => [
            b.key,
            BVG_CONTRIBUTION_RATES[b.key] * 100,
          ]),
        ),
    }),
    [profile],
  );

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialScenario?.name ?? "");
  const [description, setDescription] = useState(
    initialScenario?.data?.description ?? "",
  );

  const [useRetirementAgeOverride, setUseRetirementAgeOverride] = useState(
    initialScenario?.data?.ahv?.employmentEndAgeOverride != null ||
      initialScenario?.data?.ahv?.retirementAgeOverride != null,
  );
  const [retirementAgeOverride, setRetirementAgeOverride] = useState(
    initialScenario?.data?.ahv?.employmentEndAgeOverride ??
      initialScenario?.data?.ahv?.retirementAgeOverride ??
      profile.retirementAge,
  );

  const ahvReferenceAge = useMemo(
    () => getAhvReferenceAge(profile.birthDate, profile.gender),
    [profile.birthDate, profile.gender],
  );
  const ahvEarliestAge = useMemo(
    () => getAhvEarliestPensionAge(profile.birthDate, profile.gender),
    [profile.birthDate, profile.gender],
  );

  const partnerAhvReferenceAge = useMemo(
    () =>
      partnerProfile
        ? getAhvReferenceAge(partnerProfile.birthDate, partnerProfile.gender)
        : 65,
    [partnerProfile],
  );
  const partnerAhvEarliestAge = useMemo(
    () =>
      partnerProfile
        ? getAhvEarliestPensionAge(partnerProfile.birthDate, partnerProfile.gender)
        : 63,
    [partnerProfile],
  );

  const [useAhvPensionStartOverride, setUseAhvPensionStartOverride] = useState(
    initialScenario?.data?.ahv?.pensionStartAgeOverride != null,
  );
  const [ahvPensionStartOverride, setAhvPensionStartOverride] = useState(
    initialScenario?.data?.ahv?.pensionStartAgeOverride ??
      Math.round(ahvReferenceAge),
  );

  const [useBvgPensionStartOverride, setUseBvgPensionStartOverride] = useState(
    initialScenario?.data?.bvg?.pensionStartAgeOverride != null,
  );
  const [bvgPensionStartOverride, setBvgPensionStartOverride] = useState(
    initialScenario?.data?.bvg?.pensionStartAgeOverride ?? profile.retirementAge,
  );

  const [useMissingYears, setUseMissingYears] = useState(
    (initialScenario?.data?.ahv?.missingContributionYears ?? 0) > 0,
  );
  const [missingContributionYears, setMissingContributionYears] = useState(
    initialScenario?.data?.ahv?.missingContributionYears ?? 0,
  );

  const [useIncomeOverride, setUseIncomeOverride] = useState(
    initialScenario?.data?.ahv?.averageIncomeOverride != null,
  );
  const [averageIncomeOverride, setAverageIncomeOverride] = useState(() =>
    formatSwissNumber(initialScenario?.data?.ahv?.averageIncomeOverride),
  );

  const [partnerAhvState, setPartnerAhvState] = useState<AhvOverrideState>(() =>
    partnerProfile
      ? buildInitialAhvState(
          partnerProfile,
          initialScenario?.data?.partner?.ahv,
          getAhvReferenceAge(partnerProfile.birthDate, partnerProfile.gender),
        )
      : buildInitialAhvState(profile, undefined, ahvReferenceAge),
  );

  const primaryAhvState: AhvOverrideState = useMemo(
    () => ({
      useRetirementOverride: useRetirementAgeOverride,
      retirementAgeOverride,
      useAhvPensionStartOverride,
      ahvPensionStartOverride,
      useMissingYears,
      missingContributionYears,
      useIncomeOverride,
      averageIncomeOverride,
    }),
    [
      useRetirementAgeOverride,
      retirementAgeOverride,
      useAhvPensionStartOverride,
      ahvPensionStartOverride,
      useMissingYears,
      missingContributionYears,
      useIncomeOverride,
      averageIncomeOverride,
    ],
  );

  const updatePrimaryAhv = (patch: Partial<AhvOverrideState>) => {
    if (patch.useRetirementOverride !== undefined) {
      setUseRetirementAgeOverride(patch.useRetirementOverride);
    }
    if (patch.retirementAgeOverride !== undefined) {
      setRetirementAgeOverride(patch.retirementAgeOverride);
    }
    if (patch.useAhvPensionStartOverride !== undefined) {
      setUseAhvPensionStartOverride(patch.useAhvPensionStartOverride);
    }
    if (patch.ahvPensionStartOverride !== undefined) {
      setAhvPensionStartOverride(patch.ahvPensionStartOverride);
    }
    if (patch.useMissingYears !== undefined) {
      setUseMissingYears(patch.useMissingYears);
    }
    if (patch.missingContributionYears !== undefined) {
      setMissingContributionYears(patch.missingContributionYears);
    }
    if (patch.useIncomeOverride !== undefined) {
      setUseIncomeOverride(patch.useIncomeOverride);
    }
    if (patch.averageIncomeOverride !== undefined) {
      setAverageIncomeOverride(patch.averageIncomeOverride);
    }
  };

  const [useWorkloadOverride, setUseWorkloadOverride] = useState(
    initialScenario?.data?.workloadReductions !== undefined,
  );
  const [workloadReductions, setWorkloadReductions] = useState<WorkloadReduction[]>(
    () =>
      normalizeWorkloadReductions(
        initialScenario?.data?.workloadReductions ??
          profile.workloadReductions ??
          [],
      ),
  );

  const [usePartnerRetirementOverride, setUsePartnerRetirementOverride] =
    useState(
      initialScenario?.data?.partner?.ahv?.employmentEndAgeOverride != null ||
        initialScenario?.data?.partner?.ahv?.retirementAgeOverride != null,
    );
  const [partnerRetirementAgeOverride, setPartnerRetirementAgeOverride] =
    useState(
      initialScenario?.data?.partner?.ahv?.employmentEndAgeOverride ??
        initialScenario?.data?.partner?.ahv?.retirementAgeOverride ??
        partnerProfile?.retirementAge ??
        65,
    );
  const [usePartnerWorkloadOverride, setUsePartnerWorkloadOverride] = useState(
    initialScenario?.data?.partner?.workloadReductions !== undefined,
  );
  const [partnerWorkloadReductions, setPartnerWorkloadReductions] =
    useState<WorkloadReduction[]>(() =>
      normalizeWorkloadReductions(
        initialScenario?.data?.partner?.workloadReductions ??
          partnerProfile?.workloadReductions ??
          [],
      ),
    );

  const [inheritanceDrafts, setInheritanceDrafts] = useState<
    InheritanceEventDraft[]
  >(() => inheritanceDraftsFromEvents(initialScenario?.data?.inheritance));

  const [useConversionRateOverride, setUseConversionRateOverride] = useState(
    initialScenario?.data?.bvg?.conversionRateOverride != null,
  );
  const [conversionRateOverride, setConversionRateOverride] = useState(() => {
    const saved = initialScenario?.data?.bvg?.conversionRateOverride;
    if (saved != null) return scenarioRateToDisplayPercent(saved);
    return profileDefaults.conversionPercent;
  });

  const [useInterestRateOverride, setUseInterestRateOverride] = useState(
    initialScenario?.data?.bvg?.interestRateOverride != null,
  );
  const [interestRateOverride, setInterestRateOverride] = useState(() => {
    const saved = initialScenario?.data?.bvg?.interestRateOverride;
    if (saved != null) return scenarioRateToDisplayPercent(saved);
    return profileDefaults.interestPercent;
  });

  const [useCoordDeductionOverride, setUseCoordDeductionOverride] = useState(
    initialScenario?.data?.bvg?.coordinationDeductionMode != null &&
      initialScenario.data.bvg.coordinationDeductionMode !== "standard",
  );
  const [coordDeductionMode, setCoordDeductionMode] = useState<
    "standard" | "none" | "custom"
  >(initialScenario?.data?.bvg?.coordinationDeductionMode ?? "standard");

  const [useContributionRatesOverride, setUseContributionRatesOverride] =
    useState(initialScenario?.data?.bvg?.customContributionRates != null);
  const [contributionRates, setContributionRates] = useState<
    Record<string, number>
  >(() => {
    const saved = initialScenario?.data?.bvg?.customContributionRates;
    if (saved) {
      return Object.fromEntries(
        Object.entries(saved).map(([k, v]) => [
          k,
          Math.abs(v) <= 1 ? v * 100 : v,
        ]),
      );
    }
    return { ...profileDefaults.contributionRates };
  });

  const [capitalWithdrawalPercent, setCapitalWithdrawalPercent] = useState(
    initialScenario?.data?.bvg?.capitalWithdrawalPercent ?? 0,
  );
  const [capitalWithdrawalTranches, setCapitalWithdrawalTranches] = useState(
    initialScenario?.data?.bvg?.capitalWithdrawalTranches ?? 1,
  );

  const buildPartnerBvgState = (): BvgOverrideState => {
    const saved = initialScenario?.data?.partner?.bvg;
    const defaults = partnerProfileDefaults ?? profileDefaults;
    return {
      useBvgPensionStartOverride: saved?.pensionStartAgeOverride != null,
      bvgPensionStartOverride:
        saved?.pensionStartAgeOverride ?? partnerProfile?.retirementAge ?? 65,
      useConversionRateOverride: saved?.conversionRateOverride != null,
      conversionRateOverride:
        saved?.conversionRateOverride != null
          ? scenarioRateToDisplayPercent(saved.conversionRateOverride)
          : defaults.conversionPercent,
      useInterestRateOverride: saved?.interestRateOverride != null,
      interestRateOverride:
        saved?.interestRateOverride != null
          ? scenarioRateToDisplayPercent(saved.interestRateOverride)
          : defaults.interestPercent,
      useCoordDeductionOverride:
        saved?.coordinationDeductionMode != null &&
        saved.coordinationDeductionMode !== "standard",
      coordDeductionMode: saved?.coordinationDeductionMode ?? "standard",
      useContributionRatesOverride: saved?.customContributionRates != null,
      contributionRates: saved?.customContributionRates
        ? Object.fromEntries(
            Object.entries(saved.customContributionRates).map(([k, v]) => [
              k,
              Math.abs(v) <= 1 ? v * 100 : v,
            ]),
          )
        : { ...defaults.contributionRates },
      capitalWithdrawalPercent: saved?.capitalWithdrawalPercent ?? 0,
      capitalWithdrawalTranches: saved?.capitalWithdrawalTranches ?? 1,
    };
  };

  const [partnerBvgState, setPartnerBvgState] = useState<BvgOverrideState>(
    buildPartnerBvgState,
  );

  const primaryBvgState: BvgOverrideState = useMemo(
    () => ({
      useBvgPensionStartOverride,
      bvgPensionStartOverride,
      useConversionRateOverride,
      conversionRateOverride,
      useInterestRateOverride,
      interestRateOverride,
      useCoordDeductionOverride,
      coordDeductionMode,
      useContributionRatesOverride,
      contributionRates,
      capitalWithdrawalPercent,
      capitalWithdrawalTranches,
    }),
    [
      useBvgPensionStartOverride,
      bvgPensionStartOverride,
      useConversionRateOverride,
      conversionRateOverride,
      useInterestRateOverride,
      interestRateOverride,
      useCoordDeductionOverride,
      coordDeductionMode,
      useContributionRatesOverride,
      contributionRates,
      capitalWithdrawalPercent,
      capitalWithdrawalTranches,
    ],
  );

  const updatePrimaryBvg = (patch: Partial<BvgOverrideState>) => {
    if (patch.useBvgPensionStartOverride !== undefined) {
      setUseBvgPensionStartOverride(patch.useBvgPensionStartOverride);
    }
    if (patch.bvgPensionStartOverride !== undefined) {
      setBvgPensionStartOverride(patch.bvgPensionStartOverride);
    }
    if (patch.useConversionRateOverride !== undefined) {
      setUseConversionRateOverride(patch.useConversionRateOverride);
    }
    if (patch.conversionRateOverride !== undefined) {
      setConversionRateOverride(patch.conversionRateOverride);
    }
    if (patch.useInterestRateOverride !== undefined) {
      setUseInterestRateOverride(patch.useInterestRateOverride);
    }
    if (patch.interestRateOverride !== undefined) {
      setInterestRateOverride(patch.interestRateOverride);
    }
    if (patch.useCoordDeductionOverride !== undefined) {
      setUseCoordDeductionOverride(patch.useCoordDeductionOverride);
    }
    if (patch.coordDeductionMode !== undefined) {
      setCoordDeductionMode(patch.coordDeductionMode);
    }
    if (patch.useContributionRatesOverride !== undefined) {
      setUseContributionRatesOverride(patch.useContributionRatesOverride);
    }
    if (patch.contributionRates !== undefined) {
      setContributionRates(patch.contributionRates);
    }
    if (patch.capitalWithdrawalPercent !== undefined) {
      setCapitalWithdrawalPercent(patch.capitalWithdrawalPercent);
    }
    if (patch.capitalWithdrawalTranches !== undefined) {
      setCapitalWithdrawalTranches(patch.capitalWithdrawalTranches);
    }
  };

  const [useFreeAssetsReturnOverride, setUseFreeAssetsReturnOverride] =
    useState(initialScenario?.data?.freeAssets?.returnRateOverride != null);
  const [freeAssetsReturnOverride, setFreeAssetsReturnOverride] = useState(() => {
    if (initialScenario?.data?.freeAssets?.returnRateOverride != null) {
      return scenarioRateToDisplayPercent(
        initialScenario.data.freeAssets.returnRateOverride,
      );
    }
    const r = profile.freeAssetsInterestRate;
    if (r == null) return 4;
    return scenarioRateToDisplayPercent(r);
  });

  const [useFreeAssetsValueOverride, setUseFreeAssetsValueOverride] = useState(
    initialScenario?.data?.freeAssets?.currentValueOverride != null,
  );
  const [freeAssetsValueOverride, setFreeAssetsValueOverride] = useState(() =>
    formatSwissNumber(
      initialScenario?.data?.freeAssets?.currentValueOverride ?? profile.freeAssets,
    ),
  );

  const [pillar3aEffectiveSnapshot, setPillar3aEffectiveSnapshot] = useState("");
  const [pillar3aOverrideState, setPillar3aOverrideState] = useState<
    Record<string, Pillar3aAccountOverrideState>
  >(() => buildInitialPillar3aOverrides(profile, initialScenario?.data?.pillar3a));

  const [partnerPillar3aEffectiveSnapshot, setPartnerPillar3aEffectiveSnapshot] =
    useState("");
  const [partnerPillar3aOverrideState, setPartnerPillar3aOverrideState] =
    useState<Record<string, Pillar3aAccountOverrideState>>(() =>
      partnerProfile
        ? buildInitialPillar3aOverrides(
            partnerProfile,
            initialScenario?.data?.partner?.pillar3a,
          )
        : {},
    );

  const currentAge = useMemo(
    () => calculateAge(profile.birthDate),
    [profile.birthDate],
  );

  const updatePartnerPillar3aOverride = (
    accountId: string,
    patch: Partial<Pillar3aAccountOverrideState>,
  ) => {
    setPartnerPillar3aOverrideState((prev) => ({
      ...prev,
      [accountId]: { ...prev[accountId], ...patch },
    }));
  };

  const updatePillar3aOverride = (
    accountId: string,
    patch: Partial<Pillar3aAccountOverrideState>,
  ) => {
    setPillar3aOverrideState((prev) => ({
      ...prev,
      [accountId]: { ...prev[accountId], ...patch },
    }));
  };

  const resolvedPrimaryWorkload = useMemo(
    () =>
      normalizeWorkloadReductions(
        useWorkloadOverride
          ? workloadReductions
          : (profile.workloadReductions ?? []),
      ),
    [useWorkloadOverride, workloadReductions, profile.workloadReductions],
  );

  const resolvedPartnerWorkload = useMemo(
    () =>
      partnerProfile
        ? normalizeWorkloadReductions(
            usePartnerWorkloadOverride
              ? partnerWorkloadReductions
              : (partnerProfile.workloadReductions ?? []),
          )
        : [],
    [
      partnerProfile,
      usePartnerWorkloadOverride,
      partnerWorkloadReductions,
    ],
  );

  const profileFreeAssetsReturnPercent = profileRateToPercent(
    profile.freeAssetsInterestRate,
    0.04,
  );

  const overrides: ScenarioOverrides = useMemo(() => {
    const primaryAhvPartial = ahvOverridesFromState(primaryAhvState, {
      skipRetirement: isCouple,
    });
    const partnerAhvPartial = partnerProfile
      ? ahvOverridesFromState(partnerAhvState, { skipRetirement: true })
      : null;

    return {
      description: description.trim() || undefined,
      ahv: {
        ...primaryAhvPartial,
        ...(isCouple
          ? {
              employmentEndAgeOverride: useRetirementAgeOverride
                ? retirementAgeOverride
                : null,
              retirementAgeOverride: useRetirementAgeOverride
                ? retirementAgeOverride
                : null,
            }
          : {}),
      },
      bvg: bvgOverridesFromState(primaryBvgState),
      pillar3a: pillar3aOverridesToScenario(profile, pillar3aOverrideState),
      freeAssets: {
        currentValueOverride:
          useFreeAssetsValueOverride &&
          parseSwissNumber(freeAssetsValueOverride) !== profile.freeAssets
            ? parseSwissNumber(freeAssetsValueOverride)
            : null,
        returnRateOverride:
          useFreeAssetsReturnOverride &&
          Math.abs(freeAssetsReturnOverride - profileFreeAssetsReturnPercent) >
            0.05
            ? freeAssetsReturnOverride
            : null,
      },
      workloadReductions: useWorkloadOverride
        ? resolvedPrimaryWorkload
        : undefined,
      inheritance: inheritanceEventsFromDrafts(inheritanceDrafts),
      partner: isCouple
        ? {
            ahv: {
              employmentEndAgeOverride: usePartnerRetirementOverride
                ? partnerRetirementAgeOverride
                : null,
              retirementAgeOverride: usePartnerRetirementOverride
                ? partnerRetirementAgeOverride
                : null,
              pensionStartAgeOverride:
                partnerAhvPartial?.pensionStartAgeOverride ?? null,
              missingContributionYears:
                partnerAhvPartial?.missingContributionYears ?? 0,
              averageIncomeOverride:
                partnerAhvPartial?.averageIncomeOverride ?? null,
            },
            workloadReductions: usePartnerWorkloadOverride
              ? resolvedPartnerWorkload
              : undefined,
            pillar3a: partnerProfile
              ? pillar3aOverridesToScenario(
                  partnerProfile,
                  partnerPillar3aOverrideState,
                )
              : undefined,
            bvg: bvgOverridesFromState(partnerBvgState),
          }
        : undefined,
    };
  }, [
    description,
    useRetirementAgeOverride,
    retirementAgeOverride,
    useAhvPensionStartOverride,
    ahvPensionStartOverride,
    useBvgPensionStartOverride,
    bvgPensionStartOverride,
    useMissingYears,
    missingContributionYears,
    useIncomeOverride,
    averageIncomeOverride,
    useConversionRateOverride,
    conversionRateOverride,
    useInterestRateOverride,
    interestRateOverride,
    useCoordDeductionOverride,
    coordDeductionMode,
    useContributionRatesOverride,
    contributionRates,
    useFreeAssetsValueOverride,
    freeAssetsValueOverride,
    useFreeAssetsReturnOverride,
    freeAssetsReturnOverride,
    capitalWithdrawalPercent,
    capitalWithdrawalTranches,
    primaryBvgState,
    partnerBvgState,
    partnerAhvState,
    primaryAhvState,
    pillar3aOverrideState,
    profile,
    useWorkloadOverride,
    workloadReductions,
    inheritanceDrafts,
    isCouple,
    usePartnerRetirementOverride,
    partnerRetirementAgeOverride,
    usePartnerWorkloadOverride,
    partnerWorkloadReductions,
    resolvedPrimaryWorkload,
    resolvedPartnerWorkload,
    partnerPillar3aOverrideState,
    partnerProfile,
    profileFreeAssetsReturnPercent,
  ]);

  const householdResult = useMemo(() => {
    if (!isCouple || !household) return null;
    return calculateHouseholdPension(household, overrides);
  }, [household, isCouple, overrides]);

  const result = useMemo(() => {
    if (householdResult) return householdResult.primary;
    return calculateScenarioPension(profile, overrides);
  }, [householdResult, profile, overrides]);

  const partnerResult = householdResult?.partner ?? null;

  const pensionIncomeSourceCount = useMemo(
    () => countPensionIncomeSources(result),
    [result],
  );

  const hasPillar3aChart =
    result.pillar3a.accounts.some((a) => a.projection.length > 0) ||
    Boolean(
      partnerResult?.pillar3a.accounts.some((a) => a.projection.length > 0),
    );

  const pillar3aEffectiveKey = result.pillar3a.accounts
    .map((a) => a.id)
    .join("|");

  if (pillar3aEffectiveKey && pillar3aEffectiveKey !== pillar3aEffectiveSnapshot) {
    setPillar3aEffectiveSnapshot(pillar3aEffectiveKey);
    const effective = result.pillar3a.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      currentCapital:
        profile.pillar3aAccounts?.find((p) => p.id === a.id)?.currentCapital ?? 0,
      annualContribution: a.annualContribution,
      returnRate: a.returnRate,
      isAutoGenerated: a.isAutoGenerated,
    }));
    setPillar3aOverrideState((prev) => {
      const next = buildInitialPillar3aOverrides(
        profile,
        {
          ...initialScenario?.data?.pillar3a,
          withdrawalSchedule: {
            ...initialScenario?.data?.pillar3a?.withdrawalSchedule,
            ...Object.fromEntries(
              Object.entries(prev).map(([id, item]) => [
                id,
                item.withdrawalYearOffset,
              ]),
            ),
          },
        },
        effective,
        {
          bvgPensionStartAge: result.pillar3a.bvgPensionStartAge,
          earliestWithdrawalAge: result.pillar3a.earliestWithdrawalAge,
          latestWithdrawalAge: result.pillar3a.latestWithdrawalAge,
        },
      );
      return next;
    });
  }

  const partnerPillar3aEffectiveKey =
    partnerResult?.pillar3a.accounts.map((a) => a.id).join("|") ?? "";

  if (
    partnerProfile &&
    partnerPillar3aEffectiveKey &&
    partnerPillar3aEffectiveKey !== partnerPillar3aEffectiveSnapshot
  ) {
    setPartnerPillar3aEffectiveSnapshot(partnerPillar3aEffectiveKey);
    const effective = partnerResult!.pillar3a.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      currentCapital:
        partnerProfile.pillar3aAccounts?.find((p) => p.id === a.id)
          ?.currentCapital ?? 0,
      annualContribution: a.annualContribution,
      returnRate: a.returnRate,
      isAutoGenerated: a.isAutoGenerated,
    }));
    setPartnerPillar3aOverrideState((prev) =>
      buildInitialPillar3aOverrides(
        partnerProfile,
        {
          ...initialScenario?.data?.partner?.pillar3a,
          withdrawalSchedule: {
            ...initialScenario?.data?.partner?.pillar3a?.withdrawalSchedule,
            ...Object.fromEntries(
              Object.entries(prev).map(([id, item]) => [
                id,
                item.withdrawalYearOffset,
              ]),
            ),
          },
        },
        effective,
        {
          bvgPensionStartAge: partnerResult!.pillar3a.bvgPensionStartAge,
          earliestWithdrawalAge: partnerResult!.pillar3a.earliestWithdrawalAge,
          latestWithdrawalAge: partnerResult!.pillar3a.latestWithdrawalAge,
        },
      ),
    );
  }

  const baseResult = useMemo(
    () => calculateScenarioPension(profile, {}),
    [profile],
  );

  const effectiveRetirementAge =
    householdResult?.householdRetirementAge ?? result.summary.employmentEndAge;
  const profileBvgPensionStart = Math.max(
    profile.retirementAge,
    BVG_EARLIEST_PENSION_AGE,
  );
  const partnerBvgPensionStart = partnerProfile
    ? Math.max(partnerProfile.retirementAge, BVG_EARLIEST_PENSION_AGE)
    : profileBvgPensionStart;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await saveScenario(name.trim(), overrides, initialScenario?.id);
    } finally {
      setSaving(false);
    }
  };

  const handleFreeAssetsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseSwissNumber(e.target.value);
    setFreeAssetsValueOverride(formatSwissNumber(parsed));
  };

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href={cancelHref}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Zurück zur Übersicht
        </Link>
      </Button>

      <form onSubmit={handleSubmit} className="grid gap-6">
        <StickyPreviewLayout
          preview={
            <ScenarioWealthPreview
              result={result}
              householdResult={householdResult}
              effectiveRetirementAge={effectiveRetirementAge}
              planningHorizonAge={profile.planningHorizonAge ?? 95}
              profileRetirementAge={profile.retirementAge}
              primaryLabel={primaryLabel}
              partnerLabel={partnerLabel}
            />
          }
          previewLabel="Vermögensentwicklung"
        >
        <ScenarioFormTabs
          initialScenario={initialScenario ?? null}
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          inheritanceDrafts={inheritanceDrafts}
          setInheritanceDrafts={setInheritanceDrafts}
          isCouple={isCouple}
          partnerProfile={partnerProfile}
          profile={profile}
          household={household}
          result={result}
          partnerResult={partnerResult}
          householdResult={householdResult}
          baseResult={baseResult}
          effectiveRetirementAge={effectiveRetirementAge}
          hasPillar3aChart={hasPillar3aChart}
          pensionIncomeSourceCount={pensionIncomeSourceCount}
          profileFreeAssetsReturnPercent={profileFreeAssetsReturnPercent}
          profileDefaults={profileDefaults}
          partnerProfileDefaults={partnerProfileDefaults}
          profileBvgPensionStart={profileBvgPensionStart}
          partnerBvgPensionStart={partnerBvgPensionStart}
          currentAge={currentAge}
          partnerCurrentAge={partnerCurrentAge}
          ahvReferenceAge={ahvReferenceAge}
          ahvEarliestAge={ahvEarliestAge}
          partnerAhvReferenceAge={partnerAhvReferenceAge}
          partnerAhvEarliestAge={partnerAhvEarliestAge}
          primaryAhvState={primaryAhvState}
          partnerAhvState={partnerAhvState}
          updatePrimaryAhv={updatePrimaryAhv}
          setPartnerAhvState={setPartnerAhvState}
          primaryBvgState={primaryBvgState}
          partnerBvgState={partnerBvgState}
          updatePrimaryBvg={updatePrimaryBvg}
          setPartnerBvgState={setPartnerBvgState}
          pillar3aOverrideState={pillar3aOverrideState}
          partnerPillar3aOverrideState={partnerPillar3aOverrideState}
          updatePillar3aOverride={updatePillar3aOverride}
          updatePartnerPillar3aOverride={updatePartnerPillar3aOverride}
          useRetirementAgeOverride={useRetirementAgeOverride}
          setUseRetirementAgeOverride={setUseRetirementAgeOverride}
          retirementAgeOverride={retirementAgeOverride}
          setRetirementAgeOverride={setRetirementAgeOverride}
          usePartnerRetirementOverride={usePartnerRetirementOverride}
          setUsePartnerRetirementOverride={setUsePartnerRetirementOverride}
          partnerRetirementAgeOverride={partnerRetirementAgeOverride}
          setPartnerRetirementAgeOverride={setPartnerRetirementAgeOverride}
          useWorkloadOverride={useWorkloadOverride}
          setUseWorkloadOverride={setUseWorkloadOverride}
          workloadReductions={workloadReductions}
          setWorkloadReductions={setWorkloadReductions}
          usePartnerWorkloadOverride={usePartnerWorkloadOverride}
          setUsePartnerWorkloadOverride={setUsePartnerWorkloadOverride}
          partnerWorkloadReductions={partnerWorkloadReductions}
          setPartnerWorkloadReductions={setPartnerWorkloadReductions}
          useFreeAssetsValueOverride={useFreeAssetsValueOverride}
          setUseFreeAssetsValueOverride={setUseFreeAssetsValueOverride}
          freeAssetsValueOverride={freeAssetsValueOverride}
          handleFreeAssetsChange={handleFreeAssetsChange}
          useFreeAssetsReturnOverride={useFreeAssetsReturnOverride}
          setUseFreeAssetsReturnOverride={setUseFreeAssetsReturnOverride}
          freeAssetsReturnOverride={freeAssetsReturnOverride}
          setFreeAssetsReturnOverride={setFreeAssetsReturnOverride}
          PercentInput={PercentInput}
        />
        </StickyPreviewLayout>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href={cancelHref}>Abbrechen</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            {initialScenario ? "Szenario aktualisieren" : "Szenario speichern"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

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
  return (
    <PercentStepperNumberInput
      value={value}
      onChange={(v) => {
        if (disabled) return;
        onChange(Math.min(max, Math.max(0, roundToStep(v, step))));
      }}
      step={step}
      max={max}
      disabled={disabled}
    />
  );
}

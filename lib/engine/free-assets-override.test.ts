import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateHouseholdPension } from "./household-orchestrator";
import { calculateScenarioPension } from "./orchestrator";
import type { HouseholdProfileForScenario } from "@/lib/household/types";

const profile = {
  birthDate: "1980-01-01",
  gender: "male" as const,
  employmentStartYear: 2000,
  retirementAge: 65,
  currentSalaryBrutto: 120_000,
  bvgCurrentCapital: 150_000,
  freeAssets: 500_000,
  freeAssetsInterestRate: 0.04,
  annualSavingsToFreeAssets: 10_000,
  planningHorizonAge: 85,
  pillar3aAccounts: [],
};

describe("scenario free assets overrides", () => {
  it("changes single-person projection for return and value overrides", () => {
    const base = calculateScenarioPension(profile, {});
    const highReturn = calculateScenarioPension(profile, {
      freeAssets: { returnRateOverride: 8 },
    });
    const highValue = calculateScenarioPension(profile, {
      freeAssets: { currentValueOverride: 800_000 },
    });

    const at60 = (r: typeof base) =>
      r.freeAssets?.projection.find((p) => p.age === 60)?.capitalEnd ?? 0;

    assert.ok(at60(highReturn) > at60(base));
    assert.ok(at60(highValue) > at60(base));
  });

  it("changes couple pooled projection for return and value overrides", () => {
    const household: HouseholdProfileForScenario = {
      planningMode: "couple",
      partnerEmploymentEndOffsetYears: 0,
      primary: { ...profile, annualRetirementExpenses: 80_000 },
      partner: {
        birthDate: "1983-01-01",
        gender: "female",
        employmentStartYear: 2002,
        retirementAge: 65,
        currentSalaryBrutto: 90_000,
        bvgCurrentCapital: 80_000,
        freeAssets: 100_000,
        freeAssetsInterestRate: 0.04,
        planningHorizonAge: 85,
        pillar3aAccounts: [],
      },
    };

    const base = calculateHouseholdPension(household, {});
    const highReturn = calculateHouseholdPension(household, {
      freeAssets: { returnRateOverride: 8 },
    });
    const highValue = calculateHouseholdPension(household, {
      freeAssets: { currentValueOverride: 800_000 },
    });

    const at60 = (r: typeof base) =>
      r.combinedProjection.find((p) => p.primaryAge === 60)?.capitalEnd ?? 0;

    assert.ok(at60(highReturn) > at60(base));
    assert.ok(at60(highValue) > at60(base));
  });

  it("keeps free assets overrides after couple AHV plafonierung recalculation", () => {
    const household: HouseholdProfileForScenario = {
      planningMode: "couple",
      partnerEmploymentEndOffsetYears: 0,
      primary: {
        ...profile,
        annualRetirementExpenses: 80_000,
        taxSettings: { maritalStatus: "married" },
      },
      partner: {
        birthDate: "1983-01-01",
        gender: "female",
        employmentStartYear: 2002,
        retirementAge: 65,
        currentSalaryBrutto: 90_000,
        bvgCurrentCapital: 80_000,
        freeAssets: 100_000,
        freeAssetsInterestRate: 0.04,
        planningHorizonAge: 85,
        pillar3aAccounts: [],
      },
    };

    const base = calculateHouseholdPension(household, {});
    const highValue = calculateHouseholdPension(household, {
      freeAssets: { currentValueOverride: 800_000 },
    });
    const highReturn = calculateHouseholdPension(household, {
      freeAssets: { returnRateOverride: 8 },
    });

    const primaryStart = (r: typeof base) =>
      r.primary.freeAssets?.projection[0]?.capitalStart ?? 0;
    const at60 = (r: typeof base) =>
      r.combinedProjection.find((p) => p.primaryAge === 60)?.capitalEnd ?? 0;

    assert.ok(primaryStart(highValue) > primaryStart(base));
    assert.ok(at60(highReturn) > at60(base));
  });
});

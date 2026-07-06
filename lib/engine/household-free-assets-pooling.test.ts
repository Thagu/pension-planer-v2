import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateHouseholdPension } from "./household-orchestrator";
import type { HouseholdProfileForScenario } from "@/lib/household/types";

const primaryBase = {
  birthDate: "1980-01-01",
  gender: "male" as const,
  employmentStartYear: 2005,
  retirementAge: 65,
  currentSalaryBrutto: 120_000,
  bvgCurrentCapital: 0,
  freeAssetsInterestRate: 0.04,
  annualSavingsToFreeAssets: 10_000,
  annualRetirementExpenses: 0,
  planningHorizonAge: 85,
  pillar3aAccounts: [],
};

const partnerBase = {
  birthDate: "1980-01-01",
  gender: "female" as const,
  employmentStartYear: 2005,
  retirementAge: 65,
  currentSalaryBrutto: 90_000,
  bvgCurrentCapital: 0,
  freeAssetsInterestRate: 0.04,
  annualSavingsToFreeAssets: 20_000,
  annualRetirementExpenses: 0,
  planningHorizonAge: 85,
  pillar3aAccounts: [],
};

function household(
  primaryFree: number,
  partnerFree: number,
): HouseholdProfileForScenario {
  return {
    planningMode: "couple",
    partnerEmploymentEndOffsetYears: 0,
    primary: { ...primaryBase, freeAssets: primaryFree },
    partner: { ...partnerBase, freeAssets: partnerFree },
  };
}

type Result = ReturnType<typeof calculateHouseholdPension>;

const capitalSeries = (r: Result) =>
  r.combinedProjection.map((p) => p.capitalEnd);

function assertSeriesClose(a: number[], b: number[], tol = 0.5) {
  assert.equal(a.length, b.length);
  a.forEach((value, i) => {
    assert.ok(
      Math.abs(value - b[i]) <= tol,
      `year index ${i}: ${value} vs ${b[i]}`,
    );
  });
}

const capitalAt = (r: Result, primaryAge: number) =>
  r.combinedProjection.find((p) => p.primaryAge === primaryAge)?.capitalEnd ?? 0;

describe("household free assets pooling identity", () => {
  it("pooling all capital on primary equals a split when both use the same rate", () => {
    const split = calculateHouseholdPension(household(300_000, 200_000));
    const pooled = calculateHouseholdPension(household(500_000, 0));

    assertSeriesClose(capitalSeries(pooled), capitalSeries(split));
  });

  it("a scenario return-rate override applies uniformly to the whole pool", () => {
    const overrides = { freeAssets: { returnRateOverride: 8 } };
    const split = calculateHouseholdPension(household(300_000, 200_000), overrides);
    const pooled = calculateHouseholdPension(household(500_000, 0), overrides);

    // Identity must hold even under the override: partner (savings-only) must use
    // the same overridden rate as primary, otherwise the sub-pots would diverge.
    assertSeriesClose(capitalSeries(pooled), capitalSeries(split));

    // And the override must actually raise the pooled capital vs. the base rate.
    const base = calculateHouseholdPension(household(500_000, 0));
    assert.ok(capitalAt(pooled, 64) > capitalAt(base, 64));
  });
});

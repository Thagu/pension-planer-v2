import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateHouseholdPension } from "./household-orchestrator";

const household = {
  planningMode: "couple" as const,
  partnerEmploymentEndOffsetYears: 0,
  primary: {
    birthDate: "1970-01-01",
    gender: "male" as const,
    employmentStartYear: 1990,
    retirementAge: 65,
    currentSalaryBrutto: 150_000,
    bvgCurrentCapital: 500_000,
    freeAssets: 3_000_000,
    freeAssetsInterestRate: 0.04,
    annualSavingsToFreeAssets: 0,
    annualRetirementExpenses: 90_000,
    annualSurvivorExpenses: 55_000,
    planningHorizonAge: 90,
    inflationRate: 0.015,
    pillar3aAccounts: [],
  },
  partner: {
    birthDate: "1975-01-01",
    gender: "female" as const,
    employmentStartYear: 1995,
    retirementAge: 65,
    currentSalaryBrutto: 120_000,
    bvgCurrentCapital: 300_000,
    freeAssets: 0,
    freeAssetsInterestRate: 0.04,
    annualSavingsToFreeAssets: 0,
    annualRetirementExpenses: 0,
    planningHorizonAge: 85,
    pillar3aAccounts: [],
  },
};

const overrides = {
  ahv: { employmentEndAgeOverride: 55, retirementAgeOverride: 55 },
  partner: {
    ahv: { employmentEndAgeOverride: 43, retirementAgeOverride: 43 },
    bvg: { pensionStartAgeOverride: 60 },
  },
};

describe("household wealth at first death (pooled)", () => {
  it("does not apply survivor wealth transfer as injection", () => {
    const result = calculateHouseholdPension(household, overrides);
    const transfers = result.combinedProjection.filter(
      (row) => (row.survivorWealthTransfer ?? 0) > 0,
    );
    assert.equal(transfers.length, 0);
  });

  it("has no artificial capital jump beyond interest, savings and injections at first death", () => {
    const result = calculateHouseholdPension(household, overrides);
    const rows = result.combinedProjection;
    const deathIdx = rows.findIndex((row) => row.cashflowPhase === "survivor");
    assert.ok(deathIdx > 0, "expected survivor phase");

    const prev = rows[deathIdx - 1];
    const cur = rows[deathIdx];
    const growth = cur.capitalEnd - prev.capitalEnd;
    const maxPlausibleGrowth =
      prev.interest + cur.savingsContribution + cur.capitalInjection + 1;

    assert.ok(
      growth <= maxPlausibleGrowth,
      `unexpected wealth jump at first death (year ${cur.year}): +${growth} ` +
        `(max plausible +${maxPlausibleGrowth}); ` +
        `inheritance=${cur.inheritanceInjection}, xfer=${cur.survivorWealthTransfer}, ` +
        `wdr ${prev.annualWithdrawal}->${cur.annualWithdrawal}`,
    );
  });
});

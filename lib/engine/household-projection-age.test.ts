import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateHouseholdPension } from "./household-orchestrator";

describe("household combined projection ages", () => {
  it("has no duplicate primary ages on the timeline (chart x-axis)", () => {
    const household = {
      planningMode: "couple" as const,
      partnerEmploymentEndOffsetYears: 0,
      primary: {
        birthDate: "1970-06-15",
        gender: "male" as const,
        employmentStartYear: 1990,
        retirementAge: 65,
        currentSalaryBrutto: 150_000,
        bvgCurrentCapital: 500_000,
        freeAssets: 1_500_000,
        freeAssetsInterestRate: 0.04,
        annualSavingsToFreeAssets: 10_000,
        annualRetirementExpenses: 90_000,
        annualSurvivorExpenses: 55_000,
        planningHorizonAge: 90,
        inflationRate: 0.015,
        pillar3aAccounts: [],
      },
      partner: {
        birthDate: "1975-03-20",
        gender: "female" as const,
        employmentStartYear: 1995,
        retirementAge: 65,
        currentSalaryBrutto: 120_000,
        bvgCurrentCapital: 300_000,
        freeAssets: 0,
        freeAssetsInterestRate: 0.04,
        annualSavingsToFreeAssets: 10_000,
        annualRetirementExpenses: 0,
        planningHorizonAge: 95,
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

    const result = calculateHouseholdPension(household, overrides);
    const ages = result.combinedProjection.map((row) => row.primaryAge);

    const duplicates: number[] = [];
    for (let i = 1; i < ages.length; i++) {
      if (ages[i] === ages[i - 1]) {
        duplicates.push(ages[i]);
      }
    }

    assert.equal(
      duplicates.length,
      0,
      `duplicate primary ages found: ${[...new Set(duplicates)].join(", ")}`,
    );
  });
});

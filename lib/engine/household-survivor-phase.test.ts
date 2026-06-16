import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateHouseholdPension } from "./household-orchestrator";
import type { HouseholdProfileForScenario } from "@/lib/household/types";

const survivorHousehold: HouseholdProfileForScenario = {
  planningMode: "couple",
  partnerEmploymentEndOffsetYears: 0,
  primary: {
    birthDate: "1960-01-01",
    gender: "male",
    employmentStartYear: 1985,
    retirementAge: 65,
    currentSalaryBrutto: 0,
    bvgCurrentCapital: 400_000,
    freeAssets: 600_000,
    annualRetirementExpenses: 120_000,
    annualSurvivorExpenses: 110_000,
    planningHorizonAge: 80,
    pillar3aAccounts: [],
  },
  partner: {
    birthDate: "1965-01-01",
    gender: "female",
    employmentStartYear: 1990,
    retirementAge: 65,
    currentSalaryBrutto: 0,
    bvgCurrentCapital: 200_000,
    freeAssets: 100_000,
    annualRetirementExpenses: 0,
    planningHorizonAge: 90,
    pillar3aAccounts: [],
  },
};

describe("household survivor phase (pooled cashflow)", () => {
  it("does not apply survivorWealthTransfer when wealth is pooled", () => {
    const result = calculateHouseholdPension(survivorHousehold);
    const transfers = result.combinedProjection.filter(
      (row) => (row.survivorWealthTransfer ?? 0) > 0,
    );
    assert.equal(transfers.length, 0);
  });

  it("uses survivor living expenses after first partner death", () => {
    const result = calculateHouseholdPension(survivorHousehold);
    const survivorRows = result.combinedProjection.filter(
      (row) => row.cashflowPhase === "survivor",
    );
    assert.ok(survivorRows.length > 0);
    for (const row of survivorRows) {
      assert.ok((row.netLivingExpenses ?? 0) > 0);
      assert.equal(row.primaryAge >= 80, true);
    }
  });

  it("reduces pooled wealth when survivor income is below expenses", () => {
    const result = calculateHouseholdPension(survivorHousehold);
    const survivorRows = result.combinedProjection.filter(
      (row) => row.cashflowPhase === "survivor",
    );
    assert.ok(survivorRows.length >= 3);

    const first = survivorRows[0];
    const later = survivorRows[survivorRows.length - 1];
    assert.ok(
      later.capitalEnd < first.capitalEnd,
      `expected wealth to decline in survivor phase (${first.capitalEnd} -> ${later.capitalEnd})`,
    );

    for (let i = 1; i < survivorRows.length; i++) {
      const prev = survivorRows[i - 1];
      const row = survivorRows[i];
      const growth = row.capitalEnd - prev.capitalEnd;
      const maxPlausibleGrowth =
        prev.interest + row.savingsContribution + row.capitalInjection + 1;
      assert.ok(
        growth <= maxPlausibleGrowth,
        `unexpected wealth jump at year ${row.year}: +${growth}`,
      );
    }
  });

  it("stops counting deceased partner flows after planning horizon", () => {
    const result = calculateHouseholdPension(survivorHousehold);
    const afterPrimaryDeath = result.combinedProjection.filter(
      (row) => row.primaryAge >= 80,
    );
    assert.ok(afterPrimaryDeath.length > 0);
    for (const row of afterPrimaryDeath) {
      assert.equal(row.primaryCapitalEnd, 0);
      assert.equal(row.primaryBvgCapitalInjection, 0);
      assert.equal(row.primaryPillar3aCapitalInjection, 0);
    }
  });
});

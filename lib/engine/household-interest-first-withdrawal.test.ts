import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateHouseholdPension } from "./household-orchestrator";
import type { HouseholdProfileForScenario } from "@/lib/household/types";

const retiredCouple: HouseholdProfileForScenario = {
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
    freeAssetsInterestRate: 0.05,
    annualRetirementExpenses: 120_000,
    planningHorizonAge: 75,
    pillar3aAccounts: [],
  },
  partner: {
    birthDate: "1960-01-01",
    gender: "female",
    employmentStartYear: 1990,
    retirementAge: 65,
    currentSalaryBrutto: 0,
    bvgCurrentCapital: 200_000,
    freeAssets: 100_000,
    freeAssetsInterestRate: 0.05,
    annualRetirementExpenses: 0,
    planningHorizonAge: 75,
    pillar3aAccounts: [],
  },
};

describe("household pooled wealth interest-first withdrawal", () => {
  it("credits portfolio interest on pooled capital before net withdrawals", () => {
    const result = calculateHouseholdPension(retiredCouple);
    const retirementRows = result.combinedProjection.filter(
      (row) => row.cashflowPhase === "full_retirement",
    );
    assert.ok(retirementRows.length >= 2);

    for (const row of retirementRows) {
      if ((row.annualWithdrawal ?? 0) <= 0 && row.interest <= 0) continue;

      const principalChange =
        row.capitalEnd -
        row.capitalStart -
        row.savingsContribution -
        row.capitalInjection;
      const expectedPrincipalChange = -(row.annualWithdrawal + row.annualTotalTax);

      assert.equal(
        principalChange,
        expectedPrincipalChange,
        `year ${row.year}: principal change ${principalChange} vs expected ${expectedPrincipalChange}`,
      );
    }
  });

  it("shows principal-only withdrawal after interest offset in display", () => {
    const result = calculateHouseholdPension(retiredCouple);
    const row = result.combinedProjection.find(
      (r) => r.cashflowPhase === "full_retirement" && r.interest > 0,
    );
    assert.ok(row);
    const grossNeed = Math.max(
      0,
      (row!.annualGrossExpenses ?? 0) - row!.annualPensionIncome,
    );
    assert.ok(
      (row!.annualWithdrawal ?? 0) <= grossNeed,
      "displayed withdrawal should not exceed gross wealth need",
    );
    if (grossNeed > row!.interest) {
      assert.equal(row!.annualWithdrawal, grossNeed - row!.interest);
    } else {
      assert.equal(row!.annualWithdrawal, 0);
    }
  });

  it("uses scaled interest when pool capital is below summed individual balances", () => {
    const result = calculateHouseholdPension(retiredCouple);
    const laterRows = result.combinedProjection.filter(
      (row) =>
        row.cashflowPhase === "full_retirement" &&
        row.primaryAge >= 70 &&
        (row.annualWithdrawal ?? 0) > 0,
    );
    assert.ok(laterRows.length > 0);

    for (const row of laterRows) {
      if (row.capitalStart <= 0) continue;
      const impliedRate = row.interest / row.capitalStart;
      assert.ok(
        impliedRate > 0.03 && impliedRate < 0.07,
        `expected ~5% interest on pool at year ${row.year}, got ${impliedRate}`,
      );
    }
  });

  it("applies scenario free-assets return rate override to pooled preview", () => {
    const base = calculateHouseholdPension(retiredCouple);
    const overridden = calculateHouseholdPension(retiredCouple, {
      freeAssets: { returnRateOverride: 10 },
    });

    const baseRow = base.combinedProjection.find(
      (row) => row.cashflowPhase === "full_retirement" && row.interest > 0,
    );
    const overrideRow = overridden.combinedProjection.find(
      (row) => row.year === baseRow!.year,
    );

    assert.ok(baseRow);
    assert.ok(overrideRow);
    assert.ok(
      overrideRow!.interest > baseRow!.interest,
      `expected higher interest with 10% override, got ${overrideRow!.interest} vs ${baseRow!.interest}`,
    );
  });
});

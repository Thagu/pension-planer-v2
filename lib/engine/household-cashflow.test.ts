import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeNetLivingExpenses,
  yearsSinceHouseholdExpenseStart,
} from "./household-cashflow";

describe("yearsSinceHouseholdExpenseStart", () => {
  const anchor = { primaryEmploymentEnd: 56, partnerEmploymentEnd: 65 };

  it("returns 0 before any household retirement", () => {
    const years = yearsSinceHouseholdExpenseStart(
      { primaryAge: 50, partnerAge: 48 },
      anchor,
    );
    assert.equal(years, 0);
  });

  it("counts years from first retirement when only primary is retired", () => {
    const years = yearsSinceHouseholdExpenseStart(
      { primaryAge: 60, partnerAge: 58 },
      anchor,
    );
    assert.equal(years, 4);
  });

  it("does not reset inflation when partner retires later", () => {
    const years = yearsSinceHouseholdExpenseStart(
      { primaryAge: 65, partnerAge: 65 },
      anchor,
    );
    assert.equal(years, 9);
  });
});

describe("computeNetLivingExpenses", () => {
  const base = 130_000;
  const inflation = 0.02;

  it("inflates ~9 years when partner retires at 65 and primary at 56", () => {
    const netLiving = computeNetLivingExpenses(
      { primaryAge: 65, partnerAge: 65 },
      base,
      inflation,
      56,
      65,
    );
    const expected = Math.round(base * Math.pow(1 + inflation, 9));
    assert.equal(netLiving, expected);
    assert.notEqual(netLiving, base);
  });

  it("uses survivor base after first partner reaches planning horizon", () => {
    const survivorBase = 90_000;
    const netLiving = computeNetLivingExpenses(
      { primaryAge: 95, partnerAge: 92 },
      base,
      inflation,
      65,
      65,
      {
        baseSurvivorLiving: survivorBase,
        primaryHorizonAge: 95,
        partnerHorizonAge: 95,
      },
    );
    const yearsSinceStart = 95 - 65;
    const expected = Math.round(survivorBase * Math.pow(1 + inflation, yearsSinceStart));
    assert.equal(netLiving, expected);
  });
});

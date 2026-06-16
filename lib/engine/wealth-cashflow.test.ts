import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyWealthYearCashflow,
  computePortfolioInterest,
} from "./wealth-cashflow";

describe("applyWealthYearCashflow", () => {
  it("consumes interest before principal when withdrawal is smaller", () => {
    const result = applyWealthYearCashflow({
      poolStart: 100_000,
      savingsContribution: 0,
      portfolioInterest: 5_000,
      capitalInjection: 0,
      netWithdrawal: 3_000,
      annualTotalTax: 0,
    });
    assert.equal(result.withdrawalFromInterest, 3_000);
    assert.equal(result.withdrawalFromPrincipal, 0);
    assert.equal(result.capitalEnd, 102_000);
  });

  it("touches principal only for the remainder when withdrawal exceeds interest", () => {
    const result = applyWealthYearCashflow({
      poolStart: 100_000,
      savingsContribution: 0,
      portfolioInterest: 5_000,
      capitalInjection: 0,
      netWithdrawal: 8_000,
      annualTotalTax: 0,
    });
    assert.equal(result.withdrawalFromInterest, 5_000);
    assert.equal(result.withdrawalFromPrincipal, 3_000);
    assert.equal(result.capitalEnd, 97_000);
  });

  it("does not consume negative interest toward withdrawals", () => {
    const result = applyWealthYearCashflow({
      poolStart: 100_000,
      savingsContribution: 0,
      portfolioInterest: -2_000,
      capitalInjection: 0,
      netWithdrawal: 5_000,
      annualTotalTax: 0,
    });
    assert.equal(result.withdrawalFromInterest, 0);
    assert.equal(result.withdrawalFromPrincipal, 5_000);
    assert.equal(result.capitalEnd, 93_000);
  });

  it("adds savings and injections after interest-first withdrawal", () => {
    const result = applyWealthYearCashflow({
      poolStart: 200_000,
      savingsContribution: 10_000,
      portfolioInterest: 8_000,
      capitalInjection: 50_000,
      netWithdrawal: 12_000,
      annualTotalTax: 1_000,
    });
    assert.equal(result.withdrawalFromInterest, 8_000);
    assert.equal(result.withdrawalFromPrincipal, 4_000);
    assert.equal(result.capitalEnd, 255_000);
  });
});

describe("computePortfolioInterest", () => {
  it("scales interest when pooled capital diverges from summed individuals", () => {
    const pooled = computePortfolioInterest(
      500_000,
      0,
      700_000,
      35_000,
      0,
    );
    assert.equal(pooled, 25_000);
  });

  it("returns reference interest when pool matches combined start", () => {
    const pooled = computePortfolioInterest(
      700_000,
      0,
      700_000,
      35_000,
      0,
    );
    assert.equal(pooled, 35_000);
  });
});

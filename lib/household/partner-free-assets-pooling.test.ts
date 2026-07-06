import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { partnerDataToProfileForScenario } from "./partner-profile";
import type { PartnerProfileData } from "./types";

const partnerData: PartnerProfileData = {
  birth_date: "1983-01-01",
  gender: "female",
  employment_start_year: 2005,
  retirement_age: 64,
  current_salary_brutto: 90_000,
  bvg_current_capital: 80_000,
  free_assets: 123_456, // legacy value that must be ignored (pooled to primary)
  bvg_interest_rate: null,
  bvg_conversion_rate: null,
  bvg_contribution_rates: null,
  bvg_coordinated_salary_override: null,
  free_assets_interest_rate: 0.02, // must be ignored: household rate wins
  annual_savings_to_free_assets: 15_000,
  workload_reductions: null,
  employment_end_offset_years: 0,
};

describe("partnerDataToProfileForScenario – free assets pooling", () => {
  it("forces partner free assets to 0 and adopts the household return rate", () => {
    const result = partnerDataToProfileForScenario(partnerData, [], {
      planningHorizonAge: 95,
      freeAssetsReturnRate: 0.05,
    });

    assert.ok(result);
    assert.equal(result.freeAssets, 0);
    assert.equal(result.freeAssetsInterestRate, 0.05);
  });

  it("keeps the per-person savings rate (flows into the shared pot)", () => {
    const result = partnerDataToProfileForScenario(partnerData, [], {
      freeAssetsReturnRate: 0.04,
    });

    assert.ok(result);
    assert.equal(result.annualSavingsToFreeAssets, 15_000);
  });

  it("uses null household rate when none is provided", () => {
    const result = partnerDataToProfileForScenario(partnerData, [], {});

    assert.ok(result);
    assert.equal(result.freeAssets, 0);
    assert.equal(result.freeAssetsInterestRate, null);
  });
});

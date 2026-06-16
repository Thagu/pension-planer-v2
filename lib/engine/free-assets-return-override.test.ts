import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateScenarioPension } from "./orchestrator";
import type { ProfileForScenario } from "./orchestrator";

const profile: ProfileForScenario = {
  birthDate: "1980-01-01",
  gender: "male",
  employmentStartYear: 2000,
  retirementAge: 65,
  currentSalaryBrutto: 120_000,
  bvgCurrentCapital: 100_000,
  freeAssets: 200_000,
  freeAssetsInterestRate: 0.04,
  annualSavingsToFreeAssets: 10_000,
  planningHorizonAge: 85,
  pillar3aAccounts: [],
};

describe("single scenario free-assets return rate override", () => {
  it("changes wealth projection when return rate override is set", () => {
    const base = calculateScenarioPension(profile, {});
    const high = calculateScenarioPension(profile, {
      freeAssets: { returnRateOverride: 8 },
    });
    const low = calculateScenarioPension(profile, {
      freeAssets: { returnRateOverride: 2 },
    });

    const baseEnd = base.freeAssets?.projection.at(-1)?.capitalEnd ?? 0;
    const highEnd = high.freeAssets?.projection.at(-1)?.capitalEnd ?? 0;
    const lowEnd = low.freeAssets?.projection.at(-1)?.capitalEnd ?? 0;

    assert.ok(highEnd > baseEnd);
    assert.ok(lowEnd < baseEnd);
  });
});

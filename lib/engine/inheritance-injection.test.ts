import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateFreeAssetsPension } from "./modules/free-assets";

describe("free assets inheritance injection", () => {
  it("tracks Erbschaft separately from BVG and 3a markers", () => {
    const result = calculateFreeAssetsPension({
      birthDate: "1980-01-01",
      currentValue: 100_000,
      retirementAge: 65,
      planningHorizonAge: 70,
      annualRetirementExpenses: 40_000,
      scheduledInjections: [
        {
          atAge: 62,
          amount: 200_000,
          label: "Erbschaft / Schenkung",
          source: "other",
        },
      ],
    });

    const row = result.projection.find((p) => p.age === 62);
    assert.ok(row);
    assert.equal(row.inheritanceInjection, 200_000);
    assert.equal(row.bvgCapitalInjection, 0);
    assert.equal(row.pillar3aCapitalInjection, 0);
    assert.equal(row.capitalInjection, 200_000);
  });
});

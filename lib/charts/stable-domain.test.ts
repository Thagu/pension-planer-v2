import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  roundChartCeiling,
  resolveStableAxisMax,
} from "@/lib/charts/stable-domain";

describe("roundChartCeiling", () => {
  it("rounds up to 500k steps above 2M", () => {
    assert.equal(roundChartCeiling(4_200_000), 5_000_000);
  });
});

describe("resolveStableAxisMax", () => {
  it("keeps previous max within ±20%", () => {
    const first = resolveStableAxisMax(4_000_000, null);
    const second = resolveStableAxisMax(4_300_000, first);
    assert.equal(second, first);
  });

  it("updates when data exceeds +20%", () => {
    const first = resolveStableAxisMax(4_000_000, null);
    const second = resolveStableAxisMax(5_500_000, first);
    assert.ok(second > first);
  });
});

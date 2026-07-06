import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildVorsorgeIncomeTimeline } from "@/components/scenarios/vorsorge-income-timeline-chart";
import type { ScenarioPensionResult } from "@/lib/engine";

/** Minimal-Stub eines ScenarioPensionResult (nur die vom Builder gelesenen Felder). */
function makeResult(
  ahvPension: number,
  bvgPension: number,
): ScenarioPensionResult {
  return {
    ahv: { pensionStartAge: 65, yearlyPension: ahvPension },
    bvg: { pensionStartAge: 65, yearlyPension: bvgPension },
    freeAssets: null,
    summary: { employmentEndAge: 65 },
  } as unknown as ScenarioPensionResult;
}

const currentYear = new Date().getFullYear();
// Person 1 aktuell 64, Horizont 90 → Tod im Jahr, in dem P1 90 wird.
const primaryBirthDate = `${currentYear - 64}-01-01`;
// Person 2 jünger (aktuell 59), Horizont 95 → Timeline läuft über P1-Tod hinaus.
const partnerBirthDate = `${currentYear - 59}-01-01`;

describe("buildVorsorgeIncomeTimeline – Einkommen endet mit dem Tod", () => {
  const primary = makeResult(30_000, 20_000);
  const partner = makeResult(24_000, 16_000);

  const timeline = buildVorsorgeIncomeTimeline(
    primary,
    primaryBirthDate,
    90,
    partner,
    partnerBirthDate,
    95,
  );

  it("zeigt AHV/BVG für Person 1 vor dem Tod (Alter 80)", () => {
    const row = timeline.find((r) => r.primaryAge === 80);
    assert.ok(row, "Zeile mit Alter 80 sollte existieren");
    assert.equal(row!.primary.ahv, 30_000);
    assert.equal(row!.primary.bvg, 20_000);
    assert.ok(row!.primary.total > 0);
  });

  it("nullt das Einkommen von Person 1 ab dem Planungshorizont (Alter ≥ 90)", () => {
    const deadRows = timeline.filter((r) => r.primaryAge >= 90);
    assert.ok(deadRows.length > 0, "Timeline sollte über P1-Tod hinausgehen");
    for (const row of deadRows) {
      assert.equal(row.primary.ahv, 0, `AHV bei Alter ${row.primaryAge}`);
      assert.equal(row.primary.bvg, 0, `BVG bei Alter ${row.primaryAge}`);
      assert.equal(row.primary.total, 0, `Total bei Alter ${row.primaryAge}`);
    }
  });

  it("Haushalts-Total enthält nach P1-Tod nur noch Person 2", () => {
    const row = timeline.find((r) => r.primaryAge >= 90 && r.partner != null);
    assert.ok(row);
    assert.equal(row!.household.total, row!.partner?.total ?? 0);
  });

  it("Einzelmodus: Einkommen am Horizont-Alter bleibt erhalten (kein Todes-Cap)", () => {
    const single = buildVorsorgeIncomeTimeline(primary, primaryBirthDate, 90);
    const last = single[single.length - 1];
    assert.equal(last.primaryAge, 90);
    assert.ok(last.primary.total > 0, "Einzelperson lebt bis und mit Horizont");
  });
});

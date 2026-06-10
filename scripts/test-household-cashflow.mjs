/**
 * Smoke test: Haushalts-Inflationsanker (yearsSinceHouseholdExpenseStart)
 * Spiegelt lib/engine/household-cashflow.ts — bei Abweichung anpassen.
 */

function yearsSinceHouseholdExpenseStart(row, opts) {
  const primaryStarted = row.primaryAge >= opts.primaryEmploymentEnd;
  const partnerStarted =
    opts.partnerEmploymentEnd != null &&
    row.partnerAge != null &&
    row.partnerAge >= opts.partnerEmploymentEnd;

  if (!primaryStarted && !partnerStarted) return 0;

  const candidates = [];
  if (primaryStarted) {
    candidates.push(row.primaryAge - opts.primaryEmploymentEnd);
  }
  if (partnerStarted && row.partnerAge != null) {
    candidates.push(row.partnerAge - opts.partnerEmploymentEnd);
  }
  return Math.max(...candidates);
}

function inflateAmount(base, rate, years) {
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0 || years <= 0) return Math.round(base);
  return Math.round(base * (1 + rate) ** years);
}

let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    failed++;
  } else {
    console.log("OK:", message);
  }
}

// Partner pensioniert: früherer Bug Math.min → 0
const yearsAtPartnerRetirement = yearsSinceHouseholdExpenseStart(
  { primaryAge: 65, partnerAge: 65 },
  { primaryEmploymentEnd: 56, partnerEmploymentEnd: 65 },
);
assert(yearsAtPartnerRetirement === 9, "9 Jahre seit erstem Ruhestand (P1 mit 56)");

const inflated = inflateAmount(130_000, 0.02, yearsAtPartnerRetirement);
assert(inflated > 130_000, `Teuerung > 130k (${inflated})`);
assert(
  Math.abs(inflated - 130_000 * 1.02 ** 9) < 500,
  "ca. 130k × 1.02^9",
);

// Nur P1 pensioniert
const mixedYears = yearsSinceHouseholdExpenseStart(
  { primaryAge: 60, partnerAge: 58 },
  { primaryEmploymentEnd: 56, partnerEmploymentEnd: 65 },
);
assert(mixedYears === 4, "Mischphase: 4 Jahre seit P1-Ruhestand");

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log("\nAll household cashflow tests passed.");

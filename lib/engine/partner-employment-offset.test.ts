import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateHouseholdPension } from "./household-orchestrator";
import {
  derivePartnerEmploymentEndAge,
  derivePartnerEmploymentEndAgeForFi,
  parseEmploymentEndOffsetYears,
  parsePartnerProfileData,
  partnerAgeInCalendarYear,
} from "@/lib/household/partner-profile";
import type { HouseholdProfileForScenario } from "@/lib/household/types";

describe("parseEmploymentEndOffsetYears", () => {
  it("defaults invalid values to 0", () => {
    assert.equal(parseEmploymentEndOffsetYears(null), 0);
    assert.equal(parseEmploymentEndOffsetYears(-3), 0);
  });

  it("clamps large offsets", () => {
    assert.equal(parseEmploymentEndOffsetYears(99), 52);
  });
});

describe("derivePartnerEmploymentEndAge", () => {
  it("returns same age when offset is 0", () => {
    assert.equal(derivePartnerEmploymentEndAge(58, 0), 58);
  });

  it("adds offset years", () => {
    assert.equal(derivePartnerEmploymentEndAge(58, 3), 61);
  });

  it("clamps to 18–70", () => {
    assert.equal(derivePartnerEmploymentEndAge(68, 5), 70);
    assert.equal(derivePartnerEmploymentEndAge(15, 0), 18);
  });
});

describe("derivePartnerEmploymentEndAgeForFi", () => {
  it("uses partner age at primary stop when offset is 0", () => {
    const partnerEnd = derivePartnerEmploymentEndAgeForFi(
      "1980-01-01",
      "1983-01-01",
      58,
      0,
    );
    assert.equal(partnerEnd, 55);
    assert.notEqual(partnerEnd, 58);
  });

  it("adds calendar offset years after primary stop", () => {
    const partnerEnd = derivePartnerEmploymentEndAgeForFi(
      "1980-01-01",
      "1983-01-01",
      58,
      3,
    );
    assert.equal(partnerEnd, 58);
  });

  it("matches primary age when birth dates are equal", () => {
    assert.equal(
      derivePartnerEmploymentEndAgeForFi("1980-01-01", "1980-01-01", 60, 0),
      60,
    );
  });
});

describe("parsePartnerProfileData", () => {
  it("reads employment_end_offset_years from JSON", () => {
    const parsed = parsePartnerProfileData({
      birth_date: "1980-01-01",
      employment_end_offset_years: 4,
    });
    assert.equal(parsed?.employment_end_offset_years, 4);
  });
});

describe("household FI partner salary at simultaneous stop", () => {
  const household: HouseholdProfileForScenario = {
    planningMode: "couple",
    partnerEmploymentEndOffsetYears: 0,
    primary: {
      birthDate: "1980-01-01",
      gender: "male",
      employmentStartYear: 2000,
      retirementAge: 65,
      currentSalaryBrutto: 120_000,
      bvgCurrentCapital: 150_000,
      freeAssets: 200_000,
      annualRetirementExpenses: 80_000,
      planningHorizonAge: 95,
      pillar3aAccounts: [],
    },
    partner: {
      birthDate: "1983-01-01",
      gender: "female",
      employmentStartYear: 2002,
      retirementAge: 65,
      currentSalaryBrutto: 90_000,
      bvgCurrentCapital: 80_000,
      freeAssets: 50_000,
      annualRetirementExpenses: 0,
      planningHorizonAge: 95,
      pillar3aAccounts: [],
    },
  };

  it("stops partner salary when primary reaches FI trial age with offset 0", () => {
    const primaryFiAge = 58;
    const partnerEnd = derivePartnerEmploymentEndAgeForFi(
      household.primary.birthDate,
      household.partner!.birthDate,
      primaryFiAge,
      0,
    );

    const result = calculateHouseholdPension(household, {
      ahv: {
        employmentEndAgeOverride: primaryFiAge,
        retirementAgeOverride: primaryFiAge,
      },
      partner: {
        ahv: {
          employmentEndAgeOverride: partnerEnd,
          retirementAgeOverride: partnerEnd,
        },
      },
    });

    const retirementRow = result.combinedProjection.find(
      (row) => row.primaryAge === primaryFiAge,
    );
    assert.ok(retirementRow, "expected projection row at primary FI age");
    assert.equal(retirementRow.primaryAge, primaryFiAge);
    assert.equal(retirementRow.partnerAge, partnerEnd);
    assert.equal(retirementRow.employmentIncomeNet ?? 0, 0);
    assert.notEqual(retirementRow.cashflowPhase, "mixed");
  });

  it("keeps mixed phase when partner employment continues after primary FI", () => {
    const primaryFiAge = 58;
    const partnerEnd = derivePartnerEmploymentEndAgeForFi(
      household.primary.birthDate,
      household.partner!.birthDate,
      primaryFiAge,
      3,
    );

    const result = calculateHouseholdPension(
      { ...household, partnerEmploymentEndOffsetYears: 3 },
      {
        ahv: {
          employmentEndAgeOverride: primaryFiAge,
          retirementAgeOverride: primaryFiAge,
        },
        partner: {
          ahv: {
            employmentEndAgeOverride: partnerEnd,
            retirementAgeOverride: partnerEnd,
          },
        },
      },
    );

    const mixedRow = result.combinedProjection.find(
      (row) => row.primaryAge === primaryFiAge,
    );
    assert.ok(mixedRow);
    assert.equal(mixedRow.cashflowPhase, "mixed");
    assert.equal(mixedRow.employmentIncomeNet ?? 0, 0);
  });

  it("reduces partner BVG contributions in mixed phase when workload override is 1%", () => {
    const primaryFiAge = 58;
    const partnerEnd = derivePartnerEmploymentEndAgeForFi(
      household.primary.birthDate,
      household.partner!.birthDate,
      primaryFiAge,
      3,
    );

    const fullSalaryResult = calculateHouseholdPension(
      { ...household, partnerEmploymentEndOffsetYears: 3 },
      {
        ahv: {
          employmentEndAgeOverride: primaryFiAge,
          retirementAgeOverride: primaryFiAge,
        },
        partner: {
          ahv: {
            employmentEndAgeOverride: partnerEnd,
            retirementAgeOverride: partnerEnd,
          },
        },
      },
    );

    const reducedWorkloadResult = calculateHouseholdPension(
      { ...household, partnerEmploymentEndOffsetYears: 3 },
      {
        ahv: {
          employmentEndAgeOverride: primaryFiAge,
          retirementAgeOverride: primaryFiAge,
        },
        partner: {
          ahv: {
            employmentEndAgeOverride: partnerEnd,
            retirementAgeOverride: partnerEnd,
          },
          workloadReductions: [{ fromAge: 18, workloadPercent: 1 }],
        },
      },
    );

    const fullMixed = fullSalaryResult.combinedProjection.find(
      (row) => row.cashflowPhase === "mixed",
    );
    const reducedMixed = reducedWorkloadResult.combinedProjection.find(
      (row) => row.cashflowPhase === "mixed",
    );
    assert.ok(fullMixed);
    assert.ok(reducedMixed);
    assert.ok((fullMixed.bvgEmployeeContributionActive ?? 0) > 0);
    assert.ok(
      (reducedMixed.bvgEmployeeContributionActive ?? 0) <
        (fullMixed.bvgEmployeeContributionActive ?? 0) / 10,
    );
  });
});

describe("partnerAgeInCalendarYear", () => {
  it("matches household projection age helper semantics", () => {
    assert.equal(partnerAgeInCalendarYear("1983-01-01", 2038), 55);
  });
});

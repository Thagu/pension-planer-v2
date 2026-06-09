/**
 * Fixed IDs for reproducible 3a withdrawal schedules in scenario JSON.
 * Valid UUID v4 format.
 */
export const PILLAR3A_IDS = {
  primaryKonto1: "a1000001-0001-4001-8001-000000000001",
  primaryKonto2: "a1000001-0001-4001-8001-000000000002",
  partnerKonto1: "a2000001-0001-4001-8001-000000000001",
};

/** Round CHF-friendly master profile (couple mode, married, ZH). */
export function buildMasterProfile(userId) {
  return {
    id: userId,
    birth_date: "1980-06-15",
    gender: "male",
    employment_start_year: 2002,
    retirement_age: 65,
    current_salary_brutto: 100000,
    bvg_current_capital: 200000,
    pillar3a_current_capital: 80000,
    free_assets: 400000,
    bvg_interest_rate: 0.02,
    bvg_conversion_rate: 0.068,
    bvg_contribution_rates: null,
    bvg_coordinated_salary_override: null,
    pillar3a_interest_rate: 0.03,
    free_assets_interest_rate: 0.04,
    annual_savings_to_free_assets: 20000,
    planning_horizon_age: 90,
    annual_retirement_expenses: 60000,
    pillar3a_auto_split_enabled: true,
    pillar3a_auto_split_threshold: 100000,
    pillar3a_auto_split_contribution_mode: "max",
    pillar3a_auto_split_name_prefix: "3a-Konto",
    marital_status: "married",
    tax_canton: "ZH",
    tax_postal_code: "8000",
    tax_municipality: "Zürich",
    tax_municipality_steuerfuss: null,
    inflation_rate: 0.02,
    workload_reductions: [{ fromAge: 62, workloadPercent: 80 }],
    planning_mode: "couple",
    partner_profile: {
      birth_date: "1985-06-15",
      gender: "female",
      employment_start_year: 2007,
      retirement_age: 65,
      current_salary_brutto: 80000,
      bvg_current_capital: 120000,
      free_assets: 100000,
      bvg_interest_rate: 0.02,
      bvg_conversion_rate: 0.068,
      bvg_contribution_rates: null,
      bvg_coordinated_salary_override: null,
      free_assets_interest_rate: 0.04,
      annual_savings_to_free_assets: 10000,
      workload_reductions: [],
    },
  };
}

export function buildPillar3aAccounts(userId) {
  return [
    {
      id: PILLAR3A_IDS.primaryKonto1,
      user_id: userId,
      person: "primary",
      name: "3a Konto 1",
      provider: "Testbank",
      current_value: 50000,
      annual_contribution: 6000,
      return_rate: 0.03,
      withdrawal_year_offset: 0,
      sort_order: 0,
    },
    {
      id: PILLAR3A_IDS.primaryKonto2,
      user_id: userId,
      person: "primary",
      name: "3a Konto 2",
      provider: "Testbank",
      current_value: 30000,
      annual_contribution: 4000,
      return_rate: 0.03,
      withdrawal_year_offset: 2,
      sort_order: 1,
    },
    {
      id: PILLAR3A_IDS.partnerKonto1,
      user_id: userId,
      person: "partner",
      name: "Partner 3a",
      provider: "Testbank",
      current_value: 40000,
      annual_contribution: 5000,
      return_rate: 0.03,
      withdrawal_year_offset: 0,
      sort_order: 0,
    },
  ];
}

const { primaryKonto1, primaryKonto2, partnerKonto1 } = PILLAR3A_IDS;

/**
 * 18 test scenarios — simple round numbers, edge + mid cases.
 * Stored as scenarios.data (ScenarioOverrides JSON).
 */
export function buildTestScenarios(userId) {
  return [
    {
      name: "TEST: 01 Baseline (master defaults)",
      data: {
        description: "No overrides — validates master data + couple profile baseline.",
      },
    },
    {
      name: "TEST: 02 Early retirement at 58",
      data: {
        description: "Employment ends at minimum BVG edge (58).",
        ahv: {
          employmentEndAgeOverride: 58,
          retirementAgeOverride: 58,
          pensionStartAgeOverride: null,
          missingContributionYears: 0,
          averageIncomeOverride: null,
        },
      },
    },
    {
      name: "TEST: 03 AHV early 63 + 5 missing years",
      data: {
        description: "Vorbezug AHV + contribution gap (mid/edge AHV).",
        ahv: {
          employmentEndAgeOverride: 63,
          retirementAgeOverride: 63,
          pensionStartAgeOverride: 63,
          missingContributionYears: 5,
          averageIncomeOverride: null,
        },
      },
    },
    {
      name: "TEST: 04 AHV deferred to 67",
      data: {
        description: "Late AHV pension start (upper edge).",
        ahv: {
          employmentEndAgeOverride: 65,
          retirementAgeOverride: 65,
          pensionStartAgeOverride: 67,
          missingContributionYears: 0,
          averageIncomeOverride: null,
        },
      },
    },
    {
      name: "TEST: 05 BVG 50% capital, 3 tranches",
      data: {
        description: "Half PK capital to free assets, spread over 3 years.",
        bvg: {
          capitalWithdrawalPercent: 50,
          capitalWithdrawalTranches: 3,
        },
      },
    },
    {
      name: "TEST: 06 BVG no coordination deduction",
      data: {
        description: "Full salary insured (coordination none).",
        bvg: {
          coordinationDeductionMode: "none",
        },
      },
    },
    {
      name: "TEST: 07 Staggered 3a withdrawal 0-2-4",
      data: {
        description: "Three PK-linked 3a offsets for primary accounts.",
        pillar3a: {
          withdrawalSchedule: {
            [primaryKonto1]: 0,
            [primaryKonto2]: 2,
          },
        },
      },
    },
    {
      name: "TEST: 08 Inheritance CHF 500k at 70",
      data: {
        description: "Single lump-sum inheritance at Person 1 age 70.",
        inheritance: [{ atAge: 70, amount: 500000, recipient: "household" }],
      },
    },
    {
      name: "TEST: 09 Workload 60% from age 55",
      data: {
        description: "Scenario workload override (partial retirement).",
        workloadReductions: [{ fromAge: 55, workloadPercent: 60 }],
      },
    },
    {
      name: "TEST: 10 Free assets 8% return",
      data: {
        description: "High return override on free assets only.",
        freeAssets: {
          returnRateOverride: 8,
        },
      },
    },
    {
      name: "TEST: 11 Low AHV income CHF 50k",
      data: {
        description: "Edge: low average income → lower AHV scale.",
        ahv: {
          averageIncomeOverride: 50000,
        },
      },
    },
    {
      name: "TEST: 12 BVG 100% capital, 1 tranche",
      data: {
        description: "Edge: full PK capital withdrawal immediately.",
        bvg: {
          capitalWithdrawalPercent: 100,
          capitalWithdrawalTranches: 1,
        },
      },
    },
    {
      name: "TEST: 13 Couple — partner retires 60",
      data: {
        description: "Primary 65, partner stops at 60.",
        ahv: {
          employmentEndAgeOverride: 65,
          retirementAgeOverride: 65,
        },
        partner: {
          ahv: {
            employmentEndAgeOverride: 60,
            retirementAgeOverride: 60,
          },
        },
      },
    },
    {
      name: "TEST: 14 Couple — partner AHV 62 + BVG 25% capital",
      data: {
        description: "Partner early AHV + small PK capital take.",
        partner: {
          ahv: {
            pensionStartAgeOverride: 62,
          },
          bvg: {
            capitalWithdrawalPercent: 25,
            capitalWithdrawalTranches: 2,
          },
        },
      },
    },
    {
      name: "TEST: 15 Couple — partner workload 50% at 58",
      data: {
        description: "Partner partial retirement only.",
        partner: {
          workloadReductions: [{ fromAge: 58, workloadPercent: 50 }],
        },
      },
    },
    {
      name: "TEST: 16 Combined stress scenario",
      data: {
        description: "Early retire + BVG capital + inheritance + staggered 3a.",
        ahv: {
          employmentEndAgeOverride: 60,
          retirementAgeOverride: 60,
        },
        bvg: {
          capitalWithdrawalPercent: 30,
          capitalWithdrawalTranches: 2,
        },
        pillar3a: {
          withdrawalSchedule: {
            [primaryKonto1]: 0,
            [primaryKonto2]: 3,
          },
        },
        inheritance: [{ atAge: 68, amount: 200000, recipient: "household" }],
      },
    },
    {
      name: "TEST: 17 3a account 1 capital doubled",
      data: {
        description: "Per-account capital override on first 3a account.",
        pillar3a: {
          accountOverrides: {
            [primaryKonto1]: {
              currentCapitalOverride: 100000,
            },
          },
        },
      },
    },
    {
      name: "TEST: 18 Late retire 70 + low free assets",
      data: {
        description: "Edge: late employment end + reduced free assets pool.",
        ahv: {
          employmentEndAgeOverride: 70,
          retirementAgeOverride: 70,
        },
        freeAssets: {
          currentValueOverride: 100000,
        },
      },
    },
    {
      name: "TEST: 19 Partner 3a staggered + primary baseline",
      data: {
        description: "Partner-only 3a schedule offset 1 year.",
        partner: {
          pillar3a: {
            withdrawalSchedule: {
              [partnerKonto1]: 1,
            },
          },
        },
      },
    },
    {
      name: "TEST: 20 Mid-case — retire 63, BVG 6.8% UWS, 20% capital",
      data: {
        description: "Typical mid-path: retire 63, modest capital, standard UWS.",
        ahv: {
          employmentEndAgeOverride: 63,
          retirementAgeOverride: 63,
        },
        bvg: {
          conversionRateOverride: 6.8,
          capitalWithdrawalPercent: 20,
          capitalWithdrawalTranches: 2,
        },
      },
    },
  ].map((s) => ({
    user_id: userId,
    name: s.name,
    data: s.data,
  }));
}

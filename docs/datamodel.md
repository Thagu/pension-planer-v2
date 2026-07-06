# Swiss Pension Planner — Data Model (v3)

> **Version:** 3.0 (June 2026)  
> **Language:** English  
> **Companion docs:** [requirements.md](./requirements.md) · [architecture.md](./architecture.md) · [user_stories.md](./user_stories.md)  
> **Source of truth:** `supabase/migrations/001`–`015` + TypeScript types in `lib/engine/`, `lib/household/`

---

## 1. Design Principles

| Principle | Implementation |
|-----------|----------------|
| Master data vs scenarios | Profile = baseline; scenario `data` JSON = overrides only |
| JSON flexibility | Scenario overrides and partner profile avoid frequent migrations |
| Rate storage | DB stores decimals (0.068); UI often shows percent (6.8); normalize on read |
| Couple mode | Partner is JSON on `profiles.partner_profile`, not a separate user |
| Free assets pooling | Free assets (start capital + return + inheritance) are **one household value** on `primary`; the partner holds `free_assets = 0`. Only the savings rate (`annual_savings_to_free_assets`) stays per person and flows into the shared pool until each person's employment end. |
| Engine types ≠ DB rows | `loadProfileForScenario()` maps DB → `ProfileForScenario` |

---

## 2. Database Schema

### 2.1 `profiles` (1:1 with `auth.users`)

```sql
-- Core (001_initial_schema.sql + later migrations)
id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
birth_date date
gender text CHECK (gender IN ('male', 'female'))
employment_start_year integer
retirement_age integer NOT NULL DEFAULT 65  -- CHECK 58–70
current_salary_brutto numeric(14,2) NOT NULL DEFAULT 0
bvg_current_capital numeric(14,2) NOT NULL DEFAULT 0
pillar3a_current_capital numeric(14,2) NOT NULL DEFAULT 0  -- legacy aggregate
free_assets numeric(14,2) NOT NULL DEFAULT 0
bvg_interest_rate numeric(8,6)
bvg_conversion_rate numeric(8,6)
bvg_contribution_rates jsonb
pillar3a_interest_rate numeric(8,6)
free_assets_interest_rate numeric(8,6)
bvg_coordinated_salary_override numeric(14,2)
annual_savings_to_free_assets numeric(14,2) NOT NULL DEFAULT 0
created_at timestamptz
updated_at timestamptz

-- 003_profile_coordinated_salary_and_savings.sql (included above)

-- 005_profile_planning_and_3a_auto_split.sql
planning_horizon_age integer          -- CHECK 58–110
annual_retirement_expenses numeric(14,2) NOT NULL DEFAULT 0
pillar3a_auto_split_enabled boolean NOT NULL DEFAULT false
pillar3a_auto_split_threshold numeric(14,2)
pillar3a_auto_split_contribution_mode text NOT NULL DEFAULT 'max'
  CHECK (pillar3a_auto_split_contribution_mode IN ('max', 'last'))
pillar3a_auto_split_name_prefix text NOT NULL DEFAULT '3a-Konto'

-- 006_tax_settings.sql
tax_canton text
tax_municipality text
tax_municipality_steuerfuss numeric(7,2)

-- 008_schema_hardening.sql: dropped tax_use_manual_rates and *_rate_override columns
-- Effective rates resolved from reference tables only

-- 008_schema_hardening.sql / extensions (via lib/profile/extensions.ts)
marital_status text                   -- 'single' | 'married'

-- 009_tax_postal_code.sql
tax_postal_code text

-- 010_workload_reductions.sql
workload_reductions jsonb NOT NULL DEFAULT '[]'
  -- [{ "fromAge": 60, "workloadPercent": 80 }, ...] max 2 entries

-- 011_household_partner.sql
planning_mode text NOT NULL DEFAULT 'single'
  CHECK (planning_mode IN ('single', 'couple'))
partner_profile jsonb                 -- PartnerProfileData (see §4)

-- 012_inflation_rate.sql
inflation_rate numeric(8,6)           -- decimal e.g. 0.02; null = no inflation in engine

-- 013_annual_survivor_expenses.sql
annual_survivor_expenses numeric(14,2) -- household expenses after first death (couple)

-- 014_onboarding_completed.sql
onboarding_completed_at timestamptz
onboarding_skipped_at timestamptz

-- 015_household_free_assets.sql (data migration, idempotent)
--   couple profiles: free_assets += partner_profile->>'free_assets'; partner value → 0
--   free assets become one household value (see §4.1)
```

**Note:** `email` is **not** stored on `profiles`; it lives on `auth.users` only (v1 datamodel incorrectly showed email on profile).

### 2.2 `scenarios`

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
name text NOT NULL
data jsonb NOT NULL DEFAULT '{}'    -- ScenarioOverrides (see §5)
created_at timestamptz
updated_at timestamptz
```

### 2.3 `pillar3a_accounts`

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
name text NOT NULL DEFAULT '3a-Konto'
provider text
current_value numeric(14,2) NOT NULL DEFAULT 0
annual_contribution numeric(14,2) NOT NULL DEFAULT 0
return_rate numeric(8,6)
withdrawal_year_offset integer NOT NULL DEFAULT 0  -- legacy; prefer scenario JSON
sort_order integer NOT NULL DEFAULT 0
person text NOT NULL DEFAULT 'primary'             -- 011: 'primary' | 'partner'
created_at timestamptz
updated_at timestamptz
```

### 2.4 Tax reference tables (007, 009)

```sql
-- Enum
tax_marital_status: 'single' | 'married'

tax_federal_reference (
  marital_status tax_marital_status PRIMARY KEY,
  tax_amounts jsonb NOT NULL,    -- keys: "50000", "100000", ... → CHF tax
  source_notes text,
  updated_by uuid,
  created_at, updated_at
)

tax_local_reference (
  id uuid PRIMARY KEY,
  canton_code text NOT NULL,
  municipality text NOT NULL,
  municipality_key text NOT NULL,
  postal_code text,              -- 009
  marital_status tax_marital_status NOT NULL,
  tax_amounts jsonb NOT NULL,
  canton_share_of_local numeric(5,4),
  ...
)
```

### 2.5 Wealth tables (002 — **not used by app UI**)

Migration `002_wealth_tables.sql` defines:

- `wealth_accounts` — typed buckets (cash, ETF, stocks, bonds, real_estate, other)
- `wealth_transactions` — cashflow history
- `wealth_snapshots` — point-in-time balances

These tables exist in the schema but have **no** corresponding UI, loaders, or engine integration in v2.

---

## 3. Engine Profile Types

### 3.1 `ProfileForScenario` (`lib/engine/orchestrator.ts`)

Runtime input for calculations (mapped from DB):

```typescript
interface ProfileForScenario {
  birthDate: string;
  gender?: "male" | "female" | null;
  employmentStartYear?: number | null;
  retirementAge: number;
  currentSalaryBrutto: number;
  bvgCurrentCapital: number;
  freeAssets: number;
  bvgInterestRate?: number | null;
  bvgConversionRate?: number | null;
  bvgContributionRates?: Record<string, number> | null;
  bvgCoordinatedSalaryOverride?: number | null;
  freeAssetsInterestRate?: number | null;
  annualSavingsToFreeAssets?: number | null;
  pillar3aDefaultReturnRate?: number | null;
  pillar3aAccounts?: Pillar3aAccountForScenario[];
  pillar3aAutoSplit?: {
    enabled: boolean;
    threshold: number;
    contributionMode: "max" | "last";
    namePrefix: string;
  };
  planningHorizonAge?: number | null;
  annualRetirementExpenses?: number | null;
  inflationRate?: number | null;   // decimal; from profiles.inflation_rate
  workloadReductions?: WorkloadReduction[];
  taxSettings?: TaxSettings;
}
```

### 3.2 `Pillar3aAccountForScenario`

```typescript
interface Pillar3aAccountForScenario {
  id: string;
  name: string;
  currentCapital: number;
  annualContribution: number;
  returnRate?: number | null;
}
```

### 3.3 `WorkloadReduction` (`lib/engine/workload.ts`)

```typescript
interface WorkloadReduction {
  fromAge: number;           // integer age
  workloadPercent: number;   // 1–100
}
// Max 2 entries per person, sorted by fromAge
```

---

## 4. Household Types (`lib/household/types.ts`)

### 4.1 `PartnerProfileData` (stored in `profiles.partner_profile`)

Mirror of primary person fields (subset):

```typescript
type PartnerProfileData = {
  birth_date?: string | null;
  gender?: "male" | "female" | null;
  employment_start_year?: number | null;
  retirement_age?: number | null;
  current_salary_brutto?: number | null;
  bvg_current_capital?: number | null;
  free_assets?: number | null;               // pooled → always 0 (see below)
  bvg_interest_rate?: number | null;
  bvg_conversion_rate?: number | null;
  bvg_contribution_rates?: Record<string, number> | null;
  bvg_coordinated_salary_override?: number | null;
  free_assets_interest_rate?: number | null; // pooled → ignored; household rate used
  annual_savings_to_free_assets?: number | null; // per person, into shared pool
  workload_reductions?: WorkloadReduction[] | null;
};
```

**Free assets pooling (couple mode).** Free assets are a single household value. The
household start capital lives on `profiles.free_assets` and the return rate on
`profiles.free_assets_interest_rate` (both edited once in the master-data "Planung" tab
and the wizard "Planung" step). When the partner `ProfileForScenario` is assembled in
[`partnerDataToProfileForScenario`](../lib/household/partner-profile.ts), `freeAssets` is
forced to `0` and `freeAssetsInterestRate` is set to the household rate (`primary`'s rate,
passed as `shared.freeAssetsReturnRate`). Because both persons then use the same rate, the
engine's `primary + partner` sum in `combineYearRows` is mathematically identical to one
shared pot. A scenario **return-rate override** is propagated to the partner as well (so the
whole pool reacts uniformly), while the **value override** stays on `primary` only to avoid
double-counting the capital. The per-person `annual_savings_to_free_assets` keeps flowing into
this pool until each person's own employment end (incl. workload reductions).

Migration `015_household_free_assets.sql` folds any legacy partner `free_assets` into
`profiles.free_assets` and resets the partner value to `0` (idempotent).

### 4.2 `HouseholdProfileForScenario`

```typescript
type HouseholdProfileForScenario = {
  planningMode: "single" | "couple";
  primary: ProfileForScenario;
  partner: ProfileForScenario | null;
};
```

### 4.3 `InheritanceEvent`

```typescript
type InheritanceEvent = {
  atAge: number;              // Person 1 reference age
  amount: number;
  recipient?: "household" | "primary" | "partner";
};
```

### 4.4 `CombinedWealthYearProjection`

Merged household row (one per calendar year):

```typescript
type CombinedWealthYearProjection = {
  year: number;
  primaryAge: number;
  partnerAge: number | null;
  capitalStart: number;
  capitalEnd: number;
  primaryCapitalEnd: number;
  partnerCapitalEnd: number;
  savingsContribution: number;
  interest: number;
  capitalInjection: number;
  annualPensionIncome: number;
  annualTotalIncome: number;
  annualTotalExpenses: number;
  annualGrossExpenses: number;
  annualWithdrawal: number;
  annualTotalTax: number;
  cumulativeIncome: number;
  cumulativeExpenses: number;
  inheritanceInjection: number;
  bvgCapitalInjection: number;
  pillar3aCapitalInjection: number;
  primaryBvgCapitalInjection: number;
  partnerBvgCapitalInjection: number;
  primaryPillar3aCapitalInjection: number;
  partnerPillar3aCapitalInjection: number;
  survivorWealthTransfer?: number;
};
```

---

## 5. Scenario Overrides (`ScenarioOverrides`)

Stored in `scenarios.data` JSON:

```typescript
interface ScenarioOverrides {
  description?: string;
  ahv?: {
    employmentEndAgeOverride?: number | null;
    retirementAgeOverride?: number | null;  // deprecated alias
    pensionStartAgeOverride?: number | null;
    missingContributionYears?: number;
    averageIncomeOverride?: number | null;
  };
  bvg?: {
    pensionStartAgeOverride?: number | null;
    conversionRateOverride?: number | null;
    interestRateOverride?: number | null;
    coordinationDeductionMode?: "standard" | "none" | "custom" | null;
    customContributionRates?: Record<string, number> | null;
    capitalWithdrawalPercent?: number | null;    // 0–100 UI percent
    capitalWithdrawalTranches?: number | null;   // 1–5
  };
  pillar3a?: {
    withdrawalSchedule?: Record<string, number>;
    withdrawalAgeOverrides?: Record<string, number | null>;
    accountOverrides?: Record<string, {
      currentCapitalOverride?: number | null;
      annualContributionOverride?: number | null;
      returnRateOverride?: number | null;
    }>;
  };
  freeAssets?: {
    currentValueOverride?: number | null;
    returnRateOverride?: number | null;
  };
  workloadReductions?: WorkloadReduction[] | null;
  inheritance?: InheritanceEvent[] | null;
  partner?: ScenarioOverrides | null;
}
```

---

## 6. Engine Output Types

### 6.1 `ScenarioPensionResult`

```typescript
interface ScenarioPensionResult {
  ahv: AhvResult;
  bvg: BvgResult;
  pillar3a: Pillar3aResult;
  freeAssets: FreeAssetsResult | null;
  summary: {
    monthlyAhv: number;
    monthlyBvg: number;
    monthlyFreeAssets: number;
    monthlyTotal: number;
    yearlyTotal: number;
    projectedCapitalBvg: number;
    projectedCapitalPillar3a: number;
    projectedCapitalFreeAssets: number;
    totalCapitalInjectionsToFreeAssets: number;
    bvgCapitalToFreeAssets: number;
    pillar3aCapitalToFreeAssets: number;
    employmentEndAge: number;
    ahvPensionStartAge: number;
    bvgPensionStartAge: number;
    monthlyTotalAtEmploymentEnd: number;
    monthlyTotalAtHorizon: number;
  };
}
```

Each module result includes `explanation: { label, value, detail? }[]`.

### 6.2 `FreeAssetsYearProjection` (per person, per year)

```typescript
interface FreeAssetsYearProjection {
  age: number;
  year: number;
  capitalStart: number;
  capitalEnd: number;
  savingsContribution: number;
  interest: number;
  capitalInjection: number;
  bvgCapitalInjection: number;
  pillar3aCapitalInjection: number;
  annualGrossExpenses: number;
  annualPensionOffset: number;
  annualWithdrawal: number;
  annualPensionIncome: number;
  annualTotalIncome: number;
  annualTotalExpenses: number;
  cumulativeIncome: number;
  cumulativeExpenses: number;
  annualTaxableAdditionalIncome: number;
  annualFederalTax: number;
  annualCantonalTax: number;
  annualMunicipalTax: number;
  annualTotalTax: number;
}
```

### 6.3 `FinancialIndependenceResult`

```typescript
type FinancialIndependenceResult =
  | {
      ok: true;
      independenceAge: number;
      yearsUntil: number;
      currentAge: number;
      profileRetirementAge: number;
      planningHorizonAge: number;
      yearsEarlierThanPlanned: number | null;
      endCapitalAtHorizon: number;
      minCapitalDuringRetirement: number;
      monthlyIncomeAtHorizon: number;
      summaryText: string;
      explanation: string[];
      timeline: FinancialIndependenceTimeline;
    }
  | {
      ok: false;
      reason: string;
      missingFields?: string[];
      timeline?: FinancialIndependenceTimeline;
      ...
    };
```

---

## 7. Tax Types (`lib/tax/types.ts`)

```typescript
type TaxMaritalStatus = "single" | "married";

interface TaxSettings {
  maritalStatus?: TaxMaritalStatus | null;
  cantonCode?: string | null;
  municipality?: string | null;
  municipalitySteuerfuss?: number | null;
  useManualRates?: boolean;
  federalRateOverride?: number | null;
  cantonRateOverride?: number | null;
  municipalRateOverride?: number | null;
  resolvedFederal?: FederalTaxReference | null;
  resolvedLocal?: LocalTaxReference | null;
}
```

Tax is computed on **additional income** (pensions + taxable capital withdrawals), not employment salary.

---

## 8. Mapping Layer

| Function | File | Role |
|----------|------|------|
| `loadUserProfile` | `lib/profile/load-profile.ts` | Raw DB row + extensions |
| `loadProfileForScenario` | `lib/profile/load-profile.ts` | → `ProfileForScenario` + 3a + tax |
| `loadHouseholdProfile` | `lib/profile/load-household-profile.ts` | → `HouseholdProfileForScenario` |
| `profileRowToScenarioInput` | `lib/scenarios/profile.ts` | Field name mapping |
| `parsePartnerProfileData` | `lib/household/partner-profile.ts` | JSON → partner profile |
| `taxSettingsFromScenarioProfile` | `lib/tax/profile-tax.ts` | Tax settings for engine |

---

## 9. Legacy Types (`lib/engine/types.ts`)

The file `lib/engine/types.ts` still contains **v1 MVP shapes** (`YearlyData`, `ScenarioInput` with `assumptions.inflationRate`, `salaryOverrides`, `plannedCareerBreaks`, `retirementGap`). These are **not** used by the current orchestrator. The live pipeline uses types in §3–§6 above.

---

## 10. Not Implemented (from v1 Specs)

Fields, tables, and output shapes that appeared in the **v1 datamodel** but are **missing or unused** in v2:

| v1 item | v1 description | v2 status |
|---------|------------------|-----------|
| **`YearlyData` pipe object** | Unified timeline with `rates.inflation`, `isRetired`, all pillars | Replaced by per-module projections (`FreeAssetsYearProjection`, etc.) |
| **`rates.inflation` per year** | Dynamic inflation in timeline | **Partial** — single profile rate compounds selected flows; no per-year rate object |
| **`salaryOverrides`** | `Record<year, salary>` for AHV Level C | **Not implemented** |
| **`plannedCareerBreaks`** | Calendar years with zero employment | **Not implemented** — replaced by `workloadReductions` (partial retirement %) |
| **`assumptions.inflationRate`** | Global scenario assumption | **Implemented** on `profiles.inflation_rate` (012); engine compounds salary, savings, 3a, expenses |
| **`assumptions` block** | Single object for all return rates | Rates live on profile fields / scenario overrides instead |
| **Single `pillar3a` object** | One capital + one contribution | Replaced by `pillar3a_accounts` table + multi-account engine |
| **`retirementGap`** | `{ monthly, percentage }` vs desired income | **Not implemented** |
| **`monthlyIncomeAtRetirement` vs Wunsheinkommen** | Gap analysis in summary | **Not implemented** |
| **`email` on profiles** | Stored on profile row | Only on `auth.users` |
| **`scenarios.input`** | Column name in v1 | Actual column is `scenarios.data` |
| **`wealth_accounts` / transactions / snapshots** | Full wealth bucket model (002) | Tables exist; **no UI, no engine** |
| **`account_type: real_estate`** | Property bucket | **Not implemented** |
| **Pillar 3a as capital statement only** | “No drawdown in MVP” | **Implemented** — full withdrawal + injection to free assets |
| **Partner as second user account** | Implied in some designs | Partner is JSON blob, same login |
| **Inflation + static salary** | “Statisch + Inflation (vorbereitet)” | Salary/savings/3a/expenses compound when `inflation_rate` set; pensions not indexed |

### Partial implementations

| v1 item | Notes |
|---------|-------|
| Erwerbsunterbrüche | Workload % reductions cover partial retirement, not full career breaks |
| Kapitalverzehr | Free-assets drawdown through horizon; no separate longevity / annuitization module |
| Steueroptimierung | Capital withdrawal optimizer + tax on additional income; not full income tax planning |
| Koordinationsabzug `custom` | Custom CHF amount via profile only; scenario UI offers standard vs none |

See [requirements.md §13](./requirements.md#13-not-implemented-from-v1-specs) for the complete product backlog.

---

## Appendix: QA Test Fixtures (`lib/seed/test-fixtures.mjs`)

Used by `npm run seed:test` (`scripts/seed-test-data.mjs`):

| Fixture | Contents |
|---------|----------|
| `buildMasterProfile(userId)` | Couple mode, ZH tax domicile, inflation 2%, round CHF numbers |
| `buildPillar3aAccounts(userId)` | 3 accounts (2 primary, 1 partner) with fixed UUIDs |
| `buildTestScenarios(userId)` | 20 scenarios named `TEST: …` covering edge and mid cases |

Old `TEST:` scenarios for the target user are deleted before re-insert. Requires `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_DB_URL`; optional `TEST_USER_EMAIL`.

---

## Appendix: Document History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2024 | German; YearlyData; single 3a; inflation in schema; retirementGap |
| v2 | May 2026 | English; actual migrations 001–011; household types; legacy types noted |
| v3 | June 2026 | Migration 012 inflation_rate; tax override columns removed (008); seed fixtures documented |
| v4 | July 2026 | Migrations 013–015; free assets pooled to one household value (015), savings stay per person; onboarding flags (014) |

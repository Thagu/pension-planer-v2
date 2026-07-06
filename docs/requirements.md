# Swiss Pension Planner — Requirements (v3)

> **Version:** 3.0 (June 2026)  
> **Language:** English  
> **Supersedes:** All v1 docs in this folder (German MVP). See [README.md](./README.md) for the full doc set.  
> **Purpose:** Complete product and technical requirements reflecting the **currently implemented** application, sufficient for an agent to rebuild the app from scratch.

---

## 1. Vision & Strategy

Build a modular web application for **Swiss retirement planning** that delivers a **semi-professional estimate (precision level B+)** — more accurate than rule-of-thumb calculators, but simpler than full financial advisory software.

The user should be able to:

1. Enter master data once (single person or couple).
2. Create multiple what-if **scenarios** with pillar-specific overrides.
3. See year-by-year projections for AHV (1st pillar), BVG (2nd pillar), Pillar 3a, and free assets.
4. Understand **financial independence (FI)** — the earliest sustainable retirement age.
5. Explore **tax impact** of capital withdrawals and additional retirement income.
6. In **couple mode**, model household wealth, AHV plafonierung, survivor wealth transfer, and side-by-side per-person views.

**Design principles:**

- **Modular calculation engine** — each pillar is independently testable; an orchestrator combines results.
- **Client-side computation** — projections run in the browser (TypeScript); no separate calculation API required for MVP+.
- **Cloud persistence** — Supabase Auth + PostgreSQL with row-level security.
- **Scenario overrides** — master data is the baseline; scenarios store JSON deltas only.
- **Swiss UX conventions** — CHF formatting, German UI labels acceptable; this spec is in English for rebuild agents.

---

## 2. Target Users

| Segment | Supported | Notes |
|---------|-----------|-------|
| Swiss residents, age ~30–65 | Yes | Primary audience |
| Employees (AHV + BVG) | Yes | Core use case |
| Couples / married households | Yes | `planning_mode = couple` |
| Self-employed | No | Out of scope |
| Property / home ownership | No | Out of scope |
| Financial advisors (multi-client) | No | Single user account only |

**Disclaimer:** The app is an educational planning tool, not regulated financial advice.

---

## 3. Core Decisions (Implemented)

| Topic | Decision |
|-------|----------|
| Precision level | B+ (semi-professional): simplified but defensible Swiss rules |
| Projection paradigm | Year-by-year iterative simulation from current age to planning horizon |
| Modularity | Technical (no user-facing module toggles) |
| AHV model | Level B: contribution years + average income (MDJE), early/deferral adjustments |
| AHV couple rules | 150% max pension cap (Plafonierung) when married + couple mode |
| BVG | Age-based contribution rates, coordinated salary, capital vs annuity split |
| Pillar 3a | Multi-account, staggered withdrawals, auto-split when threshold reached |
| 3a contribution stop | When **any** account starts withdrawal, **all** 3a contributions for that person stop |
| Free assets | Capital drawdown simulation with pension income offset, savings, taxes |
| Workload / partial retirement | Up to 2 workload reduction steps per person; affects salary, BVG, 3a, savings |
| Tax | Federal + cantonal + municipal on additional income (capital + pensions); ESTV postal lookup + reference tables |
| Inflation in projections | Optional `profiles.inflation_rate` (decimal, e.g. 0.02); compounds salary, savings, 3a contributions, and retirement expenses year-by-year; **pension indexation not modeled** |
| Persistence | Supabase cloud |
| Planning modes | Single person or couple (partner stored in JSON on profile) |
| Scenarios | Multiple per user; JSON `ScenarioOverrides` |
| PWA / offline | **Not implemented** |
| PDF export | **Not implemented** |

---

## 4. Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js (App Router), React, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Auth & DB | Supabase (Auth, PostgreSQL, RLS) |
| Charts | Custom React/SVG components (CSS `--chart-*` variables) |
| Engine | `lib/engine/` — pure TypeScript, runs client-side and in server components |
| Household layer | `lib/household/`, `lib/engine/household-orchestrator.ts` |
| Tax reference | `lib/tax/`, ESTV local tax lookup, admin reference pages |
| Formatting | `lib/format/numbers.ts` — Swiss number/percent parsing |

**Key routes:**

| Route | Purpose |
|-------|---------|
| `/` | Home / navigation |
| `/auth/login`, `/auth/sign-up`, `/auth/forgot-password` | Supabase password auth |
| `/master-data` | Master data form (single/couple) |
| `/scenarios` | Scenario list |
| `/scenarios/new`, `/scenarios/[id]` | Create / edit scenario |
| `/tax-reference/federal` | Admin-style federal tax reference viewer |

---

## 5. Authentication & Security

### 5.1 Requirements

- Email + password registration and login via Supabase Auth.
- Session via cookies (`@supabase/ssr`).
- Password reset flow.
- Protected routes redirect unauthenticated users to `/auth/login`.
- **Post-login redirect:** `/` (home), not a demo page.
- Email confirmation links target `/auth/confirm`, then redirect to `/` (or `next` param).
- Auto-create empty `profiles` row on user signup (DB trigger).

### 5.2 Row-Level Security

- `profiles`: user can CRUD only where `id = auth.uid()`.
- `scenarios`: user can CRUD only where `user_id = auth.uid()`.
- `pillar3a_accounts`: user can CRUD only where `user_id = auth.uid()`.
- Tax reference tables: read-only for authenticated users (admin seed data).

---

## 6. Data Model

### 6.1 `profiles` (1:1 with `auth.users`)

Master data for the primary person + household settings.

**Person fields (primary):**

| Field | Type | Description |
|-------|------|-------------|
| `birth_date` | date | Required for calculations |
| `gender` | `male` \| `female` | AHV reference age, 3a withdrawal window |
| `employment_start_year` | integer | AHV contribution years |
| `retirement_age` | integer (58–70) | Default employment end / planned retirement |
| `current_salary_brutto` | numeric | Gross annual salary at 100% workload |
| `bvg_current_capital` | numeric | Current BVG old-age credit |
| `free_assets` | numeric | Free (non-pillar) wealth. **Household value** (one pot): in couple mode this holds the whole household's start capital; the partner's `free_assets` is `0`. |
| `bvg_interest_rate` | numeric (decimal) | BVG interest assumption |
| `bvg_conversion_rate` | numeric (decimal) | BVG conversion rate (UWS) for annuity |
| `bvg_contribution_rates` | jsonb | Age-band → rate map (decimal or % stored) |
| `bvg_coordinated_salary_override` | numeric | Optional fixed coordination deduction |
| `free_assets_interest_rate` | numeric | Expected return on free assets. **Household value**; the partner inherits this rate (partner-stored rate is ignored). |
| `annual_savings_to_free_assets` | numeric | Annual savings into the (shared) free assets while employed. **Stays per person** and flows into the household pot until that person's employment end. |
| `workload_reductions` | jsonb | `[{fromAge, workloadPercent}]`, max 2 entries |
| `planning_horizon_age` | integer (58–110) | Projection end age (e.g. 90) |
| `annual_retirement_expenses` | numeric | Household annual expenses after retirement |
| `inflation_rate` | numeric (decimal) | Annual inflation (0.02 = 2%); compounds salary, savings, 3a, expenses |
| `pillar3a_interest_rate` | numeric | Default 3a return if account has no override |

**Pillar 3a auto-split (primary; inherited by partner in couple mode):**

| Field | Type | Description |
|-------|------|-------------|
| `pillar3a_auto_split_enabled` | boolean | Open new 3a account when threshold hit |
| `pillar3a_auto_split_threshold` | numeric | Capital threshold per account |
| `pillar3a_auto_split_contribution_mode` | `max` \| `last` | Contribution for new account |
| `pillar3a_auto_split_name_prefix` | text | Name prefix for auto-generated accounts |

**Tax settings:**

| Field | Type | Description |
|-------|------|-------------|
| `tax_canton` | text | Canton code (ZH, BE, …) |
| `tax_postal_code` | text | For ESTV municipality lookup |
| `tax_municipality` | text | Municipality name |
| `tax_municipality_steuerfuss` | numeric | Municipal tax multiplier (%) |

Manual effective-rate override columns were **removed** in migration 008; rates come from reference tables only.

| `marital_status` | `single` \| `married` | Affects tax + AHV couple plafonierung |

**Household:**

| Field | Type | Description |
|-------|------|-------------|
| `planning_mode` | `single` \| `couple` | Planning mode |
| `partner_profile` | jsonb | Mirror of person fields for partner (see `PartnerProfileData`); includes optional `employment_end_offset_years` (0 = Arbeitsstopp mit Person 1, >0 = X Jahre später für Haushalts-FI) |

Legacy column `pillar3a_current_capital` may exist but **multi-account table is authoritative**.

### 6.2 `pillar3a_accounts`

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Owner |
| `person` | `primary` \| `partner` | Account owner in couple mode |
| `name` | text | Display name |
| `provider` | text | Optional |
| `current_value` | numeric | Current capital |
| `annual_contribution` | numeric | Planned annual contribution |
| `return_rate` | numeric | Optional per-account return override |
| `withdrawal_year_offset` | integer | Legacy; scenario JSON preferred |
| `sort_order` | integer | UI ordering |

**Limits:** Max accounts per person defined in engine constants (`PILLAR_3A_MAX_ACCOUNTS`); max annual contribution = legal 3a limit.

### 6.3 `scenarios`

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Owner |
| `name` | text | Scenario name |
| `data` | jsonb | `ScenarioOverrides` (see §8) |

---

## 7. Master Data (UI & Behavior)

### 7.1 Single Mode

- One column of person fields: demographics, employment, BVG, free assets, workload, per-person 3a accounts.
- Household-level fields: planning horizon, annual retirement expenses, **inflation rate**, tax settings, 3a auto-split settings.
- Sections wrapped in **collapsible cards** (`CollapsibleCard`); numeric fields use **stepper inputs** with CHF-aware steps.
- **Financial Independence panel** recalculates **live** from current form values (`parse-form-profile.ts`) — no save or manual recalc button required.
- **Sticky preview layout** on `xl+`: FI chart stays visible beside the form; below `xl` preview is full-width and collapsed by default on mobile.

### 7.2 Couple Mode

- Toggle `planning_mode` to `couple`.
- **Side-by-side layout** (`HouseholdSplitLayout`): Person 1 (primary) | Person 2 (partner).
- Partner data stored in `partner_profile` JSON (not a separate auth user).
- Each person has own: birth date, gender, salary, BVG, workload, savings rate, 3a accounts (`person` column).
- Shared household: **free assets (start capital + return + inheritance, one pot)**, `annual_retirement_expenses`, **inflation rate**, tax domicile, planning horizon, 3a auto-split (applies to both). Free-assets start capital and return are edited once in the "Planung" tab (master data) / "Planung" step (wizard); the per-person savings rate feeds this shared pot until each person's employment end. See datamodel §4.1.
- **Household FI panel** uses combined orchestrator with the same live preview behavior as single mode.
- **Partner employment offset (FI):** On Person 2 tab, user chooses whether partner stops working together with Person 1 (`employment_end_offset_years = 0`) or X years later. During FI search, partner employment end = P1 trial age + offset (clamped 18–70). Regular scenarios keep partner `retirement_age` unless overridden in the scenario form.

### 7.3 Workload Reductions

- Up to **2 steps** per person: `{ fromAge, workloadPercent }` where 100 = full-time.
- Affects: effective salary for AHV average income, BVG contributions, suggested 3a contribution, annual savings to free assets.
- Defined in master data; overridable per scenario.

### 7.4 Pillar 3a Account Editor

- CRUD multiple accounts per person.
- Fields: name, current capital, annual contribution, optional return rate.
- Auto-split settings at household level.
- **Zero allowed** for BVG capital, free assets, and savings where semantically valid (empty field still means “use default / omit”).

### 7.5 Tax Settings

- Marital status selector.
- Canton + postal code → **ESTV local tax lookup** (server action) populates municipality and Steuerfuss.
- Effective rates from reference tables only (manual override columns removed in migration 008).

### 7.6 BVG Field Assistance

- Person master fields suggest **contribution rates JSON**, **coordinated salary (UWS)**, and **Altersgutschriften** based on salary and age band helpers.
- Reduces manual JSON entry for typical PK setups.

---

## 8. Scenario System

### 8.1 Concept

A scenario = named set of **overrides** on top of master data. The engine function `calculateScenarioPension(profile, overrides)` merges profile + overrides.

Couple scenarios use `calculateHouseholdPension(household, primaryOverrides, partnerOverrides)` where partner overrides may be nested under `overrides.partner` or passed separately depending on save format.

### 8.2 `ScenarioOverrides` Structure

```typescript
interface ScenarioOverrides {
  description?: string;
  ahv?: {
    employmentEndAgeOverride?: number | null;  // end of employment
    pensionStartAgeOverride?: number | null;   // AHV pension start
    missingContributionYears?: number;
    averageIncomeOverride?: number | null;
  };
  bvg?: {
    pensionStartAgeOverride?: number | null;
    conversionRateOverride?: number | null;
    interestRateOverride?: number | null;
    coordinationDeductionMode?: "standard" | "none" | "custom" | null;
    customContributionRates?: Record<string, number> | null;
    capitalWithdrawalPercent?: number | null;      // 0–100
    capitalWithdrawalTranches?: number | null;       // 1–5
  };
  pillar3a?: {
    withdrawalSchedule?: Record<string, number>;   // accountId → years after BVG start
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
  partner?: ScenarioOverrides | null;  // couple mode
}
```

### 8.3 Scenario UI Sections

Each pillar has a reusable section component with **embedded** (single column) and **split** (couple side-by-side) modes:

| Section | Component | Couple behavior |
|---------|-----------|-----------------|
| AHV | `ScenarioAhvSection` | Both persons side-by-side |
| BVG | `ScenarioBvgSection` | Both persons; own overrides |
| Pillar 3a | `ScenarioPillar3aSection` | Per-person accounts + charts |
| Free assets | In scenario form | Combined household chart |
| Inheritance | `InheritanceEventsCard` | Events at Person 1 age → household wealth |
| Workload | Per-person in split layout | Override master data reductions |
| Capital optimizer | Button / panel | Suggests BVG + 3a withdrawal schedule |

### 8.4 Inheritance Events

```typescript
type InheritanceEvent = {
  atAge: number;       // Person 1 reference age
  amount: number;        // CHF lump sum
  recipient?: "household" | "primary" | "partner";  // engine supports all; UI defaults to household
};
```

Injected into free assets as capital injection at the given age.

### 8.5 Scenario List

- Lists all scenarios with name, description, last updated.
- Shows preview monthly income at employment end (**primary person only** — couple totals not yet on list page).
- Links to edit scenario.

---

## 9. Calculation Engine

Location: `lib/engine/`. Entry points:

- `calculateScenarioPension` — single person
- `calculateHouseholdPension` — couple
- `calculateFinancialIndependence` / household variant
- `optimizeCapitalWithdrawal` — tax optimizer

### 9.1 Legal Ages (`lib/engine/legal-ages.ts`)

| Rule | Implementation |
|------|----------------|
| AHV reference age | 65 for men; women phased 1961–1963 birth years |
| AHV earliest pension | 63 (men); 62–63 for certain female cohorts |
| BVG earliest pension | 58 |
| 3a earliest withdrawal | 5 years before AHV reference, or employment end if earlier (with BVG lump sum) |
| 3a latest withdrawal | Up to AHV pension start (staggered accounts) |
| Employment end | Scenario override or profile `retirement_age` |
| BVG pension start | max(employment end, 58) unless overridden |

### 9.2 AHV Module (`modules/ahv.ts`)

- Inputs: birth date, gender, employment start, employment end, optional missing years, average income override, pension start age.
- Output: monthly/yearly pension, explanation steps.
- Workload reductions reduce projected average income when no override.

### 9.3 AHV Couple Plafonierung (`modules/ahv-couple.ts`)

When `planning_mode = couple`, `marital_status = married`, and both have AHV pensions:

- Sum of individual pensions capped at **150% of max single AHV pension**.
- Excess reduced proportionally to both partners.
- Applied in household orchestrator before free-assets income aggregation.

### 9.4 BVG Module (`modules/bvg.ts`)

- Projects capital to pension start with age-based contribution rates.
- Coordination deduction: standard / none / custom override from profile.
- Capital withdrawal: 0–100% of projected capital, split into 1–5 tranches → injections to free assets.
- Remainder converted to annuity using conversion rate (UWS).
- Workload reduces coordinated salary and contributions.

### 9.5 Pillar 3a Module (`modules/pillar3a.ts`)

- **Two-pass simulation** when auto-split enabled (new accounts may appear after pass 1).
- Per-account projection: contributions, interest, withdrawal at scheduled age.
- **`contributionStopAge`** = minimum withdrawal age across all accounts; from that age onward no contributions on **any** account for that person.
- After withdrawal age: account capital goes to 0 (full lump sum to free assets).
- Auto-split: when account capital ≥ threshold, open new account (up to max accounts) with contribution per settings.

### 9.6 Free Assets Module (`modules/free-assets.ts`)

Year-by-year from current age to `planningHorizonAge`:

**Inflows:**

- Savings contribution (zero after person's `retirement_age` / employment end)
- Investment return on capital
- Scheduled capital injections (BVG tranches, 3a withdrawals, inheritance)

**Outflows:**

- Gross retirement expenses (household level in couple mode)
- Minus AHV + BVG pension income when active
- Minus ongoing 3a contributions from expenses after person's employment end (person no longer "pays" 3a from living budget)
- Minus taxes on taxable additional income

**Output per year:** capital start/end, savings, interest, injections (by source), expenses, withdrawals, tax breakdown, cumulative totals.

### 9.7 Household Orchestrator (`household-orchestrator.ts`)

1. Run `calculateScenarioPension` for primary and partner (**both** with household expenses zeroed in couple mode — applied only in merge via `household-cashflow.ts`).
2. Merge free-asset projections into `CombinedWealthYearProjection[]`:
   - **Time horizon** = years until **younger** person's planning horizon age.
   - Sum household capital, income, expenses, taxes.
   - Track per-person: `primaryCapitalEnd`, `partnerCapitalEnd`, BVG/3a injections by person.
3. **Net living model (`household-cashflow.ts`):** `annual_retirement_expenses` = **net** household living costs (housing, food, leisure — excluding taxes, 3a, BVG). No subtraction of 3a contributions from net living (3a runs via salary / 3a module, same as single-person `free-assets`).
4. **Inflation anchor:** net living inflates from the **first** household retirement (`Math.max` years since each person's employment end — not `Math.min`, which reset inflation when the partner retired later).
5. **Phases:** `accumulation` (both employed) · `mixed` (one retired, partner salary offsets withdrawal via estimated net salary × `NET_SALARY_ESTIMATE_FACTOR` 0.78) · `full_retirement` (both retired) · `survivor` (first partner reached planning horizon — deceased modeled; `annual_survivor_expenses` replaces couple net living, same inflation anchor from first household retirement). Per-year fields: `netLivingExpenses`, `employmentIncomeNet`, `cashflowPhase`, `pillar3aContributionActive`, `annualWithdrawal` = `max(0, netLiving + retirementTax − pensions − employmentIncomeNet)`.
6. **Per-person savings:** `annual_savings_to_free_assets` stops after that person's retirement age.
7. **Survivor wealth transfer:** when the first partner reaches their planning horizon age (older person dies first if horizons equal), the survivor inherits the deceased's remaining free assets (`survivorWealthTransfer`). Projection runs until the **younger** partner reaches planning horizon age (default **95** for both).
8. Apply AHV couple plafonierung to combined pension income where applicable.

### 9.8 Financial Independence (`financial-independence.ts`)

**Definition:** Earliest employment end age (search from current age to max 70) such that free assets never go negative until planning horizon, given:

- All pillar projections at that employment end age
- Pension incomes starting at respective ages
- Expenses and taxes as in free-assets module

Returns: `independenceAge`, years until FI, comparison to planned retirement, min capital during retirement, timeline for charting.

Couple mode: searches primary employment end using household orchestrator. Partner employment end during each FI trial = `derivePartnerEmploymentEndAge(primaryEnd, partner_profile.employment_end_offset_years)` (offset 0 = together). Timeline includes `combinedDetail` for per-person tooltips and household cashflow waterfall.

### 9.9 Capital Withdrawal Optimizer (`capital-withdrawal-optimizer.ts`)

- Grid search over BVG capital withdrawal % (0–max guidance), tranches (1–5), and 3a withdrawal year offsets per account.
- Minimizes **total tax** over projection (sum of `annualTotalTax`).
- Returns suggested schedule + tax savings vs baseline + impact on monthly BVG annuity.
- UI provides **Apply suggestion** button that writes values into active scenario form state.

### 9.10 Inflation (`lib/engine/inflation.ts`)

- Profile field `inflation_rate` (decimal, e.g. 0.02 = 2% p.a.); null or 0 = no inflation.
- `inflateAmount(base, rate, years)` compounds from a reference year index.
- Applied in orchestrator to:
  - **Salary** (BVG, AHV average-income path, workload-scaled salary)
  - **Annual savings to free assets**
  - **Pillar 3a contributions** (including auto-split simulation)
  - **Retirement expenses** (from first retirement year onward in free-assets module)
- **Not applied:** AHV/BVG pension amounts after start (no pension indexation).
- Explanation steps mention inflation when rate > 0.

---

## 10. Tax Module

### 10.1 Scope

- Taxes on **additional income** in retirement: pension income + taxable capital withdrawals (not salary — employment ends).
- Split: federal, cantonal, municipal components.
- Uses effective rates from ESTV lookup and reference tables (migration 007, 009).

### 10.2 ESTV Local Tax Lookup

- Server action: postal code + canton + marital status → municipality, Steuerfuss, reference rates.
- Requires seeded tax reference tables (migrations 007, 009).

### 10.3 Tax Reference Admin Page

- `/tax-reference/federal` — browse federal reference data (read-only UI).

---

## 11. Charts & Visualization

Shared infrastructure in `components/charts/`:

| Utility | Purpose |
|---------|---------|
| `chart-legend.tsx` | `useChartSeriesVisibility()` + clickable `ChartLegend` — toggle series by legend click |
| `chart-tooltip.tsx` | `ChartFloatingTooltip` — flips left/up when cursor is near chart edge |

**Dual Y-axis convention** (where applicable):

| Scale | Line style | Typical series |
|-------|------------|----------------|
| Left (CHF wealth) | Solid | Vermögen / household capital |
| Right (CHF/J.) | Dashed (`6 4`) | Sparquote, income, expenses, pension flows |

Free-assets chart uses **two scales only** (wealth left; savings + cashflow right — no separate middle savings axis).

| Chart | Location | Features |
|-------|----------|----------|
| AHV / BVG / 3a pillar charts | Scenario sections | Per-person; explanation steps; legend toggles |
| BVG contribution chart | `BvgContributionChart` | Age bands, one decimal rate format, person color |
| Household 3a chart | `HouseholdPillar3aChart` | Per-account lines + total; withdrawal markers; legend toggles |
| Combined wealth chart | `CombinedWealthChart` | Household free assets; BVG/3a/survivor markers; legend toggles |
| Free assets growth | `FreeAssetsGrowthChart` | Dual scale; injection markers; legend toggles |
| FI timeline | `FinancialIndependenceTimelineChart` | Wealth + pension/expense flows; couple `combinedDetail` tooltips |
| Vorsorge income timeline | `VorsorgeIncomeTimelineChart` | AHV/BVG/free income over time; household total line in couple mode |
| Pension income (stacked bar) | `PensionIncomeChart` | Shown only when **>1** income source at employment end; legend toggles segments |
| 3a projection | `Pillar3aProjectionChart` | Per-account lines; legend toggles |

**Person colors:** consistent palette via `lib/household/person-colors.ts` (primary vs partner).

**Number formatting:** Swiss locale; BVG rates via `formatPercentOneDecimal`; `formatSwissNumber(value, allowZero)` for fields that accept 0.

**Scenario form layout:** collapsible pillar sections; sticky wealth preview (`StickyPreviewLayout` + `LivePreviewCard`) on `xl+`; page width `max-w-7xl`.

---

## 12. Rate & Number Conventions

- **DB storage:** rates often as decimals (0.068 = 6.8%); legacy data may store percent (6.8).
- **Normalization:** `normalizeDbRate()` accepts both forms.
- **Scenario form:** user enters percents (6.8); converted via `rateFromScenarioOverride` / `contributionRatesFromScenarioPercent`.
- **CHF amounts:** `parseSwissNumber` / `formatSwissNumber` handle apostrophe separators.

---

## 13. Not Implemented (from v1 Specs)

This section consolidates everything the **original v1 requirements, architecture, and datamodel** planned or listed as MVP/post-MVP that is **still missing, partial, or only in schema** in the current app. Implemented v1 “non-goals” that are **now done** (couple mode, tax, multi-3a, FI) are omitted here — see §3 and §9.

### 13.1 Results & UX (v1 MVP §4.5, datamodel `retirementGap`)

| Item | v1 intent | Status |
|------|-----------|--------|
| **Retirement gap analysis** | Monthly pension vs **desired income** (Wunsheinkommen); CHF + % gap | **Not implemented** |
| **Desired income target** | User sets target monthly retirement income | **Not implemented** |
| **`retirementGap` in summary** | `{ monthly, percentage }` on `SimulationResult` | **Not implemented** |
| **Scenario list couple totals** | Quick preview of household income | **Partial** — primary person only on list page |

### 13.2 Inflation & nominal projections (v1 §3, datamodel `YearlyData.rates`)

| Item | v1 intent | Status |
|------|-----------|--------|
| **Inflation rate assumption** | Constant rate on profile | **Implemented** — `profiles.inflation_rate` (012) |
| **Inflation-adjusted expenses** | Growing retirement expenses | **Implemented** in free-assets module |
| **Inflation-adjusted salary / savings / 3a** | Nominal inputs grow pre-retirement | **Implemented** in BVG, 3a, free-assets paths |
| **Inflation-adjusted pensions** | Optional indexation of AHV/BVG | **Not implemented** |
| **Per-year `rates` object** | Dynamic inflation/returns per year in pipe | **Not implemented** |

### 13.3 Employment & income precision (v1 §4.2, datamodel `ScenarioInput`)

| Item | v1 intent | Status |
|------|-----------|--------|
| **Calendar-year career breaks** | `plannedCareerBreaks: number[]` — zero-income years | **Not implemented** |
| **AHV Level C** | Year-by-year income list / `salaryOverrides` | **Not implemented** |
| **Income milestones** | Manual salary jumps at specific ages | **Not implemented** (only workload % scaling) |
| **BaseIncome module** | Separate salary timeline | **Not implemented** — folded into AHV + workload |

### 13.4 Asset & pillar extensions (v1 non-goals / post-MVP)

| Item | v1 intent | Status |
|------|-----------|--------|
| **Real estate / home ownership** | Property module, imputed rent | **Not implemented** |
| **Self-employed** | Non-employee social contributions | **Not implemented** |
| **BVG überobligatorium** | Detailed above-mandatory PK plans | **Not implemented** |
| **Wealth account buckets** | `wealth_accounts` table (cash, ETF, bonds, real_estate) | **Schema only** — no UI or engine |
| **PK / BVG statement import** | PDF or file import | **Not implemented** |

### 13.5 Platform & delivery (v1 architecture)

| Item | v1 intent | Status |
|------|-----------|--------|
| **PWA** | Installable app, service worker | **Not implemented** |
| **Offline mode** | Projections without network | **Not implemented** |
| **Monorepo** | `apps/web` + `packages/engine` | **Not used** — flat `lib/engine/` |
| **OAuth** | Social login | **Not implemented** — email/password only |
| **Server-side engine API** | Dedicated calculation endpoint | **Not implemented** |
| **PDF export** | Scenario report download | **Not implemented** |
| **Advisor multi-client API** | B2B access | **Not implemented** |

### 13.6 Calculation modules (v1 post-MVP)

| Item | v1 intent | Status |
|------|-----------|--------|
| **Kapitalverzehr / longevity module** | Separate annuitization beyond free-assets drawdown | **Partial** — drawdown in `free-assets.ts` only |
| **Full income tax planning** | Complete tax optimization beyond capital withdrawals | **Partial** — additional-income tax + optimizer |
| **Regulated advice / recommendations** | Automated financial advice | **Not implemented** (optimizer is optional suggestion) |

### 13.7 UI gaps (engine vs UI)

| Item | Status |
|------|--------|
| Inheritance **recipient** picker (primary / partner / household) | Engine supports; UI always saves `household` |
| BVG **custom coordination CHF** in scenario | Profile field only; scenario = standard vs none |
| **Dynamic rate scenarios** | Static profile/scenario rates only |

### 13.8 Prioritized backlog (recommended next)

1. Desired retirement income + gap analysis (§13.1)
2. Pension indexation / inflation on AHV+BVG (§13.2)
3. Calendar-year career breaks (§13.3)
4. AHV Level C / salary overrides (§13.3)
5. Wealth accounts UI wired to migration 002 (§13.4)
6. Property module (§13.4)
7. Inheritance recipient UI (§13.7)
8. Couple scenario list summaries (§13.1)
9. PDF export (§13.5)
10. PWA packaging (§13.5)

---

## 14. Success Criteria

| Criterion | Measure |
|-----------|---------|
| Time to first result | User with minimal data sees scenario output in < 5 minutes |
| Understandability | Charts + explanation steps per module; no finance degree required |
| Calculation transparency | Each pillar exposes `explanation[]` steps |
| Data portability | Cloud sync across devices via Supabase |
| Couple parity | Partner has same pillar coverage as primary in UI and engine |
| Code testability | Engine modules unit-testable without React |

---

## 15. Rebuild Checklist for Agents

To recreate this application:

1. **Supabase:** Run migrations 001–012; configure Auth; env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. **Engine:** Implement modules in order: constants → legal-ages → workload → inflation → AHV → BVG → pillar3a (+ auto-split) → free-assets (+ tax) → orchestrator → household-orchestrator → FI → capital optimizer.
3. **Profile loading:** `loadProfileForScenario`, `loadHouseholdProfile` mapping DB rows → `ProfileForScenario` / `HouseholdProfileForScenario`.
4. **UI:** Master data form (collapsible + live FI) → scenario form (collapsible + sticky preview) → charts with shared legend/tooltip helpers.
5. **QA seed (optional):** `npm run seed:test` with `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_DB_URL`; optional `TEST_USER_EMAIL`.
6. **Verify:** TypeScript compile (`npm run build`); golden tests on engine if available under `lib/engine/__tests__` or similar.

---

## Appendix A: Swiss Constants (Engine)

Key values in `lib/engine/constants.ts` (verify against current law when rebuilding):

- AHV max yearly pension: CHF 29'400
- AHV min yearly pension: CHF 14'700
- AHV scale income bounds: CHF 14'700 – 88'200
- Early withdrawal reduction: 6.8% per year
- BVG min interest: 1.25% (configurable override)
- Pillar 3a max annual contribution: legal limit (see constant)
- Max 3a accounts per person: 5 (`PILLAR_3A_MAX_ACCOUNTS`)
- Max 3a annual contribution (with PK): CHF 7'056 (`PILLAR_3A_MAX_CONTRIBUTION`, verify year)

---

## Appendix B: Document History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2024 | German MVP spec; single person; many features marked out of scope |
| v2 | May 2026 | English; full implemented scope + §13 not-implemented from v1; architecture & datamodel aligned |
| v3 | June 2026 | Inflation engine (012); UX polish (collapsible, steppers, live FI, sticky previews); chart legend toggles + dual-axis styling; auth redirect to `/`; QA seed script; tax manual overrides removed (008) |

# Swiss Pension Planner — User Stories (v3)

> **Version:** 3.0 (June 2026)  
> **Language:** English  
> **Companion doc:** [`requirements.md`](./requirements.md) · [`architecture.md`](./architecture.md) · [`datamodel.md`](./datamodel.md)  
> **Purpose:** User stories with acceptance criteria for every **implemented** feature, enabling an agent to rebuild the application incrementally.

**Story format:**

- **As a** [role], **I want** [goal], **so that** [benefit].
- **Acceptance criteria** are testable conditions.

**Roles:**

- **Planner** — registered user planning their own retirement.
- **Couple** — planner using couple/household mode with a partner profile.

---

## Epic 1: Authentication & Account

### US-1.1 Register

**As a** new user, **I want** to create an account with email and password, **so that** my data is stored securely.

**Acceptance criteria:**

- Sign-up form at `/auth/sign-up` collects email + password.
- On success, user receives confirmation flow (`/auth/sign-up-success`).
- Supabase creates auth user; DB trigger creates empty `profiles` row.
- User can proceed to master data after login.

### US-1.2 Login & Logout

**As a** registered user, **I want** to log in and out, **so that** only I can access my plans.

**Acceptance criteria:**

- Login at `/auth/login` establishes cookie session.
- After login, password reset, or email confirm → redirect to **`/`** (home).
- Protected pages redirect to login when unauthenticated.
- Logout clears session.

### US-1.3 Password Reset

**As a** user who forgot my password, **I want** to reset it via email, **so that** I can regain access.

**Acceptance criteria:**

- Forgot-password flow at `/auth/forgot-password`.
- Update-password page handles reset token from email link.

---

## Epic 2: Master Data — Single Person

### US-2.1 Enter Personal Demographics

**As a** planner, **I want** to save my birth date, gender, and employment start year, **so that** AHV and legal ages are computed correctly.

**Acceptance criteria:**

- Fields persist to `profiles` on save.
- Gender drives AHV reference age (including female cohort rules for 1961–1963).
- Employment start year feeds AHV contribution year calculation.

### US-2.2 Enter Employment & Wealth Baseline

**As a** planner, **I want** to enter salary, BVG capital, free assets, and planned retirement age, **so that** projections have a starting point.

**Acceptance criteria:**

- `current_salary_brutto`, `bvg_current_capital`, `free_assets`, `retirement_age` saved.
- Swiss number formatting in UI (apostrophe thousands separator).
- Retirement age constrained to 58–70.

### US-2.3 Configure BVG Assumptions

**As a** planner, **I want** to set BVG interest rate, conversion rate, and optional contribution rate overrides, **so that** my PK assumptions are reflected.

**Acceptance criteria:**

- Rates accept percent input; stored as decimals in DB.
- Optional `bvg_contribution_rates` JSON per age band.
- Optional `bvg_coordinated_salary_override` for custom coordination deduction.
- BVG contribution rates displayed with **at most one decimal place** in charts.

### US-2.4 Configure Free Asset Assumptions

**As a** planner, **I want** to set free-asset return and annual savings, **so that** wealth accumulation after retirement funding is modeled.

**Acceptance criteria:**

- `free_assets_interest_rate` and `annual_savings_to_free_assets` saved.
- Savings apply only while person is employed (stops at retirement age in engine).

### US-2.5 Set Planning Horizon & Expenses

**As a** planner, **I want** to define how long to project and my annual retirement expenses, **so that** capital drawdown and FI are meaningful.

**Acceptance criteria:**

- `planning_horizon_age` (e.g. 90) and `annual_retirement_expenses` required for FI.
- Expenses applied from employment end onward in free-assets module.
- Expenses are nominal CHF (no inflation adjustment).

### US-2.6 Configure Workload Reductions

**As a** planner, **I want** to define up to two partial-retirement steps, **so that** reduced workload affects income and contributions realistically.

**Acceptance criteria:**

- Each step: `{ fromAge, workloadPercent }` where 100 = full-time.
- Max 2 steps per person; validated and sorted by age.
- Workload pre-filled from master data; overridable in scenarios.
- Engine scales salary, BVG, 3a suggestions, and savings by workload factor at each age.

---

## Epic 3: Master Data — Pillar 3a Accounts

### US-3.1 Manage Multiple 3a Accounts

**As a** planner, **I want** multiple Pillar 3a accounts with individual balances and contributions, **so that** I can model staggered withdrawals.

**Acceptance criteria:**

- CRUD on `pillar3a_accounts` table.
- Fields: name, current value, annual contribution, optional return rate, sort order.
- Legal max accounts per person enforced in UI/engine.

### US-3.2 Configure 3a Auto-Split

**As a** planner, **I want** new 3a accounts to open automatically when a balance exceeds a threshold, **so that** I can plan optimal withdrawal staggering.

**Acceptance criteria:**

- Settings: enabled flag, threshold CHF, contribution mode (`max` legal limit or `last` account's rate), name prefix.
- Engine two-pass simulation creates virtual accounts during projection.
- Auto-split settings on primary profile apply to partner in couple mode.

### US-3.3 Stop All 3a Contributions on First Withdrawal

**As a** planner, **I want** the simulation to stop all my 3a contributions once any account is withdrawn, **so that** results match Swiss practice.

**Acceptance criteria:**

- `contributionStopAge` = earliest withdrawal age among all accounts for that person.
- From that age: zero contributions on **all** accounts; non-withdrawn accounts grow by interest only until their withdrawal age.
- Explanation step shown in 3a module output.

---

## Epic 4: Master Data — Tax Settings

### US-4.1 Set Tax Domicile

**As a** planner, **I want** to specify canton, postal code, and marital status, **so that** retirement taxes are estimated for my municipality.

**Acceptance criteria:**

- Marital status: single or married.
- Postal code lookup (ESTV) returns municipality name and Steuerfuss.
- Tax settings stored on profile and passed to engine via `taxSettingsFromScenarioProfile`.

### US-4.2 Override Tax Rates Manually

**As a** planner, **I want** optional manual effective tax rates, **so that** I can use advisor-provided rates instead of tables.

**Status:** **Removed** in migration 008 — effective rates from ESTV reference tables only. Story retained for v1 traceability.

---

## Epic 5: Master Data — Couple Mode

### US-5.1 Enable Couple Planning Mode

**As a** couple, **I want** to switch to couple mode and enter partner data side-by-side, **so that** we plan together in one account.

**Acceptance criteria:**

- `planning_mode` toggle: single ↔ couple.
- Partner fields stored in `partner_profile` JSON.
- Side-by-side layout mirrors primary person fields (demographics, employment, BVG, free assets, workload, savings).
- Shared household fields: expenses, planning horizon, tax domicile, 3a auto-split.

### US-5.2 Assign 3a Accounts per Person

**As a** couple, **I want** separate 3a account lists for each person, **so that** withdrawals and contributions are tracked individually.

**Acceptance criteria:**

- `pillar3a_accounts.person` = `primary` or `partner`.
- Master data editor shows accounts under correct person column.
- Partner inherits auto-split settings from primary profile configuration.

### US-5.3 View Household Financial Independence

**As a** couple, **I want** a combined FI analysis, **so that** we know when **we** can afford to stop working.

**Acceptance criteria:**

- Household FI panel on master data when couple mode active.
- Uses `calculateHouseholdPension` / household FI functions.
- Timeline chart shows combined projection with per-person detail in tooltips.

---

## Epic 6: Scenarios — Lifecycle

### US-6.1 Create & Name Scenarios

**As a** planner, **I want** to create multiple named scenarios, **so that** I can compare retirement options.

**Acceptance criteria:**

- `/scenarios/new` creates scenario linked to user.
- Name required; optional description in override JSON.
- Scenario stored as row in `scenarios` with JSON `data`.

### US-6.2 List Scenarios

**As a** planner, **I want** to see all my scenarios with a quick income preview, **so that** I can pick one to edit.

**Acceptance criteria:**

- List at `/scenarios` sorted by last updated.
- Shows computed monthly income at employment end for **primary** profile (known limitation: not household total for couples).
- Prompts to complete master data if profile incomplete.

### US-6.3 Edit & Save Scenario Overrides

**As a** planner, **I want** scenario changes to override master data without altering it, **so that** my baseline stays intact.

**Acceptance criteria:**

- Edit at `/scenarios/[id]`.
- Save persists only override JSON, not profile.
- Live recalculation on client when inputs change.

### US-6.4 Delete Scenarios

**As a** planner, **I want** to delete scenarios I no longer need, **so that** my list stays manageable.

**Acceptance criteria:**

- Delete action removes scenario row (RLS enforced).
- User cannot delete another user's scenarios.

---

## Epic 7: Scenarios — AHV (1st Pillar)

### US-7.1 Override Employment End & AHV Start

**As a** planner, **I want** to change when I stop working and when AHV starts in a scenario, **so that** I can model early retirement or deferred AHV.

**Acceptance criteria:**

- `employmentEndAgeOverride` and `pensionStartAgeOverride` in scenario AHV section.
- Legal bounds enforced (earliest pension age, reference age, deferral limits).
- Explanation steps show resulting monthly AHV pension.

### US-7.2 Adjust AHV Contribution History

**As a** planner, **I want** to specify missing contribution years or override average income, **so that** my AHV estimate matches my situation.

**Acceptance criteria:**

- `missingContributionYears` reduces pension per engine rules.
- `averageIncomeOverride` bypasses salary-based projection (including workload effects unless overridden).

### US-7.3 Configure Partner AHV in Couple Scenarios

**As a** couple, **I want** side-by-side AHV scenario controls for both persons, **so that** each partner's pension start can differ.

**Acceptance criteria:**

- `ScenarioAhvSection` renders in split mode for couple.
- Partner overrides stored under partner scenario state / `overrides.partner.ahv`.
- Combined results apply married plafonierung when applicable.

---

## Epic 8: Scenarios — BVG (2nd Pillar)

### US-8.1 Override BVG Pension Start & Assumptions

**As a** planner, **I want** to change BVG start age, interest, and conversion rate in a scenario, **so that** I can test PK outcomes.

**Acceptance criteria:**

- Overrides: pension start, interest rate, conversion rate (UWS).
- BVG start ≥ 58 and ≥ employment end unless legally modeled otherwise.
- Optional coordination deduction override: standard vs none (custom CHF amount remains profile-only).

### US-8.2 Model BVG Capital Withdrawal

**As a** planner, **I want** to withdraw part of my BVG as capital into free assets, **so that** I can compare lump sum vs annuity.

**Acceptance criteria:**

- Capital withdrawal percent 0–100.
- Tranches 1–5 spread injections over years after BVG start.
- Remaining capital converted to monthly annuity at UWS.
- Capital injections appear in free-assets chart event markers.

### US-8.3 Override BVG Contribution Rates in Scenario

**As a** planner, **I want** scenario-specific BVG contribution rates, **so that** I can model employer plan changes.

**Acceptance criteria:**

- `customContributionRates` per age band in scenario.
- Chart shows contribution amounts by age with person color in couple mode.
- Chart displays **sum of contribution growth** over projection.

### US-8.4 Configure Partner BVG in Couple Scenarios

**As a** couple, **I want** full BVG scenario options for Person 2, **so that** partner PK paths are not read-only.

**Acceptance criteria:**

- `ScenarioBvgSection` split mode with independent partner overrides.
- Partner capital injections tracked as `partnerBvgCapitalInjection` in combined projection.

---

## Epic 9: Scenarios — Pillar 3a

### US-9.1 Schedule Staggered 3a Withdrawals

**As a** planner, **I want** to set when each 3a account is withdrawn in a scenario, **so that** I optimize tax and liquidity.

**Acceptance criteria:**

- Withdrawal schedule: per account, years after BVG start **or** absolute age override.
- Withdrawals must fall within legal window (engine clamps/explains).
- Withdrawn capital injected into free assets at scheduled age.

### US-9.2 Override 3a Account Values in Scenario

**As a** planner, **I want** scenario-only overrides for 3a capital, contributions, and returns, **so that** I can test what-if without changing master data.

**Acceptance criteria:**

- Per-account overrides in `pillar3a.accountOverrides`.
- Projection uses overrides merged on top of master accounts.

### US-9.3 View Combined 3a Chart (Couple)

**As a** couple, **I want** a chart showing both persons' 3a capital and a household total, **so that** I see the full picture.

**Acceptance criteria:**

- `HouseholdPillar3aChart`: lines for primary, partner, and total.
- Color-coded by person; withdrawal points visible.
- Time axis extends to **younger** person's planning horizon.
- Both persons' accounts shown depleting to zero at withdrawal ages.

### US-9.4 Reduce Living Expenses by 3a Contributions After Retirement

**As a** planner, **I want** my retirement expenses reduced by my 3a contribution amount once I stop working, **so that** cash flow reflects that I no longer pay into 3a from living expenses.

**Acceptance criteria:**

- After person's employment end, `annualPillar3aContribution` offsets gross expenses in free-assets / household merge.
- Applied per person in couple mode independently.

---

## Epic 10: Scenarios — Free Assets & Household Wealth

### US-10.1 Project Free Asset Drawdown

**As a** planner, **I want** to see year-by-year free assets until my planning horizon, **so that** I know if my wealth lasts.

**Acceptance criteria:**

- Projection from current age to `planning_horizon_age`.
- Shows capital, savings, interest, pension income, expenses, net withdrawals, taxes.
- Zero savings after retirement age for that person.

### US-10.2 View Free Assets Growth Chart

**As a** planner, **I want** a detailed chart of free asset dynamics, **so that** I understand savings vs drawdown phases.

**Acceptance criteria:**

- Capital line on primary axis.
- **Savings contributions on separate Y scale** (does not flatten capital line).
- **Gross expense projection line** restored and visible.
- **Full legend** for all series.

### US-10.3 View Combined Household Wealth Chart (Couple)

**As a** couple, **I want** one chart of total household free assets with important events marked, **so that** we see when capital arrives and leaves.

**Acceptance criteria:**

- `CombinedWealthChart` with event markers: BVG/3a injections, inheritance, survivor transfer.
- Tooltips identify **which person** capital withdrawals/injections belong to (person-colored).
- Per-person capital end balances available in combined projection data.

### US-10.4 Model Survivor Wealth Transfer

**As a** couple where one partner is younger, **I want** the younger partner to inherit the older partner's free assets when the older reaches their planning horizon, **so that** survivor scenarios are approximated.

**Acceptance criteria:**

- When partner is younger: at primary's planning horizon age, `survivorWealthTransfer` moves primary's `primaryCapitalEnd` to partner's pool.
- Event visible on combined wealth chart.
- Projection continues to younger person's horizon.

### US-10.5 Per-Person Savings in Couple Mode

**As a** couple, **I want** each person's savings to free assets tracked separately, **so that** pre-retirement accumulation is accurate.

**Acceptance criteria:**

- `annual_savings_to_free_assets` per person in master data.
- Each person's savings stop at their own retirement/employment end age.
- Combined chart aggregates savings contributions.

---

## Epic 11: Scenarios — Inheritance

### US-11.1 Add Inheritance or Gift Events

**As a** planner, **I want** to model one-time wealth inflows at a given age, **so that** expected inheritances affect retirement feasibility.

**Acceptance criteria:**

- UI card to add/remove events: age (Person 1 reference) + CHF amount.
- Saved in `overrides.inheritance`.
- Engine injects into household free assets at specified age.
- Currently UI sets `recipient: household` only (engine supports primary/partner targeting for future UI).

---

## Epic 12: Financial Independence

### US-12.1 Calculate Earliest Sustainable Retirement Age

**As a** planner, **I want** to know the earliest age I can stop working without running out of money, **so that** I have a concrete FI target.

**Acceptance criteria:**

- FI panel on master data (single and couple mode).
- **Live recalculation** from current form values without saving (`parse-form-profile.ts` + `useMemo`).
- Search ages from current age to 70.
- **Sustainable** = free assets never negative until planning horizon.
- Shows: independence age, years until FI, comparison to planned retirement, min capital in retirement, monthly income at horizon.

### US-12.2 View FI Timeline Chart

**As a** planner, **I want** a chart of capital over time on the path to FI, **so that** I visualize the trajectory.

**Acceptance criteria:**

- Dense year-by-year projection on FI timeline chart.
- Marks employment end, AHV start, BVG start.
- In couple mode: tooltips show per-person injection breakdown (`combinedDetail`).

---

## Epic 13: Capital Withdrawal Tax Optimizer

### US-13.1 Optimize BVG and 3a Withdrawal Timing

**As a** planner, **I want** a suggestion for capital withdrawal percentages and 3a stagger timing, **so that** I minimize total retirement tax.

**Acceptance criteria:**

- Optimizer runs from scenario context.
- Searches BVG capital %, tranche count, 3a withdrawal offsets per account.
- Reports baseline vs suggested total tax, tax savings CHF, impact on monthly BVG annuity.
- "Apply suggestion" (`Vorschlag übernehmen`) button updates scenario BVG capital %, tranche count, and 3a withdrawal schedule in the form.

---

## Epic 14: AHV Couple Plafonierung

### US-14.1 Apply Married AHV Cap

**As a** married couple, **I want** our combined AHV pensions capped at 150% of the maximum single pension, **so that** household income reflects Swiss married rules.

**Acceptance criteria:**

- Applied when: couple mode + marital status married + both have AHV income.
- Cap = 1.5 × max single AHV yearly pension.
- Excess reduced proportionally; flag `ahvCouplePlafonierungApplied` in household result.
- Explanation available in household calculation output.

---

## Epic 15: Charts — Cross-Cutting UX

### US-15.1 Distinguish Persons Visually

**As a** couple, **I want** consistent colors for Person 1 vs Person 2 across all charts, **so that** I don't confuse the data.

**Acceptance criteria:**

- Shared color constants (`person-colors.ts`).
- BVG contribution chart, 3a chart, combined wealth chart, FI timeline use person colors.

### US-15.2 Readable Swiss Number Formatting

**As a** Swiss user, **I want** amounts and rates formatted familiarly, **so that** I can read results quickly.

**Acceptance criteria:**

- CHF with Swiss grouping (e.g. 1'234'567).
- Percent rates in UI; BVG contribution rates max one decimal in charts (`formatPercentOneDecimal`).
- Stepper inputs for numeric fields with sensible CHF steps (10k wealth, 1k savings, etc.).
- Zero allowed where valid for BVG capital, free assets, savings (`formatSwissNumber` with `allowZero`).

### US-15.3 Toggle Chart Series via Legend

**As a** planner, **I want** to show or hide individual chart lines by clicking the legend, **so that** I can focus on one series at a time.

**Acceptance criteria:**

- All line/bar charts use `ChartLegend` + `useChartSeriesVisibility`.
- Hidden series: dimmed swatch + strikethrough label; chart path/segment not drawn.
- Applies to: free assets, FI timeline, BVG, 3a, combined wealth, vorsorge income, pension income bar.

### US-15.4 Dual-Axis Line Styling

**As a** planner, **I want** a consistent visual rule for multi-scale charts, **so that** I know which axis a line belongs to.

**Acceptance criteria:**

- Left Y-axis (wealth CHF): **solid** lines.
- Right Y-axis (CHF/J. flows): **dashed** lines (including Sparquote on same right scale — no third axis).
- Tooltips flip left/up near chart edges (`ChartFloatingTooltip`).

---

## Epic 16: Tax Reference (Admin / Read-Only)

### US-16.1 Browse Federal Tax Reference

**As a** developer or power user, **I want** to view seeded federal tax reference tables, **so that** I can verify tax lookup data.

**Acceptance criteria:**

- Page at `/tax-reference/federal`.
- Read-only display of reference data from DB migrations.

---

## Epic 17: Module Explanations

### US-17.1 Understand Calculation Steps

**As a** planner, **I want** step-by-step explanations for each pillar result, **so that** I trust and learn from the numbers.

**Acceptance criteria:**

- Each engine module returns `explanation: { label, value, detail? }[]`.
- Scenario UI renders explanation steps under AHV, BVG, 3a, free assets sections.
- Key rules explained (e.g. 3a contribution stop, legal withdrawal window, plafonierung).

---

## Epic 18: UX Polish (v3)

### US-18.1 Collapsible Form Sections

**As a** planner, **I want** to collapse long form sections, **so that** I can focus on one topic at a time.

**Acceptance criteria:**

- Master data and scenario forms use `CollapsibleCard`.
- Section open/closed state persists while editing on the page.

### US-18.2 Sticky Live Chart Preview

**As a** planner, **I want** key charts visible while scrolling the form on desktop, **so that** I see impact of changes immediately.

**Acceptance criteria:**

- `StickyPreviewLayout` + `LivePreviewCard` on master data (FI) and scenario edit (wealth).
- Sticky side-by-side layout at `xl+`; below `xl` preview is full-width, not sticky, collapsed by default on mobile.

### US-18.3 BVG Field Suggestions

**As a** planner, **I want** suggested BVG contribution rates and coordinated salary values, **so that** I spend less time on JSON entry.

**Acceptance criteria:**

- Person master fields offer suggestions for contribution rates, UWS, and Altersgutschriften based on salary/age helpers.

### US-18.4 Conditional Income Distribution Chart

**As a** planner, **I want** the income stacked bar only when multiple sources apply, **so that** the UI stays simple for single-source cases.

**Acceptance criteria:**

- `PensionIncomeChart` renders only when `countPensionIncomeSources > 1`.

### US-18.5 Load QA Test Scenarios

**As a** developer or tester, **I want** a script to seed realistic test data, **so that** I can verify scenarios without manual entry.

**Acceptance criteria:**

- `npm run seed:test` upserts couple master profile, 3× 3a accounts, 20 scenarios prefixed `TEST:`.
- Targets `TEST_USER_EMAIL` or first auth user; requires service role key or DB URL.

### US-18.6 Set Inflation Assumption

**As a** planner, **I want** to set an annual inflation rate on master data, **so that** long horizons reflect rising expenses and pre-retirement inputs.

**Acceptance criteria:**

- Field `inflation_rate` on profile (percent in UI, decimal in DB).
- Engine compounds salary, savings, 3a contributions, and retirement expenses when rate > 0.
- AHV/BVG pension amounts after start are **not** indexed.

---

## Not Implemented (from v1 Specs)

User stories below map to items in the **original v1** requirements, architecture, and datamodel that are **not yet delivered** (or only partial). Epics 1–18 above are implemented. Do not implement these backlog stories unless explicitly prioritizing §13 in [requirements.md](./requirements.md#13-not-implemented-from-v1-specs).

### Results & gap analysis (v1 MVP §4.5)

#### US-NI.1 Retirement Income Gap

**As a** planner, **I want** to set a desired monthly retirement income and see the gap vs projected income (CHF and %), **so that** I know how much I'm short.

**Status:** Not implemented (v1 `retirementGap` / Wunsheinkommen).

#### US-NI.2 Couple Scenario List Summary

**As a** couple, **I want** scenario list previews to show **household** monthly income, **so that** the list matches couple planning.

**Status:** Partial — list uses primary-only `calculateScenarioPension`.

### Inflation (v1 §3, datamodel `YearlyData.rates.inflation`)

#### US-NI.3 Inflation on Expenses

**As a** planner, **I want** to set an inflation rate and see retirement expenses grow year-by-year, **so that** long horizons (e.g. age 90) are realistic.

**Status:** **Implemented** — see Epic 18 / US-18.6 (`profiles.inflation_rate`, migration 012).

#### US-NI.4 Inflation on Pensions (optional)

**As a** planner, **I want** optional pension indexation, **so that** I can stress-test purchasing power.

**Status:** Not implemented.

### Employment precision (v1 datamodel)

#### US-NI.5 Calendar-Year Career Breaks

**As a** planner, **I want** to mark specific calendar years as employment breaks, **so that** AHV contribution years and income averages reflect sabbaticals.

**Status:** Not implemented (v1 `plannedCareerBreaks`). **Partial substitute:** workload % reductions (Epic 2).

#### US-NI.6 AHV Level C — Income History

**As a** planner, **I want** to enter my annual income per year, **so that** AHV projection uses precise contribution history.

**Status:** Not implemented (v1 `salaryOverrides`).

#### US-NI.7 Salary Milestones

**As a** planner, **I want** to model salary increases at specific ages, **so that** future earnings affect BVG and AHV.

**Status:** Not implemented.

### Assets & pillars (v1 non-goals / post-MVP)

#### US-NI.8 Real Estate Module

**As a** homeowner, **I want** to include property equity and mortgage in my plan, **so that** retirement wealth is complete.

**Status:** Not implemented.

#### US-NI.9 Self-Employed Mode

**As a** self-employed person, **I want** Swiss social contribution rules for non-employees, **so that** my plan is accurate.

**Status:** Not implemented.

#### US-NI.10 Wealth Account Buckets

**As a** planner, **I want** separate buckets (cash, ETF, bonds) instead of one free-assets line, **so that** allocation and returns differ by asset class.

**Status:** DB tables in migration 002 only — no UI or engine.

#### US-NI.11 PK Statement Import

**As a** planner, **I want** to import my PK/BVG statement, **so that** I don't enter capital and rates manually.

**Status:** Not implemented.

#### US-NI.12 BVG Überobligatorium Detail

**As a** planner with above-mandatory PK benefits, **I want** detailed überobligatorium modeling, **so that** high contributions are reflected.

**Status:** Not implemented.

### Platform (v1 architecture)

#### US-NI.13 Install as PWA / Offline

**As a** planner, **I want** to install the app and use projections offline, **so that** I can plan without connectivity.

**Status:** Not implemented (v1 PWA architecture).

#### US-NI.14 OAuth Sign-In

**As a** user, **I want** to sign in with Google or Apple, **so that** I don't manage another password.

**Status:** Not implemented.

#### US-NI.15 Export PDF Report

**As a** planner, **I want** to export a scenario as PDF, **so that** I can share with my advisor.

**Status:** Not implemented.

#### US-NI.16 Advisor Multi-Client API

**As a** financial advisor, **I want** an API to run projections for clients, **so that** I can integrate with my tools.

**Status:** Not implemented.

### Engine vs UI gaps

#### US-NI.17 Inheritance Recipient Selection

**As a** couple, **I want** to assign each inheritance to primary, partner, or household, **so that** individual windfalls are modeled correctly.

**Status:** Engine supports `recipient`; UI always saves `household`.

#### US-NI.18 BVG Custom Coordination in Scenario

**As a** planner, **I want** to enter a custom coordination deduction amount in a scenario, **so that** I can test PK variants without changing master data.

**Status:** Custom CHF only on profile; scenario UI = standard vs none.

#### US-NI.19 Longevity / Kapitalverzehr Module

**As a** planner, **I want** a dedicated longevity drawdown strategy (e.g. annuitization rules), **so that** I don't outlive my assets.

**Status:** Partial — free-assets drawdown only (v1 post-MVP Kapitalverzehr module).

---

## Suggested Implementation Order for Rebuild Agents

| Phase | Epics | Outcome |
|-------|-------|---------|
| 1 | 1, 2 (partial) | Auth + basic profile |
| 2 | 2, 3, 17 | Master data + 3a accounts + engine AHV/BVG/3a/free-assets single |
| 3 | 6, 7, 8, 9, 10 | Scenario CRUD + all pillar sections single mode |
| 4 | 4, 13 | Tax settings + tax in engine |
| 5 | 12, 13 | FI + capital optimizer |
| 6 | 5, 14, 10.3–10.5, 9.3 | Couple mode + household orchestrator + plafonierung |
| 7 | 15, 16, 18 | Chart polish + tax reference admin + UX polish |

---

## Document History

| Version | Date | Notes |
|---------|------|-------|
| v1 | — | No standalone user stories file; requirements only (German MVP) |
| v2 | May 2026 | Implemented epics 1–17 + §Not Implemented from v1 specs |
| v3 | June 2026 | Epic 18 UX polish; inflation implemented (US-NI.3 closed); chart legend/dual-axis; live FI; auth redirect; QA seed |

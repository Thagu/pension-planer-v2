# Swiss Pension Planner — Architecture (v3)

> **Version:** 3.0 (June 2026)  
> **Language:** English  
> **Companion docs:** [requirements.md](./requirements.md) · [datamodel.md](./datamodel.md) · [user_stories.md](./user_stories.md)

---

## 1. Overview

The Swiss Pension Planner is a **Next.js web application** with a **client-side calculation engine**. Users authenticate via Supabase, store master data and scenarios in PostgreSQL, and run pension projections in the browser for instant feedback when editing scenarios.

The v1 spec assumed a **monorepo PWA** (`apps/web` + `packages/engine`). The implemented app uses a **single Next.js project** with the engine at `lib/engine/` — still pure TypeScript and importable from both client components and server components.

---

## 2. Project Structure (Actual)

```
pension-planer/
├── app/                          # Next.js App Router
│   ├── auth/                     # Login, sign-up, password reset
│   ├── master-data/              # Master data page + server actions
│   ├── scenarios/                # List, new, [id] edit
│   ├── tax-reference/federal/    # Read-only tax reference admin
│   └── page.tsx                  # Home
├── components/
│   ├── charts/                   # ChartLegend, ChartFloatingTooltip, axis dash constants
│   ├── layout/                   # StickyPreviewLayout (master data / scenario previews)
│   ├── master-data/              # Profile form, 3a editor, live FI panel
│   ├── scenarios/                # Scenario form, pillar sections, charts
│   ├── household/                # Couple layout, combined charts, FI
│   ├── shared/                   # Stepper inputs, workload fields, numeric steps
│   ├── tax-reference/            # Federal bracket editor
│   └── ui/                       # shadcn/ui + CollapsibleCard, LivePreviewCard
├── lib/
│   ├── engine/                   # ★ Calculation engine (platform-agnostic)
│   │   ├── inflation.ts          # Compound inflation from profile rate
│   │   ├── orchestrator.ts       # Single-person scenario pipeline
│   │   ├── household-orchestrator.ts
│   │   ├── financial-independence.ts
│   │   ├── capital-withdrawal-optimizer.ts
│   │   ├── legal-ages.ts
│   │   ├── workload.ts
│   │   ├── inheritance.ts
│   │   ├── constants.ts
│   │   └── modules/
│   │       ├── ahv.ts
│   │       ├── ahv-couple.ts
│   │       ├── bvg.ts
│   │       ├── pillar3a.ts
│   │       └── free-assets.ts
│   ├── household/                # Couple types, colors, partner profile
│   ├── pillar3a/                 # Account CRUD helpers, auto-split sim
│   ├── profile/                  # loadProfileForScenario, loadHouseholdProfile
│   ├── tax/                        # ESTV lookup, bracket interpolation, profile tax
│   ├── format/                   # Swiss numbers, rate normalization
│   ├── master-data/              # parse-form-profile (live FI preview)
│   ├── seed/                     # test-fixtures.mjs for QA seed
│   ├── scenarios/                # Profile row mapping
│   └── supabase/                 # Client, server, middleware proxy
├── scripts/
│   └── seed-test-data.mjs        # npm run seed:test — QA master data + scenarios
├── supabase/migrations/          # 001–012 SQL migrations
└── docs/                         # This documentation set
```

---

## 3. Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | Next.js (App Router), React 19, TypeScript | Server + client components |
| Styling | Tailwind CSS, shadcn/ui, lucide-react | |
| Auth & DB | Supabase Auth + PostgreSQL + RLS | Cookie sessions via `@supabase/ssr` |
| Engine | `lib/engine/` pure TypeScript | No DOM; runs in browser and SSR |
| Charts | Custom React/SVG components | `components/charts/` shared legend + tooltip; dual Y-axis styling; CSS `--chart-*` |
| State | React `useState` / `useTransition` in forms | No global Zustand store |
| Tax API | ESTV local tax lookup (server action) | Cached reference tables in DB |

---

## 4. Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Client Components)                                │
│  master-data-form · scenario-form · charts                  │
│       │ useTransition + server actions (save)               │
│       │ calculateScenarioPension() — instant recalc         │
└───────┼─────────────────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────────────────────┐
│  Next.js Server                                             │
│  Server Components (load profile/scenarios)                 │
│  Server Actions (save master data, tax lookup)                │
│  Supabase server client + RLS                               │
└───────┼─────────────────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────────────────────┐
│  Supabase PostgreSQL                                        │
│  profiles · scenarios · pillar3a_accounts · tax_* tables    │
└─────────────────────────────────────────────────────────────┘

        ┌──────────────────────────┐
        │  lib/engine (pure TS)     │  ← no DB dependency
        │  imported by client + SSR │
        └──────────────────────────┘
```

---

## 5. Calculation Pipeline

The v1 spec described a **shared `YearlyData[]` pipe** where every module mutates the same timeline. The **implemented engine** uses **module-specific projections** merged by orchestrators:

### 5.1 Single Person (`calculateScenarioPension`)

```
ProfileForScenario + ScenarioOverrides
        │
        ├──▶ calculateAhvPension()        → AhvResult
        ├──▶ calculateBvgPension()        → BvgResult (capital + annuity + injections)
        ├──▶ calculatePillar3a()          → Pillar3aResult (per-account + injections)
        └──▶ calculateFreeAssetsPension() → FreeAssetsResult (year-by-year drawdown)
                    ▲
                    └── scheduled injections from BVG + 3a + inheritance
        │
        ▼
ScenarioPensionResult { ahv, bvg, pillar3a, freeAssets, summary }
```

### 5.2 Couple (`calculateHouseholdPension`)

```
HouseholdProfileForScenario + primaryOverrides + partnerOverrides
        │
        ├──▶ calculateScenarioPension(primary)   — partner expenses zeroed
        ├──▶ calculateScenarioPension(partner)
        ├──▶ applyCoupleAhvPlafonierung()        — if married
        └──▶ mergeWealthProjections()
                 · horizon = younger person's planning horizon
                 · per-person savings, 3a expense offsets
                 · applySurvivorWealthTransfer() if partner younger
        │
        ▼
HouseholdPensionResult { primary, partner, combinedProjection, ... }
```

### 5.3 Financial Independence

Binary search on employment end age (current age → 70). Each candidate age runs full scenario; **sustainable** if free assets never negative until planning horizon.

### 5.4 Capital Withdrawal Optimizer

Grid search over BVG capital %, tranches, and 3a withdrawal offsets; minimizes cumulative `annualTotalTax` from free-assets projection.

---

## 6. Module Activation

Modules are **not** toggled in the UI. The orchestrator always runs AHV, BVG, and 3a when profile data exists. Free-assets projection requires `annualRetirementExpenses` and planning horizon for meaningful drawdown.

Tax calculation activates when tax settings resolve to reference brackets via ESTV lookup.

---

## 7. UI Architecture

### 7.1 Master Data Flow

```
/master-data (RSC)
  → loadUserProfile + loadHouseholdProfile + pillar3a accounts
  → MasterDataForm (client)
       → collapsible sections + stepper inputs
       → saveMasterData (server action)
       → FinancialIndependencePanel (live calc via parse-form-profile)
       → StickyPreviewLayout + LivePreviewCard (xl+ sticky FI chart)
```

### 7.2 Scenario Flow

```
/scenarios/[id] (RSC)
  → load profile + scenario row
  → ScenarioForm (client)
       → collapsible pillar sections
       → pillar sections: AHV, BVG, 3a, free assets, inheritance, optimizer
       → embedded | split layout (couple)
       → saveScenario (server action)
       → live engine recalc on state change
       → StickyPreviewLayout + ScenarioWealthPreview (combined wealth chart)
```

### 7.3 Reusable Scenario Sections

| Component | Modes |
|-----------|-------|
| `ScenarioAhvSection` | embedded / split |
| `ScenarioBvgSection` | embedded / split |
| `ScenarioPillar3aSection` | embedded / split |
| `HouseholdSplitLayout` | couple column wrapper |
| `CombinedWealthChart` | household free assets + events |
| `HouseholdPillar3aChart` | both persons + total |
| `ChartLegend` / `ChartFloatingTooltip` | shared chart UX (`components/charts/`) |

Person colors: `lib/household/person-colors.ts`.

### 7.4 Chart Interaction (v3)

- **Legend toggles:** `useChartSeriesVisibility()` hides/shows series on click (all line/bar charts).
- **Dual axis:** left-scale series drawn solid; right-scale series dashed (`RIGHT_AXIS_STROKE_DASH`).
- **Tooltips:** `getChartTooltipStyle()` flips tooltip left or up when cursor is near chart edge.

---

## 8. Auth & Security

- Supabase Auth email/password.
- Middleware (`lib/supabase/proxy.ts`) refreshes session.
- RLS on all user tables; tax reference tables read-only for authenticated users.
- **Post-login / post-password-reset redirect:** `/` (home dashboard).
- Email sign-up confirmation via `/auth/confirm` → `/`.
- No OAuth providers configured (v1 mentioned “later OAuth”).
- **Removed:** `/protected` Supabase-starter demo route (not part of product).

---

## 9. Deployment & Environment

Required env vars:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Optional scripts:

| Script | Purpose |
|--------|---------|
| `npm run db:migrate-003` | Column backfill when Supabase CLI unavailable |
| `npm run db:migrate-010` | Workload reductions column backfill |
| `npm run seed:test` | Insert QA master profile, 3a accounts, 20 `TEST:` scenarios |

Seed env (one of): `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL`, or `SUPABASE_DB_URL`. Optional `TEST_USER_EMAIL` targets a specific auth user.

---

## 10. Extensibility (How to Add Features)

| Feature | Where to extend |
|---------|-----------------|
| New pillar module | `lib/engine/modules/` + wire in `orchestrator.ts` |
| Couple rule | `household-orchestrator.ts` or `ahv-couple.ts` |
| New profile field | Migration + `lib/profile/extensions.ts` + form |
| New scenario override | `ScenarioOverrides` in `orchestrator.ts` + section component |
| New chart | `components/scenarios/` or `components/household/`; reuse `components/charts/` |
| Server-side-only calc | Import same engine in Route Handler (already portable) |

---

## 11. Testing Strategy

- Engine modules designed for unit tests without React.
- Run `npm run build` / `tsc` for compile verification.
- No dedicated E2E suite documented; manual scenario verification.

---

## 12. Not Implemented (from v1 Specs)

Items that the **v1 architecture document** described or implied but are **not** part of the current system:

| v1 concept | v1 expectation | Current status |
|------------|----------------|----------------|
| **Monorepo layout** | `apps/web` + `packages/engine` | Flat Next.js repo; engine at `lib/engine/` |
| **PWA / offline** | Service worker, installable app | Not implemented; standard web app only |
| **Offline engine** | Projections work without network | Requires auth + DB for save; calc works offline only if profile already loaded |
| **`BaseIncomeModule`** | Separate salary timeline module | Salary folded into AHV average income + workload scaling |
| **`YearlyData[]` pipe** | All modules mutate one timeline | Per-module projections merged by orchestrator |
| **`ResultModule` / gap** | Aggregates rente vs Wunsheinkommen | No gap module; FI replaces partial intent |
| **Zustand / React Context** | Global scenario state | Local component state |
| **Recharts / Chart.js** | Chart library | Custom SVG/React charts |
| **OAuth login** | “Later OAuth” | Email/password only |
| **Server-side engine API** | Optional future API | Not exposed; client-side only in UI |
| **AHV Level C** | Extend baseIncome with year array | Not implemented |
| **Kapitalverzehr module** | Separate longevity annuitization | Partial: free-assets drawdown only |
| **Inflation in timeline** | `rates.inflation` per year in YearlyData | **Implemented** — single profile `inflation_rate` compounds selected flows (not pensions) |
| **Dynamic rate scenarios** | Per-year rate changes in pipe | Static rates from profile/scenario overrides |
| **Wealth accounts UI** | Migration 002 tables | DB tables exist; **no UI or engine integration** |
| **Real-estate module** | Post-MVP | Not implemented |
| **Advisor API** | Post-MVP | Not implemented |

See also [requirements.md §13](./requirements.md#13-not-implemented-from-v1-specs) for the full product-level backlog.

---

## Appendix: Document History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2024 | German; monorepo PWA; YearlyData pipe; single person |
| v2 | May 2026 | English; actual repo layout; orchestrator merge model; couple layer |
| v3 | June 2026 | Inflation module; chart shared components; collapsible/sticky UI; live FI; seed script; auth cleanup; migrations 012 |

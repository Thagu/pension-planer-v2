# Swiss Pension Planner — Documentation (v3)

> **Version:** 3.0 · June 2026 · **Language:** English

This folder contains the product and technical specifications for the **currently implemented** Swiss Pension Planner application. Together they are sufficient for an agent or developer to rebuild the app.

## Documents

| File | Purpose |
|------|---------|
| [requirements.md](./requirements.md) | Product requirements, features, engine rules, success criteria |
| [user_stories.md](./user_stories.md) | Epics, user stories, acceptance criteria, implementation order |
| [architecture.md](./architecture.md) | System structure, tech stack, data flow, component layout |
| [datamodel.md](./datamodel.md) | Database schema, TypeScript types, JSON shapes |

## Reading order for rebuild agents

1. **requirements.md** — understand scope and business rules  
2. **datamodel.md** — schema and type contracts  
3. **architecture.md** — where code lives and how layers connect  
4. **user_stories.md** — incremental delivery checklist  

## v2 → v3 (June 2026)

Version 3 documents UX polish, inflation in the engine, chart interaction, auth cleanup, and QA seeding added after the v2 baseline:

| Area | v3 change |
|------|-----------|
| **Inflation** | `profiles.inflation_rate` (migration 012); engine compounds salary, savings, 3a contributions, and retirement expenses |
| **Master data UX** | Collapsible sections, CHF/percent steppers, BVG JSON suggestions, live FI preview (no save required), sticky chart preview on desktop |
| **Scenario UX** | Collapsible pillar sections, sticky wealth preview, income-distribution chart only when >1 source |
| **Charts** | Clickable legend toggles all series; dual Y-axis convention (left = solid, right = dashed); smart tooltip positioning |
| **Auth** | Post-login redirect to `/`; removed Supabase-starter `/protected` demo route |
| **QA seed** | `npm run seed:test` loads master profile, 3a accounts, and 20 `TEST:` scenarios |

Each document includes an **Appendix: Document History** with the full v3 delta. Sections **“Not implemented (from v1 specs)”** remain for backlog items still missing.

## v1 → v2

The original specs (German, MVP-only, single person) described many features as *out of scope* or *post-MVP*. Most of those have since been **implemented** (couple mode, multi-3a, tax, FI, workload, charts). v2 captured that implemented baseline in English.

## Out of scope for this folder

- `docs/pension_planner/nextjs_space/` — legacy prototype (Prisma/NextAuth); **not** the running app. Do not use as source of truth.

## Related code paths

```
app/                    Next.js routes & server actions
components/
  charts/               Shared chart legend + tooltip positioning
  layout/               StickyPreviewLayout (master data / scenario previews)
  master-data/          Profile form, 3a editor, live FI panel
  scenarios/            Scenario form, pillar sections, charts
  household/            Couple layout, combined charts
  shared/               Stepper inputs, workload fields, numeric step constants
  ui/                   shadcn/ui + CollapsibleCard, LivePreviewCard
lib/engine/             Calculation engine (pure TypeScript)
lib/engine/inflation.ts Compound inflation helpers
lib/household/          Couple types & person colors
lib/master-data/        Live form → profile parse for FI preview
lib/seed/               Test fixtures for QA seed script
lib/tax/                Tax lookup & additional-income tax
lib/profile/            Profile loading from Supabase
lib/pillar3a/           3a accounts & auto-split
scripts/seed-test-data.mjs   QA seed (service role or DB URL)
supabase/migrations/    Database schema (001–012)
```

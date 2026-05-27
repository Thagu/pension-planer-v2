# Pension Planner Schweiz – Architektur

## 1. Überblick

Die App ist als PWA (Progressive Web App) aufgebaut. Die gesamte Berechnungslogik
lebt in einem eigenständigen Package (`engine`), das sowohl im Browser (Frontend)
als auch später auf einem Server (Backend) laufen kann.

---

## 2. Projektstruktur

```
pension-planner/
  ├── apps/
  │   └── web/              # Next.js PWA (Frontend)
  ├── packages/
  │   └── engine/           # Berechnungslogik (reines TypeScript)
  │       ├── types.ts
  │       ├── orchestrator.ts
  │       └── modules/
  │           ├── baseIncome.ts
  │           ├── ahv.ts
  │           ├── bvg.ts
  │           ├── pillar3a.ts
  │           └── freeAssets.ts
  ├── supabase/             # DB Schema + Auth Config
  └── docs/                 # requirements.md, architecture.md, datamodel.md
```

---

## 3. Tech-Stack

| Schicht | Technologie | Begründung |
|---|---|---|
| Frontend | Next.js (React) | PWA-fähig, TypeScript, grosses Ökosystem |
| Engine | TypeScript (pure) | Portabel: läuft im Browser und auf Server |
| Auth + DB | Supabase | Schnelles Setup, CH/EU-Hosting möglich, DSGVO-konform |
| State | Zustand / React Context | Leichtgewichtig für Szenario-State |
| Charts | Recharts / Chart.js | Einfache Integration in React |

---

## 4. Berechnungs-Engine: Das Pipe-Prinzip

### Konzept

Die Engine erstellt eine Zeitreihe (Array von `YearlyData`-Objekten) von heute bis
Alter 90. Jedes Modul läuft über dieses Array und schreibt seine Werte in die
entsprechenden Felder.

### Ablauf

```
UserInput
    │
    ▼
Orchestrator
    │  erstellt leeres YearlyData[]
    │
    ├──▶ BaseIncomeModule    → schreibt salaryBrutto
    ├──▶ BvgModule           → schreibt bvgCapital, bvgRente, bvgContribution
    ├──▶ AhvModule           → schreibt ahvRente
    ├──▶ Pillar3aModule      → schreibt pillar3aCapital, pillar3aContribution
    ├──▶ FreeAssetsModule    → schreibt freeAssets, investmentIncome
    └──▶ ResultModule        → aggregiert Gesamtrente, Lücke, Kapital
```

### Modul-Interface (Standard)

Jedes Modul hat dieselbe Signatur:

```typescript
type SimulationModule = (
  timeline: YearlyData[],
  input: ScenarioInput
) => YearlyData[];
```

### Modul-Aktivierung

Module werden **nicht** durch User-Schalter aktiviert.
Die Engine prüft selbst, ob die nötigen Inputs vorhanden sind:

```typescript
if (input.pillar3a) {
  timeline = applyPillar3a(timeline, input);
}
```

---

## 5. Logik-Location

**MVP: Frontend-only (Client-side)**
- Simulation läuft komplett im Browser
- Keine API-Latenz bei Slider-Änderungen
- Offline-fähig (PWA)
- Engine-Code ist portabel → spätere Migration zu Server-Side möglich ohne Refactor

---

## 6. Auth & Persistenz

- **Auth:** Supabase Auth (Email/Passwort, später OAuth)
- **Daten:** Supabase PostgreSQL
- **Sync:** Szenarien werden als JSON in der DB gespeichert
- **Datenschutz:** Hosting in EU/CH, minimale Datenhaltung

---

## 7. Erweiterbarkeit

| Feature | Erweiterung |
|---|---|
| Neues Berechnungsmodul | Neue Datei in `packages/engine/modules/` |
| Paar-Planung | Zweites `ScenarioInput`-Objekt, Orchestrator läuft zweimal |
| Server-Side Engine | Engine-Package als API-Handler importieren |
| AHV Level C | `baseIncome`-Modul um Jahres-Array erweitern |
| Kapitalverzehr | Neues Modul nach `ResultModule` einhängen |

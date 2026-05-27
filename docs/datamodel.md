# Pension Planner Schweiz – Datenmodell

## 1. YearlyData (Kern der Simulation)

Jedes Jahr der Simulation wird als ein Objekt dieses Typs modelliert.
Die Module schreiben ihre Werte in dieses Objekt (Pipe-Prinzip).

```typescript
interface YearlyData {
  // Meta
  year: number;
  age: number;
  isRetired: boolean;

  // Einkommen (Cashflow In)
  salaryBrutto: number;
  ahvRente: number;
  bvgRente: number;
  investmentIncome: number;       // Erträge aus freeAssets (reinvestiert)

  // Vermögenswerte (Bestand, Jahresende)
  bvgCapital: number;
  pillar3aCapital: number;
  freeAssets: number;

  // Beiträge / Abflüsse (Cashflow Out)
  bvgContribution: number;
  pillar3aContribution: number;

  // Jahresspezifische Annahmen (ermöglicht dynamische Szenarien)
  rates: {
    inflation: number;            // z.B. 0.02
    returnBvg: number;            // z.B. 0.01
    return3a: number;             // z.B. 0.03
    returnFreeAssets: number;     // z.B. 0.04
  };
}
```

---

## 2. UserProfile (in Supabase gespeichert)

Stammdaten der Person – nicht szenario-spezifisch.

```typescript
interface UserProfile {
  id: string;                     // Supabase UUID
  email: string;
  birthDate: string;              // ISO 8601: "1985-03-15"
  gender: "male" | "female";     // für AHV-Referenzalter
  employmentStartYear: number;    // für AHV-Beitragsjahre
  createdAt: string;
}
```

---

## 3. Scenario (in Supabase gespeichert)

Ein Szenario = ein spezifischer Finanzpfad der Person.
Mehrere Szenarien pro User möglich (z.B. "Basis", "Frühpensionierung").

```typescript
interface Scenario {
  id: string;
  userId: string;
  name: string;                   // z.B. "Frühpensionierung mit 62"
  createdAt: string;
  updatedAt: string;
  input: ScenarioInput;           // alle Berechnungs-Inputs als JSON
}
```

---

## 4. ScenarioInput (Berechnungs-Inputs)

Das zentrale Input-Objekt, das durch alle Module gereicht wird.

```typescript
interface ScenarioInput {

  // Persönlich (aus UserProfile)
  birthDate: string;
  gender: "male" | "female";
  employmentStartYear: number;

  // Pensionierung
  retirementAge: number;          // z.B. 65

  // Einkommen
  currentSalaryBrutto: number;    // aktuelles Jahresbrutto in CHF
  salaryOverrides?: Record<number, number>; // Jahr -> Lohn (für Level C, Post-MVP)
  plannedCareerBreaks?: number[]; // Jahre mit Erwerbsunterbruch

  // BVG (Pensionskasse)
  bvg: {
    currentCapital: number;
    coordinationDeductionMode: "standard" | "none" | "custom";
    coordinationDeductionCustom?: number;
    conversionRate: number;       // Umwandlungssatz, z.B. 0.068
  };

  // Säule 3a
  pillar3a?: {
    currentCapital: number;
    annualContribution: number;
  };

  // Freies Vermögen
  freeAssets?: {
    currentValue: number;
  };

  // Globale Annahmen (konstant über alle Jahre im MVP)
  assumptions: {
    inflationRate: number;        // z.B. 0.02
    returnRateBvg: number;        // z.B. 0.01
    returnRate3a: number;         // z.B. 0.03
    returnRateFreeAssets: number; // z.B. 0.04
  };
}
```

---

## 5. SimulationResult (Output der Engine)

```typescript
interface SimulationResult {
  timeline: YearlyData[];         // vollständige Zeitreihe

  summary: {
    capitalAtRetirement: {
      bvg: number;
      pillar3a: number;
      freeAssets: number;
      total: number;
    };
    monthlyIncomeAtRetirement: {
      ahv: number;
      bvg: number;
      total: number;
    };
    retirementGap?: {
      monthly: number;            // Differenz zu Wunscheinkommen
      percentage: number;
    };
  };
}
```

---

## 6. Supabase DB Schema (vereinfacht)

```sql
-- User Profile
create table profiles (
  id uuid references auth.users primary key,
  email text not null,
  birth_date date not null,
  gender text not null,
  employment_start_year int not null,
  created_at timestamptz default now()
);

-- Szenarien
create table scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  input jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## 7. Wichtige Design-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| `salaryOverrides` bereits im Interface | Vorbereitung für Level C (AHV-Präzision) ohne Refactor |
| `pillar3a` und `freeAssets` optional | Module werden nur aktiviert wenn Daten vorhanden |
| `rates` pro Jahr in YearlyData | Ermöglicht später dynamische Zinsszenarien |
| `input` als JSONB in Supabase | Flexibel erweiterbar ohne DB-Migration |
| Simulation läuft client-side | Keine API-Latenz, offline-fähig, Engine portabel |

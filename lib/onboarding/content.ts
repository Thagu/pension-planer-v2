/** Erklärtexte und Vereinfachungen für den Onboarding-Wizard (Deutsch). */

export type SimplificationItem = {
  label: string;
  text: string;
};

export type SimplificationNote = {
  title: string;
  /** Optionaler Einleitungssatz vor der Liste */
  intro?: string;
  /** Übersichtliche Stichpunkte (z. B. Stammdaten / Szenario / Overrides) */
  items?: readonly SimplificationItem[];
  /** Fließtext, wenn keine Liste sinnvoll ist — oder als Abschluss */
  body?: string;
};

export const SIMPLIFICATIONS = {
  savingsVsSalary: {
    title: "Sparquote statt «Lohn minus Ausgaben»",
    intro: "In der Erwerbsphase modellieren wir kein vollständiges Haushaltsbudget.",
    items: [
      {
        label: "Sparquote",
        text: "Jährlicher CHF-Zufluss ins freie Vermögen — nicht «Brutto minus Steuern und Lebenshaltung».",
      },
      {
        label: "Bruttolohn",
        text: "Grundlage für AHV/BVG; BVG- und 3a-Beiträge laufen über das Gehalt.",
      },
      {
        label: "Freies Vermögen",
        text: "Wächst durch Sparquote und Rendite bis zur Pensionierung.",
      },
    ],
  },
  netLivingExpenses: {
    title: "Netto-Lebenshaltung ab Pensionierung",
    intro: "Geschätzte jährliche Lebenshaltung in heutiger Kaufkraft (Wohnen, Essen, Freizeit).",
    items: [
      {
        label: "Enthalten",
        text: "Laufende Ausgaben des Haushalts ab Pensionierung.",
      },
      {
        label: "Nicht enthalten",
        text: "Steuern, BVG- und 3a-Einzahlungen — diese werden separat berechnet.",
      },
      {
        label: "Renten mindern Bedarf",
        text: "AHV- und BVG-Renten reduzieren den Kapitalbedarf aus freiem Vermögen.",
      },
    ],
  },
  fiVsPlannedRetirement: {
    title: "FI-Alter vs. geplantes Pensionierungsalter",
    items: [
      {
        label: "Finanzielle Unabhängigkeit (FI)",
        text: "Frühestes Alter, ab dem Ihr Vermögen bis zum Planungshorizont durchgehend positiv bleibt — bei den eingegebenen Annahmen.",
      },
      {
        label: "Geplantes Pensionierungsalter",
        text: "Ihr persönliches Ziel; kann vom FI-Alter abweichen (früher oder später).",
      },
      {
        label: "Empfindlichkeit",
        text: "Kleine Änderungen an Rendite oder Ausgaben können das FI-Alter in der Vorschau verschieben.",
      },
    ],
  },
  masterDataVsScenario: {
    title: "Stammdaten vs. Szenario",
    items: [
      {
        label: "Stammdaten",
        text: "Ihr Ausgangszustand («Wahrheit») — einmal pflegen, selten ändern.",
      },
      {
        label: "Szenarien",
        text: "«Was wäre wenn?»-Varianten: frühere Pensionierung, Kapitalbezug BVG, gestaffelter 3a-Bezug — ohne Stammdaten zu überschreiben.",
      },
      {
        label: "Overrides",
        text: "Im Szenario nur aktivieren, wenn Sie bewusst vom Profil abweichen wollen.",
      },
    ],
  },
  taxEstimate: {
    title: "Steuerschätzung",
    items: [
      {
        label: "Referenzsätze",
        text: "Kapitalbezüge und Renten werden mit ESTV-Daten für Ihre Gemeinde geschätzt.",
      },
      {
        label: "Keine Steuerberatung",
        text: "Individuelle Verhältnisse (Abzüge, Sonderfälle) sind nicht abgebildet.",
      },
      {
        label: "Keine manuellen Sätze",
        text: "Eigene Steuersätze können nicht hinterlegt werden.",
      },
    ],
  },
  bvgDefaults: {
    title: "BVG-Vereinfachungen",
    items: [
      {
        label: "Standardwerte",
        text: "Gesetzlicher Mindestzinssatz und üblicher Umwandlungssatz, wenn Sie nichts anderes eingeben.",
      },
      {
        label: "Kapital vs. Rente",
        text: "Kapitalbezug oder Verrentung planen Sie später im Szenario — nicht zwingend in den Stammdaten.",
      },
    ],
  },
  workload: {
    title: "Teilpensionierung",
    body:
      "Reduziertes Arbeitspensum skaliert Lohn, BVG-Beiträge und Sparquote proportional — kein detailliertes Netto-Lohnmodell pro Pensumstufe.",
  },
} as const satisfies Record<string, SimplificationNote>;

export type WizardStepId =
  | "welcome"
  | "concept"
  | "mode"
  | "person1"
  | "wealth"
  | "bvg"
  | "planning"
  | "partner"
  | "tax"
  | "review"
  | "scenario";

export type WizardStep = {
  id: WizardStepId;
  title: string;
  subtitle?: string;
  simplification?: SimplificationNote;
};

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: "welcome",
    title: "Willkommen",
    subtitle: "In wenigen Schritten zu Stammdaten und Ihrem ersten Szenario.",
  },
  {
    id: "concept",
    title: "So funktioniert der Planner",
    simplification: SIMPLIFICATIONS.masterDataVsScenario,
  },
  {
    id: "mode",
    title: "Planungsmodus",
    subtitle: "Einzelperson oder Paar mit gemeinsamen Haushaltsausgaben.",
  },
  {
    id: "person1",
    title: "Person 1 — Basis",
    subtitle: "Mindestangaben für AHV, BVG und Projektion.",
  },
  {
    id: "wealth",
    title: "Person 1 — Vermögen",
    simplification: SIMPLIFICATIONS.savingsVsSalary,
  },
  {
    id: "bvg",
    title: "Person 1 — BVG (grob)",
    simplification: SIMPLIFICATIONS.bvgDefaults,
  },
  {
    id: "planning",
    title: "Planung & Ausgaben",
    simplification: SIMPLIFICATIONS.netLivingExpenses,
  },
  {
    id: "partner",
    title: "Person 2",
    subtitle: "Partner-Stammdaten (Paarmodus).",
  },
  {
    id: "tax",
    title: "Steuerdomizil",
    simplification: SIMPLIFICATIONS.taxEstimate,
  },
  {
    id: "review",
    title: "Zusammenfassung & FI",
    simplification: SIMPLIFICATIONS.fiVsPlannedRetirement,
  },
  {
    id: "scenario",
    title: "Erstes Szenario",
    subtitle: "Benennen und speichern — danach können Sie Varianten ausprobieren.",
  },
];

export function visibleSteps(planningMode: "single" | "couple"): WizardStep[] {
  return WIZARD_STEPS.filter(
    (s) => s.id !== "partner" || planningMode === "couple",
  );
}

/** Sinnvolle Schritte für CHF- und Zahlenfelder */
export const CHF_STEP = {
  /** Vermögen, BVG-Kapital, Haushaltsausgaben */
  wealth: 10_000,
  /** Bruttojahreslohn */
  income: 10_000,
  /** Jährliche Sparquote */
  savings: 1_000,
  /** Erbschaft / Schenkung */
  inheritance: 100_000,
  /** Kleinere Beträge (koordinierter Lohn, Schwellenwerte) */
  small: 1_000,
  /** 3a-Einzahlung */
  contribution3a: 500,
} as const;

export const NUM_STEP = {
  age: 1,
  year: 1,
  percent: 0.25,
  percentFine: 0.1,
  workload: 5,
} as const;

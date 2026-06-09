/** UI-Farben für Person 1 / Person 2 (Paarmodus) */
export const PERSON1_COLOR = "hsl(var(--primary))";
export const PERSON2_COLOR = "hsl(270 55% 50%)";
export const PERSON1_BG = "bg-primary/[0.04] border-primary/20";
export const PERSON2_BG = "bg-violet-500/[0.05] border-violet-500/20";

export function personLabel(role: "primary" | "partner"): string {
  return role === "primary" ? "Person 1" : "Person 2";
}

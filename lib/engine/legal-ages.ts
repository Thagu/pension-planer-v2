/**
 * Gesetzliche Altersgrenzen (AHV 21, BVG, BVV 3 / Säule 3a)
 * Vereinfacht für Planungszwecke – Stand 2025/2026.
 */

export type PensionGender = "male" | "female";

/** Referenzalter AHV (volle Rente ohne Vorbezug-Kürzung) */
export function getAhvReferenceAge(
  birthDate: string,
  gender?: PensionGender | null,
): number {
  if (gender !== "female") return 65;

  const birthYear = new Date(birthDate).getFullYear();
  if (birthYear <= 1960) return 64;
  if (birthYear >= 1964) return 65;

  const monthsExtra: Record<number, number> = {
    1961: 3,
    1962: 6,
    1963: 9,
  };
  const extra = monthsExtra[birthYear] ?? 0;
  return 64 + extra / 12;
}

/** Frühester AHV-Rentenbeginn (Vorbezug) */
export function getAhvEarliestPensionAge(
  birthDate: string,
  gender?: PensionGender | null,
): number {
  if (gender === "female") {
    const birthYear = new Date(birthDate).getFullYear();
    if (birthYear >= 1961 && birthYear <= 1969) return 62;
  }
  return 63;
}

/** Frühester BVG-Leistungsbeginn (Art. 14 BVG, bei Erwerbsaufgabe) */
export const BVG_EARLIEST_PENSION_AGE = 58;

/** 3a: frühester ordentlicher Kapitalbezug = 5 Jahre vor AHV-Referenzalter (BVV 3) */
export function getPillar3aEarliestWithdrawalAge(
  birthDate: string,
  gender?: PensionGender | null,
): number {
  const reference = getAhvReferenceAge(birthDate, gender);
  return Math.max(0, Math.floor(reference - 5));
}

/**
 * Frühester effektiver 3a-Bezug: gesetzlich 5 Jahre vor AHV-Referenzalter (BVV 3).
 * Frühere Erwerbsaufgabe erlaubt keinen Kapitalbezug vor diesem Alter.
 */
export function getPillar3aEffectiveEarliestWithdrawalAge(
  birthDate: string,
  gender: PensionGender | null | undefined,
  _employmentEndAge: number,
): number {
  return getPillar3aEarliestWithdrawalAge(birthDate, gender);
}

/**
 * 3a: spätester Bezug – gestaffelt bis zum AHV-Bezugsalter möglich
 * (Konten müssen nicht gleichzeitig aufgelöst werden).
 */
export function getPillar3aLatestWithdrawalAge(
  ahvPensionStartAge: number,
): number {
  return ahvPensionStartAge;
}

export function clampAge(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Erwerbsaufgabe im Szenario */
export function resolveEmploymentEndAge(
  profileRetirementAge: number,
  override?: number | null,
): number {
  if (override != null) {
    // Explizites Erwerbsende (z. B. FI-Suche): darf vor BVG-Mindestalter liegen
    return clampAge(override, 18, 70);
  }
  return clampAge(profileRetirementAge, BVG_EARLIEST_PENSION_AGE, 70);
}

/**
 * AHV-Bezugsalter: Standard = Referenzalter (z. B. 65),
 * auch wenn die Erwerbstätigkeit früher endet. Optional Vorbezug ab 63 (bzw. 62).
 */
export function resolveAhvPensionStartAge(
  birthDate: string,
  gender: PensionGender | null | undefined,
  employmentEndAge: number,
  override?: number | null,
): number {
  const reference = getAhvReferenceAge(birthDate, gender);
  const earliest = getAhvEarliestPensionAge(birthDate, gender);

  if (override != null) {
    return clampAge(override, earliest, 70);
  }

  if (employmentEndAge >= reference) {
    return clampAge(employmentEndAge, reference, 70);
  }

  return clampAge(reference, earliest, 70);
}

/** BVG-Leistungsbeginn: frühestens 58, sonst ab Erwerbsaufgabe */
export function resolveBvgPensionStartAge(
  employmentEndAge: number,
  override?: number | null,
): number {
  if (override != null) {
    return clampAge(override, BVG_EARLIEST_PENSION_AGE, 70);
  }
  return clampAge(
    Math.max(employmentEndAge, BVG_EARLIEST_PENSION_AGE),
    BVG_EARLIEST_PENSION_AGE,
    70,
  );
}

/** 3a-Bezugsalter pro Konto (Jahre relativ zum BVG-Beginn, mit gesetzlichen Grenzen) */
export function resolvePillar3aWithdrawalAge(
  birthDate: string,
  gender: PensionGender | null | undefined,
  employmentEndAge: number,
  bvgPensionStartAge: number,
  ahvPensionStartAge: number,
  yearsRelativeToBvgStart: number,
  absoluteAgeOverride?: number | null,
): number {
  const earliest = getPillar3aEffectiveEarliestWithdrawalAge(
    birthDate,
    gender,
    employmentEndAge,
  );
  const latest = getPillar3aLatestWithdrawalAge(ahvPensionStartAge);

  const planned =
    absoluteAgeOverride != null
      ? absoluteAgeOverride
      : bvgPensionStartAge + yearsRelativeToBvgStart;

  return clampAge(planned, earliest, Math.max(earliest, latest));
}

/** Zulässiger Offset-Bereich relativ zum BVG-Leistungsbeginn */
export function pillar3aWithdrawalOffsetBounds(
  bvgPensionStartAge: number,
  earliestWithdrawalAge: number,
  latestWithdrawalAge: number,
  minOffset = -5,
  maxOffset = 5,
): { min: number; max: number } {
  const min = Math.max(minOffset, earliestWithdrawalAge - bvgPensionStartAge);
  const max = Math.min(maxOffset, latestWithdrawalAge - bvgPensionStartAge);
  return { min, max: Math.max(min, max) };
}

export function clampPillar3aWithdrawalOffset(
  offset: number,
  bounds: { min: number; max: number },
): number {
  return Math.max(bounds.min, Math.min(bounds.max, Math.round(offset)));
}

/** Jahre relativ zum BVG-Beginn (negativ = vor BVG) */
export function pillar3aYearOffsetFromBvgStart(
  withdrawalAge: number,
  bvgPensionStartAge: number,
): number {
  return withdrawalAge - bvgPensionStartAge;
}

/** Ob AHV in einem gegebenen Alter bereits bezogen wird */
export function isAhvPensionActive(age: number, pensionStartAge: number): boolean {
  return age >= pensionStartAge;
}

export function isBvgPensionActive(age: number, pensionStartAge: number): boolean {
  return age >= pensionStartAge;
}

export function annualPensionIncomeAtAge(
  age: number,
  ahvYearly: number,
  bvgYearly: number,
  ahvStartAge: number,
  bvgStartAge: number,
): number {
  let total = 0;
  if (isAhvPensionActive(age, ahvStartAge)) total += ahvYearly;
  if (isBvgPensionActive(age, bvgStartAge)) total += bvgYearly;
  return total;
}

/** Anzeige Referenzalter (Jahre + optionale Monate) */
export function formatAhvReferenceAge(age: number): string {
  const whole = Math.floor(age);
  const months = Math.round((age - whole) * 12);
  if (months <= 0) return `${whole} Jahre`;
  return `${whole} J. ${months} Mt.`;
}

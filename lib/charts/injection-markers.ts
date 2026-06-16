/** Horizontal offsets for stacked capital-injection dots on wealth charts. */
export function injectionMarkerXOffsets(p: {
  bvgCapitalInjection: number;
  pillar3aCapitalInjection: number;
  inheritanceInjection?: number;
}): { bvg: number; inheritance: number; pillar3a: number } {
  const hasBvg = p.bvgCapitalInjection > 0;
  const has3a = p.pillar3aCapitalInjection > 0;
  const hasInheritance = (p.inheritanceInjection ?? 0) > 0;
  const spacing = 6;

  if (!hasBvg && !has3a && !hasInheritance) {
    return { bvg: 0, inheritance: 0, pillar3a: 0 };
  }

  const count = [hasBvg, hasInheritance, has3a].filter(Boolean).length;
  if (count === 1) return { bvg: 0, inheritance: 0, pillar3a: 0 };

  if (count === 2) {
    if (hasBvg && has3a) {
      return { bvg: -spacing, inheritance: 0, pillar3a: spacing };
    }
    if (hasBvg && hasInheritance) {
      return { bvg: -spacing, inheritance: spacing, pillar3a: 0 };
    }
    return { bvg: 0, inheritance: -spacing, pillar3a: spacing };
  }

  return { bvg: -spacing, inheritance: 0, pillar3a: spacing };
}

export function hasCapitalInjectionMarker(p: {
  bvgCapitalInjection: number;
  pillar3aCapitalInjection: number;
  inheritanceInjection?: number;
}): boolean {
  return (
    p.bvgCapitalInjection > 0 ||
    p.pillar3aCapitalInjection > 0 ||
    (p.inheritanceInjection ?? 0) > 0
  );
}

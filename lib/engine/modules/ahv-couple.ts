/**
 * AHV Paarregeln (Verheiratete)
 * ==============================
 * Plafonierung: Summe der individuellen Renten max. 150 % der Maximalrente.
 * Überschreitung wird proportional auf beide Renten verteilt.
 */

import { AHV_MAX_YEARLY_PENSION } from "../constants";

/** Gesetzliche Obergrenze für Ehepaare (150 % der Einzel-Maximalrente) */
export const AHV_COUPLE_MAX_FACTOR = 1.5;

export type CoupleAhvPlafonierungResult = {
  primaryYearly: number;
  partnerYearly: number;
  totalYearly: number;
  capYearly: number;
  capApplied: boolean;
  reductionPercent: number;
};

export function getCoupleAhvCapYearly(): number {
  return Math.round(AHV_MAX_YEARLY_PENSION * AHV_COUPLE_MAX_FACTOR);
}

export function applyCoupleAhvPlafonierung(
  primaryYearly: number,
  partnerYearly: number,
): CoupleAhvPlafonierungResult {
  const capYearly = getCoupleAhvCapYearly();
  const rawTotal = Math.max(0, primaryYearly) + Math.max(0, partnerYearly);

  if (rawTotal <= 0) {
    return {
      primaryYearly: 0,
      partnerYearly: 0,
      totalYearly: 0,
      capYearly,
      capApplied: false,
      reductionPercent: 0,
    };
  }

  if (rawTotal <= capYearly) {
    return {
      primaryYearly: Math.round(primaryYearly),
      partnerYearly: Math.round(partnerYearly),
      totalYearly: Math.round(rawTotal),
      capYearly,
      capApplied: false,
      reductionPercent: 0,
    };
  }

  const ratio = capYearly / rawTotal;
  const adjustedPrimary = Math.round(Math.max(0, primaryYearly) * ratio);
  const adjustedPartner = Math.round(Math.max(0, partnerYearly) * ratio);

  return {
    primaryYearly: adjustedPrimary,
    partnerYearly: adjustedPartner,
    totalYearly: adjustedPrimary + adjustedPartner,
    capYearly,
    capApplied: true,
    reductionPercent: Math.round((1 - ratio) * 1000) / 10,
  };
}

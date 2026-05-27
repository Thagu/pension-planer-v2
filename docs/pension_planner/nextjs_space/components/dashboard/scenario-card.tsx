'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ShieldCheck, Building2 } from 'lucide-react';
import { calculateAhvPension, calculateBvgPension, formatCHF } from '@/lib/engine';
import type { AhvResult, BvgResult } from '@/lib/engine';

interface ScenarioItem {
  id: string;
  name: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface ProfileData {
  birthDate: string | null;
  retirementAge: number | null;
  currentSalaryBrutto: number | null;
  bvgCurrentCapital: number | null;
  bvgInterestRate: number | null;
  bvgConversionRate: number | null;
  bvgContributionRates: Record<string, number> | null;
}

interface Props {
  scenario: ScenarioItem;
  profileData: ProfileData;
  onEdit: () => void;
  onDelete: () => void;
}

export function ScenarioCard({ scenario, profileData, onEdit, onDelete }: Props) {
  const ahvData = scenario?.data?.ahv;
  const bvgData = scenario?.data?.bvg;

  // Effektives Pensionsalter und Einkommen
  const effectiveRetirementAge = ahvData?.retirementAgeOverride ?? profileData.retirementAge ?? 65;
  const effectiveIncome = ahvData?.averageIncomeOverride ?? profileData.currentSalaryBrutto ?? 0;

  // Berechne AHV für dieses Szenario
  const scenarioAhv: AhvResult | null = useMemo(() => {
    if (!profileData.birthDate || effectiveIncome <= 0) return null;
    return calculateAhvPension({
      birthDate: profileData.birthDate,
      averageAnnualIncome: effectiveIncome,
      retirementAge: effectiveRetirementAge,
      missingContributionYears: ahvData?.missingContributionYears ?? 0,
    });
  }, [profileData, ahvData, effectiveRetirementAge, effectiveIncome]);

  // Berechne BVG für dieses Szenario
  const scenarioBvg: BvgResult | null = useMemo(() => {
    if (!profileData.birthDate || effectiveIncome <= 0) return null;
    return calculateBvgPension({
      birthDate: profileData.birthDate,
      currentSalaryBrutto: effectiveIncome,
      currentCapital: profileData.bvgCurrentCapital ?? 0,
      retirementAge: effectiveRetirementAge,
      coordinationDeductionMode: bvgData?.coordinationDeductionMode ?? 'standard',
      interestRate: bvgData?.interestRateOverride
        ? bvgData.interestRateOverride / 100
        : (profileData.bvgInterestRate != null ? profileData.bvgInterestRate / 100 : undefined),
      conversionRate: bvgData?.conversionRateOverride
        ? bvgData.conversionRateOverride / 100
        : (profileData.bvgConversionRate != null ? profileData.bvgConversionRate / 100 : undefined),
      customContributionRates: bvgData?.customContributionRates
        ? Object.fromEntries(Object.entries(bvgData.customContributionRates).map(([k, v]) => [k, (v as number) / 100]))
        : (profileData.bvgContributionRates
          ? Object.fromEntries(Object.entries(profileData.bvgContributionRates).map(([k, v]) => [k, (v as number) / 100]))
          : undefined),
    });
  }, [profileData, bvgData, effectiveRetirementAge, effectiveIncome]);

  // Basis vom Profil
  const baseAhv: AhvResult | null = useMemo(() => {
    if (!profileData.birthDate || !profileData.currentSalaryBrutto) return null;
    return calculateAhvPension({
      birthDate: profileData.birthDate,
      averageAnnualIncome: profileData.currentSalaryBrutto,
      retirementAge: profileData.retirementAge ?? 65,
    });
  }, [profileData]);

  const baseBvg: BvgResult | null = useMemo(() => {
    if (!profileData.birthDate || !profileData.currentSalaryBrutto) return null;
    return calculateBvgPension({
      birthDate: profileData.birthDate,
      currentSalaryBrutto: profileData.currentSalaryBrutto,
      currentCapital: profileData.bvgCurrentCapital ?? 0,
      retirementAge: profileData.retirementAge ?? 65,
      interestRate: profileData.bvgInterestRate != null ? profileData.bvgInterestRate / 100 : undefined,
      conversionRate: profileData.bvgConversionRate != null ? profileData.bvgConversionRate / 100 : undefined,
      customContributionRates: profileData.bvgContributionRates
        ? Object.fromEntries(Object.entries(profileData.bvgContributionRates).map(([k, v]) => [k, (v as number) / 100]))
        : undefined,
    });
  }, [profileData]);

  const totalScenario = (scenarioAhv?.monthlyPension ?? 0) + (scenarioBvg?.monthlyPension ?? 0);
  const totalBase = (baseAhv?.monthlyPension ?? 0) + (baseBvg?.monthlyPension ?? 0);
  const diffTotal = totalScenario - totalBase;

  const hasAhvOverrides = ahvData?.retirementAgeOverride != null
    || (ahvData?.missingContributionYears ?? 0) > 0
    || ahvData?.averageIncomeOverride != null;
  const hasBvgOverrides = bvgData?.conversionRateOverride != null
    || bvgData?.interestRateOverride != null
    || (bvgData?.coordinationDeductionMode != null && bvgData?.coordinationDeductionMode !== 'standard')
    || bvgData?.customContributionRates != null;
  const hasOverrides = hasAhvOverrides || hasBvgOverrides;

  // Override Tags
  const overrideTags: string[] = [];
  if (ahvData?.retirementAgeOverride != null) {
    overrideTags.push(`Alter ${ahvData.retirementAgeOverride}`);
  }
  if ((ahvData?.missingContributionYears ?? 0) > 0) {
    overrideTags.push(`${ahvData.missingContributionYears}J. fehlend`);
  }
  if (ahvData?.averageIncomeOverride != null) {
    overrideTags.push(`Eink. ${formatCHF(ahvData.averageIncomeOverride)}`);
  }
  if (bvgData?.conversionRateOverride != null) {
    overrideTags.push(`UWS ${bvgData.conversionRateOverride}%`);
  }
  if (bvgData?.interestRateOverride != null) {
    overrideTags.push(`Zins ${bvgData.interestRateOverride}%`);
  }
  if (bvgData?.coordinationDeductionMode === 'none') {
    overrideTags.push('Ohne Koord.-Abzug');
  }
  if (bvgData?.customContributionRates != null) {
    overrideTags.push('Sparbeiträge');
  }

  return (
    <Card variant="interactive" className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{scenario?.name || 'Szenario'}</CardTitle>
            {scenario?.data?.description && (
              <CardDescription className="mt-1">
                {scenario.data.description}
              </CardDescription>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              aria-label="Bearbeiten"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              aria-label="Löschen"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Override Tags */}
        {overrideTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {overrideTags.map((tag, i) => (
              <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Renten-Ergebnis */}
        {(scenarioAhv || scenarioBvg) && (
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            {/* AHV */}
            {scenarioAhv && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">AHV</span>
                </div>
                <span className="font-mono font-semibold text-sm">{formatCHF(scenarioAhv.monthlyPension)}/Mt.</span>
              </div>
            )}
            {/* BVG */}
            {scenarioBvg && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">BVG</span>
                </div>
                <span className="font-mono font-semibold text-sm">{formatCHF(scenarioBvg.monthlyPension)}/Mt.</span>
              </div>
            )}
            {/* Total */}
            {scenarioAhv && scenarioBvg && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs font-medium text-foreground">Total Rente</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-foreground">{formatCHF(totalScenario)}/Mt.</span>
                  {hasOverrides && diffTotal !== 0 && (
                    <span className={`text-xs font-mono font-semibold ${
                      diffTotal > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {diffTotal > 0 ? '+' : ''}{formatCHF(diffTotal)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!hasOverrides && (
          <p className="text-xs text-muted-foreground italic">
            Keine Anpassungen — entspricht der Profil-Basis
          </p>
        )}
      </CardContent>
    </Card>
  );
}

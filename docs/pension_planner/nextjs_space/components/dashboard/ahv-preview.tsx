'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateAhvPension, formatCHF } from '@/lib/engine';
import type { AhvResult, AhvExplanationStep } from '@/lib/engine';
import { ShieldCheck, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface ProfileData {
  birthDate: string | null;
  retirementAge: number | null;
  currentSalaryBrutto: number | null;
}

interface Props {
  profile: ProfileData;
}

export function AhvPreview({ profile }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const result: AhvResult | null = useMemo(() => {
    if (!profile.birthDate || !profile.retirementAge || !profile.currentSalaryBrutto) {
      return null;
    }
    return calculateAhvPension({
      birthDate: profile.birthDate,
      averageAnnualIncome: profile.currentSalaryBrutto,
      retirementAge: profile.retirementAge,
    });
  }, [profile.birthDate, profile.retirementAge, profile.currentSalaryBrutto]);

  if (!result) {
    return (
      <Card className="border-dashed opacity-60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">AHV-Rente (1. Säule)</CardTitle>
          </div>
          <CardDescription>
            Erfassen Sie Ihr Profil, um die AHV-Rentenschätzung zu sehen.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">AHV-Rente (1. Säule)</CardTitle>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-primary">
              {formatCHF(result.monthlyPension)}
              <span className="text-sm font-normal text-muted-foreground">/Mt.</span>
            </p>
          </div>
        </div>
        <CardDescription>
          Geschätzte monatliche AHV-Altersrente bei Pensionierung mit {profile.retirementAge}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Kompakte Kennzahlen */}
        <div className="grid grid-cols-3 gap-3 py-3 border-t">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Jahresrente</p>
            <p className="font-mono font-semibold text-sm">{formatCHF(result.yearlyPension)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Beitragsjahre</p>
            <p className="font-mono font-semibold text-sm">{result.contributionYears}/{result.maxContributionYears}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {result.earlyLateAdjustment < 0 ? 'Vorbezug' : result.earlyLateAdjustment > 0 ? 'Aufschub' : 'Anpassung'}
            </p>
            <p className="font-mono font-semibold text-sm">
              {result.earlyLateAdjustment === 0
                ? 'Keine'
                : `${result.earlyLateAdjustment > 0 ? '+' : ''}${(result.earlyLateAdjustment * 100).toFixed(1)}%`}
            </p>
          </div>
        </div>

        {/* Details Toggle */}
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 w-full justify-center"
        >
          <Info className="w-3.5 h-3.5" />
          Berechnungsdetails
          {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showDetails && (
          <div className="mt-3 space-y-2 pt-3 border-t">
            {result.explanation.map((step: AhvExplanationStep, idx: number) => (
              <div key={idx} className="flex items-start justify-between text-sm">
                <div>
                  <span className="text-muted-foreground">{step.label}</span>
                  {step.detail && (
                    <p className="text-xs text-muted-foreground/70">{step.detail}</p>
                  )}
                </div>
                <span className="font-mono font-medium text-foreground whitespace-nowrap ml-4">
                  {step.value}
                </span>
              </div>
            ))}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground italic">
                Vereinfachte Berechnung. Ohne Erziehungsgutschriften, Splitting oder Aufwertungsfaktor.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

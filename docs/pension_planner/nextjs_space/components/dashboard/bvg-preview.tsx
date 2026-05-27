'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateBvgPension, formatCHF } from '@/lib/engine';
import type { BvgResult, BvgExplanationStep } from '@/lib/engine';
import { Building2, Info, ChevronDown, ChevronUp } from 'lucide-react';

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
  profile: ProfileData;
}

export function BvgPreview({ profile }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const result: BvgResult | null = useMemo(() => {
    if (!profile.birthDate || !profile.retirementAge || !profile.currentSalaryBrutto) {
      return null;
    }
    return calculateBvgPension({
      birthDate: profile.birthDate,
      currentSalaryBrutto: profile.currentSalaryBrutto,
      currentCapital: profile.bvgCurrentCapital ?? 0,
      retirementAge: profile.retirementAge,
      interestRate: profile.bvgInterestRate != null ? profile.bvgInterestRate / 100 : undefined,
      conversionRate: profile.bvgConversionRate != null ? profile.bvgConversionRate / 100 : undefined,
      customContributionRates: profile.bvgContributionRates
        ? Object.fromEntries(Object.entries(profile.bvgContributionRates).map(([k, v]) => [k, (v as number) / 100]))
        : undefined,
    });
  }, [profile]);

  if (!result) {
    return (
      <Card className="border-dashed opacity-60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">BVG-Rente (2. Säule)</CardTitle>
          </div>
          <CardDescription>
            Erfassen Sie Ihr Profil, um die BVG-Rentenschätzung zu sehen.
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
            <Building2 className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">BVG-Rente (2. Säule)</CardTitle>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-primary">
              {formatCHF(result.monthlyPension)}
              <span className="text-sm font-normal text-muted-foreground">/Mt.</span>
            </p>
          </div>
        </div>
        <CardDescription>
          Geschätzte monatliche BVG-Rente bei Pensionierung mit {profile.retirementAge}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-3 py-3 border-t">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Kapital</p>
            <p className="font-mono font-semibold text-sm">{formatCHF(result.projectedCapital)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Umwandlung</p>
            <p className="font-mono font-semibold text-sm">{(result.conversionRate * 100).toFixed(1)}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Jahresrente</p>
            <p className="font-mono font-semibold text-sm">{formatCHF(result.yearlyPension)}</p>
          </div>
        </div>

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
            {result.explanation.map((step: BvgExplanationStep, idx: number) => (
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
                BVG-Obligatorium. Ohne überobligatorische Leistungen. Lohn und Zinssatz konstant angenommen.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

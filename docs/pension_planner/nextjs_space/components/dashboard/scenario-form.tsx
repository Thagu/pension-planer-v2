'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, ArrowLeft, FileText, Loader2, ShieldCheck, Building2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { calculateAhvPension, calculateBvgPension, formatCHF } from '@/lib/engine';
import type { AhvResult, BvgResult } from '@/lib/engine';
import { BVG_MIN_INTEREST_RATE, BVG_CONVERSION_RATE, BVG_CONTRIBUTION_RATES, BVG_CONTRIBUTION_BUCKETS } from '@/lib/engine/constants';
import { useMemo } from 'react';

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
  onSave: (name: string, data: Record<string, any>, scenarioId?: string) => Promise<void>;
  onCancel: () => void;
  initialData?: ScenarioItem;
  profileData: ProfileData;
}

function parseCHFInput(value: string): number {
  const cleaned = (value ?? '').replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function formatNumberInput(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '';
  return value.toLocaleString('de-CH');
}

export function ScenarioForm({ onSave, onCancel, initialData, profileData }: Props) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.data?.description ?? '');

  // AHV Overrides
  const [useRetirementAgeOverride, setUseRetirementAgeOverride] = useState(
    initialData?.data?.ahv?.retirementAgeOverride != null
  );
  const [retirementAgeOverride, setRetirementAgeOverride] = useState<number>(
    initialData?.data?.ahv?.retirementAgeOverride ?? profileData.retirementAge ?? 65
  );

  const [useMissingYears, setUseMissingYears] = useState(
    (initialData?.data?.ahv?.missingContributionYears ?? 0) > 0
  );
  const [missingContributionYears, setMissingContributionYears] = useState<number>(
    initialData?.data?.ahv?.missingContributionYears ?? 0
  );

  const [useIncomeOverride, setUseIncomeOverride] = useState(
    initialData?.data?.ahv?.averageIncomeOverride != null
  );
  const [averageIncomeOverride, setAverageIncomeOverride] = useState<string>(
    formatNumberInput(initialData?.data?.ahv?.averageIncomeOverride)
  );

  // BVG Overrides
  const [useConversionRateOverride, setUseConversionRateOverride] = useState(
    initialData?.data?.bvg?.conversionRateOverride != null
  );
  const [conversionRateOverride, setConversionRateOverride] = useState<number>(
    initialData?.data?.bvg?.conversionRateOverride ?? BVG_CONVERSION_RATE * 100
  );

  const [useInterestRateOverride, setUseInterestRateOverride] = useState(
    initialData?.data?.bvg?.interestRateOverride != null
  );
  const [interestRateOverride, setInterestRateOverride] = useState<number>(
    initialData?.data?.bvg?.interestRateOverride ?? BVG_MIN_INTEREST_RATE * 100
  );

  const [useCoordDeductionOverride, setUseCoordDeductionOverride] = useState(
    initialData?.data?.bvg?.coordinationDeductionMode != null && initialData?.data?.bvg?.coordinationDeductionMode !== 'standard'
  );
  const [coordDeductionMode, setCoordDeductionMode] = useState<'standard' | 'none' | 'custom'>(
    initialData?.data?.bvg?.coordinationDeductionMode ?? 'standard'
  );

  // Sparbeiträge Overrides
  const [useContributionRatesOverride, setUseContributionRatesOverride] = useState(
    initialData?.data?.bvg?.customContributionRates != null
  );
  const [contributionRates, setContributionRates] = useState<Record<string, number>>(() => {
    const saved = initialData?.data?.bvg?.customContributionRates;
    if (saved) return saved;
    // Default-Werte in Prozent
    return Object.fromEntries(
      BVG_CONTRIBUTION_BUCKETS.map(b => [b.key, BVG_CONTRIBUTION_RATES[b.key] * 100])
    );
  });

  // Live AHV-Berechnung
  const ahvResult: AhvResult | null = useMemo(() => {
    if (!profileData.birthDate) return null;

    const effectiveRetirementAge = useRetirementAgeOverride
      ? retirementAgeOverride
      : (profileData.retirementAge ?? 65);

    const effectiveIncome = useIncomeOverride
      ? parseCHFInput(averageIncomeOverride)
      : (profileData.currentSalaryBrutto ?? 0);

    if (effectiveIncome <= 0) return null;

    return calculateAhvPension({
      birthDate: profileData.birthDate,
      averageAnnualIncome: effectiveIncome,
      retirementAge: effectiveRetirementAge,
      missingContributionYears: useMissingYears ? missingContributionYears : 0,
    });
  }, [
    profileData, useRetirementAgeOverride, retirementAgeOverride,
    useIncomeOverride, averageIncomeOverride, useMissingYears, missingContributionYears
  ]);

  // Basis-AHV (Profil-Werte ohne Override)
  const baseAhvResult: AhvResult | null = useMemo(() => {
    if (!profileData.birthDate || !profileData.currentSalaryBrutto) return null;
    return calculateAhvPension({
      birthDate: profileData.birthDate,
      averageAnnualIncome: profileData.currentSalaryBrutto,
      retirementAge: profileData.retirementAge ?? 65,
    });
  }, [profileData]);

  // Effective retirement age for BVG (shared with AHV)
  const effectiveRetirementAge = useRetirementAgeOverride
    ? retirementAgeOverride
    : (profileData.retirementAge ?? 65);

  // Live BVG-Berechnung
  const bvgResult: BvgResult | null = useMemo(() => {
    if (!profileData.birthDate) return null;
    const effectiveIncome = useIncomeOverride
      ? parseCHFInput(averageIncomeOverride)
      : (profileData.currentSalaryBrutto ?? 0);
    if (effectiveIncome <= 0) return null;

    return calculateBvgPension({
      birthDate: profileData.birthDate,
      currentSalaryBrutto: effectiveIncome,
      currentCapital: profileData.bvgCurrentCapital ?? 0,
      retirementAge: effectiveRetirementAge,
      coordinationDeductionMode: useCoordDeductionOverride ? coordDeductionMode : 'standard',
      interestRate: useInterestRateOverride
        ? interestRateOverride / 100
        : (profileData.bvgInterestRate != null ? profileData.bvgInterestRate / 100 : undefined),
      conversionRate: useConversionRateOverride
        ? conversionRateOverride / 100
        : (profileData.bvgConversionRate != null ? profileData.bvgConversionRate / 100 : undefined),
      customContributionRates: useContributionRatesOverride
        ? Object.fromEntries(Object.entries(contributionRates).map(([k, v]) => [k, v / 100]))
        : (profileData.bvgContributionRates
          ? Object.fromEntries(Object.entries(profileData.bvgContributionRates).map(([k, v]) => [k, (v as number) / 100]))
          : undefined),
    });
  }, [
    profileData, effectiveRetirementAge, useIncomeOverride, averageIncomeOverride,
    useConversionRateOverride, conversionRateOverride,
    useInterestRateOverride, interestRateOverride,
    useCoordDeductionOverride, coordDeductionMode,
    useContributionRatesOverride, contributionRates,
  ]);

  // Basis-BVG (mit Profil-Grundlagen)
  const baseBvgResult: BvgResult | null = useMemo(() => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name?.trim()) {
      toast.error('Bitte geben Sie einen Namen für das Szenario ein.');
      return;
    }

    const data: Record<string, any> = {
      description: description.trim(),
      ahv: {
        retirementAgeOverride: useRetirementAgeOverride ? retirementAgeOverride : null,
        missingContributionYears: useMissingYears ? missingContributionYears : 0,
        averageIncomeOverride: useIncomeOverride ? parseCHFInput(averageIncomeOverride) : null,
      },
      bvg: {
        conversionRateOverride: useConversionRateOverride ? conversionRateOverride : null,
        interestRateOverride: useInterestRateOverride ? interestRateOverride : null,
        coordinationDeductionMode: useCoordDeductionOverride ? coordDeductionMode : null,
        customContributionRates: useContributionRatesOverride ? contributionRates : null,
      },
    };

    setSaving(true);
    try {
      await onSave(name.trim(), data, initialData?.id);
    } finally {
      setSaving(false);
    }
  };

  const hasAnyAhvOverride = useRetirementAgeOverride || useMissingYears || useIncomeOverride;
  const hasAnyBvgOverride = useConversionRateOverride || useInterestRateOverride || useCoordDeductionOverride || useContributionRatesOverride;
  const diffMonthlyAhv = ahvResult && baseAhvResult
    ? ahvResult.monthlyPension - baseAhvResult.monthlyPension
    : 0;
  const diffMonthlyBvg = bvgResult && baseBvgResult
    ? bvgResult.monthlyPension - baseBvgResult.monthlyPension
    : 0;

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={onCancel} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Zurück zur Übersicht
      </Button>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Szenario Name & Beschreibung */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">
                {initialData ? 'Szenario bearbeiten' : 'Neues Szenario'}
              </CardTitle>
            </div>
            <CardDescription>
              Szenarien erben Ihre Profildaten und ermöglichen Ihnen, verschiedene Pensionierungsvarianten durchzuspielen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scenario-name">Name des Szenarios</Label>
              <Input
                id="scenario-name"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e?.target?.value ?? '')}
                placeholder="z.B. Frühpensionierung mit 62"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scenario-desc">Beschreibung (optional)</Label>
              <Input
                id="scenario-desc"
                value={description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e?.target?.value ?? '')}
                placeholder="Kurze Beschreibung dieses Szenarios..."
              />
            </div>
          </CardContent>
        </Card>

        {/* AHV-Anpassungen */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">AHV-Anpassungen (1. Säule)</CardTitle>
            </div>
            <CardDescription>
              Passen Sie die AHV-Parameter für dieses Szenario an. Nicht geänderte Werte werden vom Profil übernommen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Override: Pensionsalter */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="use-retirement-override"
                  checked={useRetirementAgeOverride}
                  onChange={(e) => setUseRetirementAgeOverride(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="use-retirement-override" className="cursor-pointer">
                  Anderes Pensionsalter
                </Label>
                {!useRetirementAgeOverride && (
                  <span className="text-xs text-muted-foreground">
                    (Profil: {profileData.retirementAge ?? 65})
                  </span>
                )}
              </div>
              {useRetirementAgeOverride && (
                <div className="ml-7 space-y-2">
                  <Input
                    type="number"
                    value={retirementAgeOverride}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRetirementAgeOverride(parseInt(e?.target?.value ?? '65', 10) || 65)
                    }
                    min={58}
                    max={70}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    AHV-Vorbezug möglich ab 63 (Kürzung 6.8%/Jahr), Aufschub bis 70 (Zuschlag bis 31.5%)
                  </p>
                </div>
              )}
            </div>

            {/* Fehlende Beitragsjahre */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="use-missing-years"
                  checked={useMissingYears}
                  onChange={(e) => setUseMissingYears(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="use-missing-years" className="cursor-pointer">
                  Fehlende Beitragsjahre
                </Label>
              </div>
              {useMissingYears && (
                <div className="ml-7 space-y-2">
                  <Input
                    type="number"
                    value={missingContributionYears}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setMissingContributionYears(Math.max(0, parseInt(e?.target?.value ?? '0', 10) || 0))
                    }
                    min={0}
                    max={20}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Z.B. Wohnsitz im Ausland ohne AHV-Beiträge. Pro fehlendes Jahr wird die Rente um ca. 1/44 gekürzt.
                  </p>
                </div>
              )}
            </div>

            {/* Override: Durchschnittseinkommen */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="use-income-override"
                  checked={useIncomeOverride}
                  onChange={(e) => setUseIncomeOverride(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="use-income-override" className="cursor-pointer">
                  Anderes Durchschnittseinkommen
                </Label>
                {!useIncomeOverride && (
                  <span className="text-xs text-muted-foreground">
                    (Profil: {formatCHF(profileData.currentSalaryBrutto)})
                  </span>
                )}
              </div>
              {useIncomeOverride && (
                <div className="ml-7 space-y-2">
                  <div className="relative w-48">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">CHF</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={averageIncomeOverride}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAverageIncomeOverride(e?.target?.value ?? '')}
                      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                        const val = parseCHFInput(e?.target?.value ?? '');
                        setAverageIncomeOverride(formatNumberInput(val));
                      }}
                      placeholder="80'000"
                      className="pl-12 font-mono"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Geschätztes durchschnittliches Jahreseinkommen über die gesamte Erwerbszeit (z.B. bei Teilzeitarbeit oder Karrierewechsel).
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* BVG-Anpassungen */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">BVG-Anpassungen (2. Säule)</CardTitle>
            </div>
            <CardDescription>
              Passen Sie die BVG-Parameter an. Das Pensionsalter wird vom AHV-Bereich übernommen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Override: Umwandlungssatz */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="use-conversion-override"
                  checked={useConversionRateOverride}
                  onChange={(e) => setUseConversionRateOverride(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="use-conversion-override" className="cursor-pointer">
                  Anderer Umwandlungssatz
                </Label>
                {!useConversionRateOverride && (
                  <span className="text-xs text-muted-foreground">
                    (Standard: {(BVG_CONVERSION_RATE * 100).toFixed(1)}%)
                  </span>
                )}
              </div>
              {useConversionRateOverride && (
                <div className="ml-7 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={conversionRateOverride}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setConversionRateOverride(parseFloat(e?.target?.value ?? '6.8') || 6.8)
                      }
                      min={4}
                      max={8}
                      step={0.1}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    BVG-Minimum: 6.8%. Viele Kassen verwenden tiefere Sätze für den überobligatorischen Teil (z.B. 5.0–6.0%).
                  </p>
                </div>
              )}
            </div>

            {/* Override: Zinssatz */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="use-interest-override"
                  checked={useInterestRateOverride}
                  onChange={(e) => setUseInterestRateOverride(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="use-interest-override" className="cursor-pointer">
                  Anderer Zinssatz
                </Label>
                {!useInterestRateOverride && (
                  <span className="text-xs text-muted-foreground">
                    (Standard: {(BVG_MIN_INTEREST_RATE * 100).toFixed(2)}%)
                  </span>
                )}
              </div>
              {useInterestRateOverride && (
                <div className="ml-7 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={interestRateOverride}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setInterestRateOverride(parseFloat(e?.target?.value ?? '1.25') || 1.25)
                      }
                      min={0}
                      max={5}
                      step={0.25}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    BVG-Mindestzins 2024: 1.25%. Manche Kassen verzinsen höher.
                  </p>
                </div>
              )}
            </div>

            {/* Override: Koordinationsabzug */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="use-coord-override"
                  checked={useCoordDeductionOverride}
                  onChange={(e) => {
                    setUseCoordDeductionOverride(e.target.checked);
                    if (!e.target.checked) setCoordDeductionMode('standard');
                  }}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="use-coord-override" className="cursor-pointer">
                  Koordinationsabzug anpassen
                </Label>
              </div>
              {useCoordDeductionOverride && (
                <div className="ml-7 space-y-2">
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="coord-mode"
                        checked={coordDeductionMode === 'none'}
                        onChange={() => setCoordDeductionMode('none')}
                        className="w-4 h-4 text-primary"
                      />
                      Keiner (voller Lohn versichert)
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Einige Pensionskassen versichern den vollen Lohn ohne Koordinationsabzug.
                  </p>
                </div>
              )}
            </div>

            {/* Override: Sparbeiträge */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="use-contribution-rates-override"
                  checked={useContributionRatesOverride}
                  onChange={(e) => setUseContributionRatesOverride(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="use-contribution-rates-override" className="cursor-pointer">
                  Altersgutschriften anpassen
                </Label>
              </div>
              {useContributionRatesOverride && (
                <div className="ml-7 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {BVG_CONTRIBUTION_BUCKETS.map((bucket) => (
                      <div key={bucket.key} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{bucket.label}</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={contributionRates[bucket.key] ?? (BVG_CONTRIBUTION_RATES[bucket.key] * 100)}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const val = parseFloat(e?.target?.value ?? '0') || 0;
                              setContributionRates(prev => ({ ...prev, [bucket.key]: val }));
                            }}
                            min={0}
                            max={25}
                            step={0.5}
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    BVG-Minimum: 7% / 10% / 15% / 18%. Überobligatorische Kassen können höhere Sätze anbieten.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live Vorschau: AHV + BVG */}
        {(ahvResult || bvgResult) && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Rentenvorschau in diesem Szenario</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {/* AHV */}
              {ahvResult && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">AHV (1. Säule)</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <p className="text-xl font-bold font-mono text-foreground">
                      {formatCHF(ahvResult.monthlyPension)}
                      <span className="text-xs font-normal text-muted-foreground">/Mt.</span>
                    </p>
                    {hasAnyAhvOverride && diffMonthlyAhv !== 0 && (
                      <span className={`text-sm font-mono font-semibold ${
                        diffMonthlyAhv > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {diffMonthlyAhv > 0 ? '+' : ''}{formatCHF(diffMonthlyAhv)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* BVG */}
              {bvgResult && (
                <div className="pt-3 border-t border-primary/10">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">BVG (2. Säule)</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xl font-bold font-mono text-foreground">
                        {formatCHF(bvgResult.monthlyPension)}
                        <span className="text-xs font-normal text-muted-foreground">/Mt.</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Kapital: {formatCHF(bvgResult.projectedCapital)} · UWS: {(bvgResult.conversionRate * 100).toFixed(1)}%
                      </p>
                    </div>
                    {hasAnyBvgOverride && diffMonthlyBvg !== 0 && (
                      <span className={`text-sm font-mono font-semibold ${
                        diffMonthlyBvg > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {diffMonthlyBvg > 0 ? '+' : ''}{formatCHF(diffMonthlyBvg)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Total */}
              {ahvResult && bvgResult && (
                <div className="pt-3 border-t border-primary/20">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Total Rente (1. + 2. Säule)</p>
                      <p className="text-2xl font-bold font-mono text-primary">
                        {formatCHF(ahvResult.monthlyPension + bvgResult.monthlyPension)}
                        <span className="text-sm font-normal text-muted-foreground">/Mt.</span>
                      </p>
                    </div>
                    {(hasAnyAhvOverride || hasAnyBvgOverride) && (diffMonthlyAhv + diffMonthlyBvg) !== 0 && (
                      <span className={`text-sm font-mono font-semibold ${
                        (diffMonthlyAhv + diffMonthlyBvg) > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(diffMonthlyAhv + diffMonthlyBvg) > 0 ? '+' : ''}{formatCHF(diffMonthlyAhv + diffMonthlyBvg)}
                      </span>
                    )}
                  </div>
                  {baseAhvResult && baseBvgResult && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      Basis (Profil): {formatCHF(baseAhvResult.monthlyPension + baseBvgResult.monthlyPension)}/Mt.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            {initialData ? 'Szenario aktualisieren' : 'Szenario speichern'}
          </Button>
        </div>
      </form>
    </div>
  );
}

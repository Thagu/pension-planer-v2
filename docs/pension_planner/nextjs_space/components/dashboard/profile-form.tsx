'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, CalendarDays, Briefcase, Landmark, PiggyBank, Wallet, CheckCircle2, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { BVG_MIN_INTEREST_RATE, BVG_CONVERSION_RATE, BVG_CONTRIBUTION_RATES, BVG_CONTRIBUTION_BUCKETS } from '@/lib/engine/constants';

interface ProfileData {
  birthDate: string | null;
  gender: string | null;
  retirementAge: number | null;
  currentSalaryBrutto: number | null;
  bvgCurrentCapital: number | null;
  pillar3aCurrentCapital: number | null;
  freeAssets: number | null;
  bvgInterestRate: number | null;
  bvgConversionRate: number | null;
  bvgContributionRates: Record<string, number> | null;
  pillar3aInterestRate: number | null;
  freeAssetsInterestRate: number | null;
}

interface Props {
  onProfileSaved?: (profile: ProfileData) => void;
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

export function ProfileForm({ onProfileSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [birthDate, setBirthDate] = useState('');
  const [retirementAge, setRetirementAge] = useState(65);
  const [salary, setSalary] = useState('');
  const [bvg, setBvg] = useState('');
  const [bvgInterestRate, setBvgInterestRate] = useState<string>('');
  const [bvgConversionRate, setBvgConversionRate] = useState<string>('');
  const [bvgContributionRates, setBvgContributionRates] = useState<Record<string, number> | null>(null);
  const [pillar3a, setPillar3a] = useState('');
  const [pillar3aInterestRate, setPillar3aInterestRate] = useState<string>('');
  const [freeAssets, setFreeAssets] = useState('');
  const [freeAssetsInterestRate, setFreeAssetsInterestRate] = useState<string>('');

  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setBirthDate(data.birthDate ?? '');
          setRetirementAge(data.retirementAge ?? 65);
          setSalary(formatNumberInput(data.currentSalaryBrutto));
          setBvg(formatNumberInput(data.bvgCurrentCapital));
          if (data.bvgInterestRate != null) setBvgInterestRate(String(data.bvgInterestRate));
          if (data.bvgConversionRate != null) setBvgConversionRate(String(data.bvgConversionRate));
          if (data.bvgContributionRates) setBvgContributionRates(data.bvgContributionRates);
          setPillar3a(formatNumberInput(data.pillar3aCurrentCapital));
          if (data.pillar3aInterestRate != null) setPillar3aInterestRate(String(data.pillar3aInterestRate));
          setFreeAssets(formatNumberInput(data.freeAssets));
          if (data.freeAssetsInterestRate != null) setFreeAssetsInterestRate(String(data.freeAssetsInterestRate));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCHFChange = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e?.target?.value ?? '');
  };

  const handleCHFBlur = (setter: (val: string) => void) => (e: React.FocusEvent<HTMLInputElement>) => {
    const value = parseCHFInput(e?.target?.value ?? '');
    setter(formatNumberInput(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);

    if (!birthDate) {
      toast.error('Bitte geben Sie Ihr Geburtsdatum ein.');
      return;
    }
    if (!retirementAge || retirementAge < 55 || retirementAge > 70) {
      toast.error('Bitte geben Sie ein gültiges Pensionsalter ein (55-70).');
      return;
    }

    const profileData: ProfileData = {
      birthDate,
      gender: null,
      retirementAge,
      currentSalaryBrutto: parseCHFInput(salary),
      bvgCurrentCapital: parseCHFInput(bvg),
      bvgInterestRate: bvgInterestRate ? parseFloat(bvgInterestRate) : null,
      bvgConversionRate: bvgConversionRate ? parseFloat(bvgConversionRate) : null,
      bvgContributionRates: bvgContributionRates,
      pillar3aCurrentCapital: parseCHFInput(pillar3a),
      pillar3aInterestRate: pillar3aInterestRate ? parseFloat(pillar3aInterestRate) : null,
      freeAssets: parseCHFInput(freeAssets),
      freeAssetsInterestRate: freeAssetsInterestRate ? parseFloat(freeAssetsInterestRate) : null,
    };

    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      if (res.ok) {
        toast.success('Profil gespeichert.');
        setSaved(true);
        onProfileSaved?.(profileData);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || 'Speichern fehlgeschlagen.');
      }
    } catch {
      toast.error('Ein Fehler ist aufgetreten.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Persönliche Daten */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Persönliche Daten</CardTitle>
          </div>
          <CardDescription>Grundlegende Informationen für die Berechnung.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="birth-date">Geburtsdatum</Label>
            <Input
              id="birth-date"
              type="date"
              value={birthDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBirthDate(e?.target?.value ?? '')}
              max="2005-01-01"
              min="1950-01-01"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="retirement-age">Geplantes Pensionsalter</Label>
            <Input
              id="retirement-age"
              type="number"
              value={retirementAge}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRetirementAge(parseInt(e?.target?.value ?? '65', 10) || 65)}
              min={55}
              max={70}
              required
            />
            <p className="text-xs text-muted-foreground">Ordentlich: 65 (AHV-Referenzalter)</p>
          </div>
        </CardContent>
      </Card>

      {/* Aktuelles Einkommen */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Aktuelles Einkommen</CardTitle>
          </div>
          <CardDescription>Ihr aktuelles Bruttoeinkommen pro Jahr.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="salary">Bruttolohn pro Jahr (CHF)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">CHF</span>
              <Input
                id="salary"
                type="text"
                inputMode="numeric"
                value={salary}
                onChange={handleCHFChange(setSalary)}
                onBlur={handleCHFBlur(setSalary)}
                placeholder="100'000"
                className="pl-12 font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bestehende Vorsorge */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Bestehende Vorsorge</CardTitle>
          </div>
          <CardDescription>Ihre aktuellen Vorsorgeguthaben und Grundlagen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* BVG (2. Säule) */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <PiggyBank className="w-4 h-4 text-primary" />
              2. Säule (BVG)
            </h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bvg">Aktuelles Guthaben</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">CHF</span>
                  <Input
                    id="bvg"
                    type="text"
                    inputMode="numeric"
                    value={bvg}
                    onChange={handleCHFChange(setBvg)}
                    onBlur={handleCHFBlur(setBvg)}
                    placeholder="200'000"
                    className="pl-12 font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bvg-interest">Zinssatz</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="bvg-interest"
                    type="number"
                    value={bvgInterestRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBvgInterestRate(e?.target?.value ?? '')}
                    placeholder={String(BVG_MIN_INTEREST_RATE * 100)}
                    min={0}
                    max={10}
                    step={0.25}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">Leer = BVG-Minimum ({(BVG_MIN_INTEREST_RATE * 100).toFixed(2)}%)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bvg-conversion">Umwandlungssatz</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="bvg-conversion"
                    type="number"
                    value={bvgConversionRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBvgConversionRate(e?.target?.value ?? '')}
                    placeholder={String(BVG_CONVERSION_RATE * 100)}
                    min={3}
                    max={8}
                    step={0.1}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">Leer = BVG-Minimum ({(BVG_CONVERSION_RATE * 100).toFixed(1)}%)</p>
              </div>
            </div>

            {/* BVG Altersgutschriften */}
            <div className="space-y-3 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5" />
                  Altersgutschriften (Sparbeiträge)
                </Label>
                {bvgContributionRates && (
                  <button
                    type="button"
                    onClick={() => setBvgContributionRates(null)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Auf Standard zurücksetzen
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {BVG_CONTRIBUTION_BUCKETS.map((bucket) => (
                  <div key={bucket.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{bucket.label}</Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        value={bvgContributionRates?.[bucket.key] ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const val = e?.target?.value;
                          if (val === '' || val == null) {
                            // Leeren -> Bucket entfernen
                            const next = { ...(bvgContributionRates ?? {}) };
                            delete next[bucket.key];
                            setBvgContributionRates(Object.keys(next).length > 0 ? next : null);
                          } else {
                            setBvgContributionRates(prev => ({
                              ...(prev ?? {}),
                              [bucket.key]: parseFloat(val) || 0,
                            }));
                          }
                        }}
                        placeholder={String(BVG_CONTRIBUTION_RATES[bucket.key] * 100)}
                        min={0}
                        max={25}
                        step={0.5}
                        className="w-16"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leer = BVG-Minimum (7% / 10% / 15% / 18%). Tragen Sie hier die Sätze Ihrer Pensionskasse ein.
              </p>
            </div>
          </div>

          {/* Säule 3a */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <PiggyBank className="w-4 h-4 text-primary" />
              Säule 3a
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pillar3a">Aktuelles Guthaben</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">CHF</span>
                  <Input
                    id="pillar3a"
                    type="text"
                    inputMode="numeric"
                    value={pillar3a}
                    onChange={handleCHFChange(setPillar3a)}
                    onBlur={handleCHFBlur(setPillar3a)}
                    placeholder="50'000"
                    className="pl-12 font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pillar3a-interest">Jährlicher Zinssatz</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="pillar3a-interest"
                    type="number"
                    value={pillar3aInterestRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPillar3aInterestRate(e?.target?.value ?? '')}
                    placeholder="1.0"
                    min={0}
                    max={10}
                    step={0.25}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">Erwartete jährliche Rendite auf dem 3a-Guthaben.</p>
              </div>
            </div>
          </div>

          {/* Freies Vermögen */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-primary" />
              Freies Vermögen
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="free-assets">Aktuelles Vermögen</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">CHF</span>
                  <Input
                    id="free-assets"
                    type="text"
                    inputMode="numeric"
                    value={freeAssets}
                    onChange={handleCHFChange(setFreeAssets)}
                    onBlur={handleCHFBlur(setFreeAssets)}
                    placeholder="30'000"
                    className="pl-12 font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="free-assets-interest">Jährlicher Zinssatz</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="free-assets-interest"
                    type="number"
                    value={freeAssetsInterestRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFreeAssetsInterestRate(e?.target?.value ?? '')}
                    placeholder="2.0"
                    min={0}
                    max={15}
                    step={0.25}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">Erwartete Rendite. Dieses Vermögen kann ab Pensionierung als Einkommen bezogen werden.</p>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex gap-3 justify-end items-center">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            Gespeichert
          </span>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          Profil speichern
        </Button>
      </div>
    </form>
  );
}

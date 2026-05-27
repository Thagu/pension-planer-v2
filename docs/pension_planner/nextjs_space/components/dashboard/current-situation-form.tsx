'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, ArrowLeft, CalendarDays, Briefcase, Landmark, PiggyBank, Wallet, User } from 'lucide-react';
import type { CurrentSituation } from '@/lib/engine/types';
import { toast } from 'sonner';

interface ScenarioItem {
  id: string;
  name: string;
  data: CurrentSituation;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  onSave: (name: string, data: CurrentSituation, scenarioId?: string) => Promise<void>;
  onCancel: () => void;
  initialData?: ScenarioItem;
}

function parseCHFInput(value: string): number {
  // Remove thousands separators and other non-numeric chars except digits and period
  const cleaned = (value ?? '').replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function formatNumberInput(value: number): string {
  if (!value && value !== 0) return '';
  if (value === 0) return '';
  return value.toLocaleString('de-CH');
}

export function CurrentSituationForm({ onSave, onCancel, initialData }: Props) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialData?.name ?? 'Mein Szenario');
  const [birthDate, setBirthDate] = useState(initialData?.data?.birthDate ?? '');
  const [retirementAge, setRetirementAge] = useState(initialData?.data?.retirementAge ?? 65);
  const [salary, setSalary] = useState(formatNumberInput(initialData?.data?.currentSalaryBrutto ?? 0));
  const [bvg, setBvg] = useState(formatNumberInput(initialData?.data?.bvgCurrentCapital ?? 0));
  const [pillar3a, setPillar3a] = useState(formatNumberInput(initialData?.data?.pillar3aCurrentCapital ?? 0));
  const [freeAssets, setFreeAssets] = useState(formatNumberInput(initialData?.data?.freeAssets ?? 0));

  const handleCHFChange = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e?.target?.value ?? '';
    // Allow typing freely
    setter(raw);
  };

  const handleCHFBlur = (setter: (val: string) => void) => (e: React.FocusEvent<HTMLInputElement>) => {
    const value = parseCHFInput(e?.target?.value ?? '');
    setter(formatNumberInput(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name?.trim()) {
      toast.error('Bitte geben Sie einen Namen für das Szenario ein.');
      return;
    }
    if (!birthDate) {
      toast.error('Bitte geben Sie Ihr Geburtsdatum ein.');
      return;
    }
    if (!retirementAge || retirementAge < 55 || retirementAge > 70) {
      toast.error('Bitte geben Sie ein gültiges Pensionsalter ein (55-70).');
      return;
    }
    const salaryValue = parseCHFInput(salary);
    if (salaryValue <= 0) {
      toast.error('Bitte geben Sie einen gültigen Bruttolohn ein.');
      return;
    }

    const data: CurrentSituation = {
      birthDate,
      retirementAge,
      currentSalaryBrutto: salaryValue,
      bvgCurrentCapital: parseCHFInput(bvg),
      pillar3aCurrentCapital: parseCHFInput(pillar3a),
      freeAssets: parseCHFInput(freeAssets),
    };

    setSaving(true);
    try {
      await onSave(name.trim(), data, initialData?.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={onCancel} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Zurück zur Übersicht
      </Button>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Scenario Name */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Szenario</CardTitle>
            </div>
            <CardDescription>Geben Sie Ihrem Szenario einen Namen.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="scenario-name">Name</Label>
              <Input
                id="scenario-name"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e?.target?.value ?? '')}
                placeholder="z.B. Frühpensionierung mit 62"
                required
              />
            </div>
          </CardContent>
        </Card>

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
                  required
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
            <CardDescription>Ihre aktuellen Vorsorgeguthaben.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bvg" className="flex items-center gap-1.5">
                <PiggyBank className="w-3.5 h-3.5" />
                2. Säule (BVG) Guthaben
              </Label>
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
              <Label htmlFor="pillar3a" className="flex items-center gap-1.5">
                <PiggyBank className="w-3.5 h-3.5" />
                Säule 3a Guthaben
              </Label>
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
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="free-assets" className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" />
                Freies Vermögen
              </Label>
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
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button type="submit" loading={saving}>
            <Save className="w-4 h-4 mr-1" />
            {initialData ? 'Szenario aktualisieren' : 'Szenario speichern'}
          </Button>
        </div>
      </form>
    </div>
  );
}

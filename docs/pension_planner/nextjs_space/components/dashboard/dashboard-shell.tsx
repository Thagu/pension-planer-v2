'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, LogOut, Plus, FileText, Trash2, Pencil, User, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { ProfileForm } from './profile-form';
import { ScenarioForm } from './scenario-form';
import { AhvPreview } from './ahv-preview';
import { BvgPreview } from './bvg-preview';
import { ScenarioCard } from './scenario-card';
import { toast } from 'sonner';
import { formatCHF, calculateAhvPension } from '@/lib/engine';
import type { AhvResult } from '@/lib/engine';
import { motion, AnimatePresence } from 'framer-motion';

interface ScenarioItem {
  id: string;
  name: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export function DashboardShell() {
  const { data: session, status } = useSession() || {};
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [showScenarioForm, setShowScenarioForm] = useState(false);
  const [editingScenario, setEditingScenario] = useState<ScenarioItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileExpanded, setProfileExpanded] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);
  const [profileData, setProfileData] = useState<{
    birthDate: string | null;
    retirementAge: number | null;
    currentSalaryBrutto: number | null;
    bvgCurrentCapital: number | null;
    bvgInterestRate: number | null;
    bvgConversionRate: number | null;
    bvgContributionRates: Record<string, number> | null;
    pillar3aInterestRate: number | null;
    freeAssets: number | null;
    freeAssetsInterestRate: number | null;
  } | null>(null);

  const fetchScenarios = useCallback(async () => {
    try {
      const res = await fetch('/api/scenarios');
      if (res.ok) {
        const data = await res.json().catch(() => []);
        setScenarios(data ?? []);
      }
    } catch (err: any) {
      console.error('Error fetching scenarios:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if profile is already filled
  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/profile')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.birthDate) {
            setProfileComplete(true);
            setProfileExpanded(false);
            setProfileData({
              birthDate: data.birthDate,
              retirementAge: data.retirementAge,
              currentSalaryBrutto: data.currentSalaryBrutto,
              bvgCurrentCapital: data.bvgCurrentCapital,
              bvgInterestRate: data.bvgInterestRate ?? null,
              bvgConversionRate: data.bvgConversionRate ?? null,
              bvgContributionRates: data.bvgContributionRates ?? null,
              pillar3aInterestRate: data.pillar3aInterestRate ?? null,
              freeAssets: data.freeAssets ?? null,
              freeAssetsInterestRate: data.freeAssetsInterestRate ?? null,
            });
          }
        })
        .catch(() => {});
      fetchScenarios();
    }
  }, [status, fetchScenarios]);

  const handleProfileSaved = (profile: any) => {
    setProfileComplete(true);
    setProfileExpanded(false);
    setProfileData({
      birthDate: profile.birthDate,
      retirementAge: profile.retirementAge,
      currentSalaryBrutto: profile.currentSalaryBrutto,
      bvgCurrentCapital: profile.bvgCurrentCapital ?? null,
      bvgInterestRate: profile.bvgInterestRate ?? null,
      bvgConversionRate: profile.bvgConversionRate ?? null,
      bvgContributionRates: profile.bvgContributionRates ?? null,
      pillar3aInterestRate: profile.pillar3aInterestRate ?? null,
      freeAssets: profile.freeAssets ?? null,
      freeAssetsInterestRate: profile.freeAssetsInterestRate ?? null,
    });
  };

  const handleSaveScenario = async (name: string, data: Record<string, any>, scenarioId?: string) => {
    try {
      const url = scenarioId ? `/api/scenarios/${scenarioId}` : '/api/scenarios';
      const method = scenarioId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data }),
      });
      if (res.ok) {
        toast.success(scenarioId ? 'Szenario aktualisiert.' : 'Szenario gespeichert.');
        setShowScenarioForm(false);
        setEditingScenario(null);
        fetchScenarios();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || 'Speichern fehlgeschlagen.');
      }
    } catch {
      toast.error('Ein Fehler ist aufgetreten.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie dieses Szenario wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/scenarios/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Szenario gelöscht.');
        fetchScenarios();
      } else {
        toast.error('Löschen fehlgeschlagen.');
      }
    } catch {
      toast.error('Ein Fehler ist aufgetreten.');
    }
  };

  const userName = (session?.user as any)?.name || (session?.user as any)?.email?.split?.('@')?.[0] || 'Nutzer';

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight hidden sm:block">Pensionsplaner</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">Hallo, {userName}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="w-4 h-4 mr-1" />
              Abmelden
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Section 1: Mein Profil */}
        <section>
          <div
            className="flex items-center justify-between cursor-pointer mb-4"
            onClick={() => setProfileExpanded(!profileExpanded)}
          >
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-primary" />
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Mein Profil
              </h2>
              {profileComplete && !profileExpanded && (
                <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                  Erfasst
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm">
              {profileExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
          {!profileExpanded && !profileComplete && (
            <Card className="border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/10">
              <CardContent className="py-4">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Bitte erfassen Sie zuerst Ihre persönliche Situation, bevor Sie Szenarien erstellen.
                </p>
              </CardContent>
            </Card>
          )}
          <AnimatePresence>
            {profileExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                <ProfileForm onProfileSaved={handleProfileSaved} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* AHV Vorschau */}
        {profileComplete && profileData && (
          <section>
            <div className="mb-4">
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Rentenvorschau
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Basierend auf Ihren Profildaten — weitere Module folgen.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <AhvPreview profile={profileData} />
              <BvgPreview profile={profileData} />
            </div>
          </section>
        )}

        {/* Divider */}
        <div className="border-t" />

        {/* Section 2: Szenarien */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Szenarien
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Erstellen Sie verschiedene Was-wäre-wenn-Szenarien für Ihre Pensionierung.
              </p>
            </div>
            {profileComplete && !showScenarioForm && !editingScenario && (
              <Button onClick={() => setShowScenarioForm(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Neues Szenario
              </Button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {showScenarioForm || editingScenario ? (
              <motion.div
                key="scenario-form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
              >
                <ScenarioForm
                  onSave={handleSaveScenario}
                  onCancel={() => { setShowScenarioForm(false); setEditingScenario(null); }}
                  initialData={editingScenario ?? undefined}
                  profileData={profileData!}
                />
              </motion.div>
            ) : !profileComplete ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <User className="w-10 h-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    Erfassen Sie zuerst Ihr Profil oben, um Szenarien erstellen zu können.
                  </p>
                </CardContent>
              </Card>
            ) : loading ? (
              <div className="text-center py-16 text-muted-foreground">Lade Szenarien...</div>
            ) : (scenarios?.length ?? 0) === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-1">Noch keine Szenarien</h3>
                  <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                    Erstellen Sie Ihr erstes Szenario, um verschiedene Pensionierungsvarianten zu vergleichen.
                  </p>
                  <Button onClick={() => setShowScenarioForm(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Erstes Szenario erstellen
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {(scenarios ?? []).map((scenario: ScenarioItem, idx: number) => (
                  <motion.div
                    key={scenario?.id ?? idx}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                  >
                    <ScenarioCard
                      scenario={scenario}
                      profileData={profileData!}
                      onEdit={() => setEditingScenario(scenario)}
                      onDelete={() => handleDelete(scenario?.id)}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          Pensionsplaner Schweiz · Alle Angaben in CHF · Keine Anlageberatung
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";

import { ScenarioSavedBanner } from "@/components/feedback/query-banner";
import { PageFallback } from "@/components/feedback/page-fallback";
import { ScenariosContent } from "./content";

export default function ScenariosPage() {
  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Pension Planner</p>
            <h1 className="text-3xl font-semibold tracking-tight">Szenarien</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Simulieren Sie verschiedene Pensionierungsvarianten mit modularer
              Berechnung von AHV, BVG und freiem Vermögen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
            >
              Home
            </Link>
            <Link
              href="/master-data"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
            >
              Stammdaten
            </Link>
            <Link
              href="/scenarios/new"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              <Plus className="mr-1 h-4 w-4" />
              Neues Szenario
            </Link>
          </div>
        </div>

        <Suspense fallback={null}>
          <ScenarioSavedBanner />
        </Suspense>

        <Suspense fallback={<PageFallback />}>
          <ScenariosContent />
        </Suspense>
      </div>
    </main>
  );
}

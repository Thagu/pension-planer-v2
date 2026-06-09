import Link from "next/link";
import { Suspense } from "react";

import { MasterDataSaveBanner } from "@/components/feedback/query-banner";
import { PageFallback } from "@/components/feedback/page-fallback";
import { MasterDataContent } from "./content";

export default function MasterDataPage() {
  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Pension Planner</p>
            <h1 className="text-3xl font-semibold tracking-tight">Stammdaten</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Pflege deine persönlichen Basisdaten und Vermögenswerte. Beträge ab 1&apos;000
              werden mit Apostroph formatiert; Sätze werden in Prozent eingegeben.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/scenarios"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
            >
              Szenarien
            </Link>
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
            >
              Startseite
            </Link>
          </div>
        </div>

        <Suspense fallback={null}>
          <MasterDataSaveBanner />
        </Suspense>

        <Suspense fallback={<PageFallback />}>
          <MasterDataContent />
        </Suspense>
      </div>
    </main>
  );
}

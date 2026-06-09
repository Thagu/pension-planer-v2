import Link from "next/link";
import { Suspense } from "react";

import { NewScenarioErrorBanner } from "@/components/feedback/query-banner";
import { PageFallback } from "@/components/feedback/page-fallback";
import { NewScenarioContent } from "./content";

export default function NewScenarioPage() {
  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Neues Szenario</p>
          <h1 className="text-3xl font-semibold tracking-tight">Szenario erfassen</h1>
        </div>

        <Suspense fallback={null}>
          <NewScenarioErrorBanner />
        </Suspense>

        <Suspense fallback={<PageFallback />}>
          <NewScenarioContent />
        </Suspense>
      </div>
    </main>
  );
}

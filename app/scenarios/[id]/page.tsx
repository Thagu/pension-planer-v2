import { Suspense } from "react";

import { ScenarioDetailStatusBanner } from "@/components/feedback/query-banner";
import { PageFallback } from "@/components/feedback/page-fallback";
import { ScenarioDetailContent } from "./content";

export default function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">
        <Suspense fallback={null}>
          <ScenarioDetailStatusBanner />
        </Suspense>

        <Suspense fallback={<PageFallback />}>
          <ScenarioDetailContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

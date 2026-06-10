import { Suspense } from "react";

import { PAGE_SHELL_WIDE } from "@/components/layout/page-shell";
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
      <div className={PAGE_SHELL_WIDE}>
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

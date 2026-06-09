import Link from "next/link";
import { Suspense } from "react";

import { PageFallback } from "@/components/feedback/page-fallback";
import { HomeContent } from "./home-content";

export default function Home() {
  return (
    <main className="min-h-screen bg-muted/30">
      <Suspense fallback={<PageFallback />}>
        <HomeContent />
      </Suspense>
    </main>
  );
}

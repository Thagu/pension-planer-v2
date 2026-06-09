"use client";

import type { ReactNode } from "react";

type StickyPreviewLayoutProps = {
  children: ReactNode;
  preview: ReactNode;
  previewLabel?: string;
};

/**
 * Responsive live-preview layout:
 * - below xl: preview on top (full width), not sticky — scrolls away with page
 * - xl and up: form left (~58%), preview right (~42%), preview sticky with opaque bg
 */
export function StickyPreviewLayout({
  children,
  preview,
  previewLabel = "Live-Vorschau",
}: StickyPreviewLayoutProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,42%)] xl:items-start">
      <aside
        className="min-w-0 xl:sticky xl:top-4 xl:z-10 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:rounded-xl xl:bg-muted/30 xl:shadow-sm xl:ring-1 xl:ring-border/50"
        aria-label={previewLabel}
      >
        {preview}
      </aside>
      <div className="grid min-w-0 gap-6 xl:col-start-1 xl:row-start-1">
        {children}
      </div>
    </div>
  );
}

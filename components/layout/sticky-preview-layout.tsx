"use client";

import type { ReactNode } from "react";

type StickyPreviewLayoutProps = {
  children: ReactNode;
  preview: ReactNode;
  previewLabel?: string;
};

/**
 * Desktop-first live-preview layout:
 * - below lg: preview on top, form below
 * - lg and up: form left (~52%), preview right (~48%), preview sticky
 */
export function StickyPreviewLayout({
  children,
  preview,
  previewLabel = "Live-Vorschau",
}: StickyPreviewLayoutProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(440px,48%)] lg:items-start">
      <aside
        className="min-w-0 lg:sticky lg:top-4 lg:z-10 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:rounded-xl lg:bg-muted/30 lg:shadow-sm lg:ring-1 lg:ring-border/50"
        aria-label={previewLabel}
      >
        {preview}
      </aside>
      <div className="grid min-w-0 gap-6 lg:col-start-1 lg:row-start-1">
        {children}
      </div>
    </div>
  );
}

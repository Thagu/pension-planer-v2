"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PreviewChartProvider } from "@/components/charts/preview-chart-context";
import { cn } from "@/lib/utils";

type StickyPreviewLayoutProps = {
  children: ReactNode;
  preview: ReactNode;
  previewLabel?: string;
};

/**
 * Desktop-first live-preview layout:
 * - below lg: preview on top, form below
 * - lg and up: form left (~52%), preview right (~48%), preview sticky
 * - maximize toggle enlarges the preview chart to nearly full viewport
 */
export function StickyPreviewLayout({
  children,
  preview,
  previewLabel = "Live-Vorschau",
}: StickyPreviewLayoutProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!maximized) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMaximized(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [maximized]);

  useEffect(() => {
    if (!maximized) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [maximized]);

  return (
    <div
      className={cn(
        "grid gap-8",
        !maximized &&
          "lg:grid-cols-[minmax(0,1fr)_minmax(440px,48%)] lg:items-start",
      )}
    >
      <aside
        className={cn(
          "min-w-0",
          maximized
            ? "fixed inset-0 z-50 flex flex-col bg-background p-4 shadow-2xl sm:p-6"
            : "relative lg:sticky lg:top-4 lg:z-10 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:rounded-xl lg:bg-muted/30 lg:shadow-sm lg:ring-1 lg:ring-border/50",
        )}
        aria-label={previewLabel}
        aria-expanded={maximized}
      >
        {maximized ? (
          <div className="mb-4 flex shrink-0 items-center justify-between gap-3 border-b pb-3">
            <p className="text-sm font-semibold text-foreground">{previewLabel}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMaximized(false)}
            >
              <Minimize2 aria-hidden />
              Verkleinern
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-12 top-3 z-20 h-8 w-8 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
            onClick={() => setMaximized(true)}
            aria-label="Grafik maximieren"
            title="Grafik maximieren"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        )}

        <div
          className={cn(
            "min-w-0",
            maximized
              ? "min-h-0 flex-1 overflow-y-auto [&_svg]:min-h-[min(65vh,560px)]"
              : "relative",
          )}
        >
          <PreviewChartProvider expanded={maximized}>{preview}</PreviewChartProvider>
        </div>
      </aside>

      <div
        className={cn(
          "grid min-w-0 gap-6 lg:col-start-1 lg:row-start-1",
          maximized && "hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}

"use client";

import { createContext, useContext, type ReactNode } from "react";

const PreviewChartContext = createContext(false);

export function PreviewChartProvider({
  expanded,
  children,
}: {
  expanded: boolean;
  children: ReactNode;
}) {
  return (
    <PreviewChartContext.Provider value={expanded}>
      {children}
    </PreviewChartContext.Provider>
  );
}

export function usePreviewChartExpanded(): boolean {
  return useContext(PreviewChartContext);
}

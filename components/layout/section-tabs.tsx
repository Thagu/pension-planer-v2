"use client";

import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type SectionTab = {
  value: string;
  label: string;
  description?: ReactNode;
  content: ReactNode;
  hidden?: boolean;
};

type SectionTabsProps = {
  tabs: SectionTab[];
  defaultValue?: string;
  className?: string;
};

/**
 * Horizontal tab navigation for multi-section forms.
 * Inactive panels stay mounted (forceMount) so form fields remain in the DOM.
 */
export function SectionTabs({ tabs, defaultValue, className }: SectionTabsProps) {
  const visible = tabs.filter((tab) => !tab.hidden);
  const initial = defaultValue ?? visible[0]?.value ?? "tab-0";

  if (visible.length === 0) return null;

  return (
    <Tabs defaultValue={initial} className={cn("w-full", className)}>
      <TabsList className="w-full justify-start">
        {visible.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {visible.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} forceMount>
          <Card>
            {tab.description ? (
              <CardHeader className="pb-4">
                <CardTitle className="text-base">{tab.label}</CardTitle>
                <CardDescription>{tab.description}</CardDescription>
              </CardHeader>
            ) : null}
            <CardContent className={tab.description ? undefined : "pt-6"}>
              {tab.content}
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}

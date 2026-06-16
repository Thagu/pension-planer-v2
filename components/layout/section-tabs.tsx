"use client";

import { useState, type ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
};

/**
 * Horizontal tab navigation for multi-section forms.
 * All panels stay mounted; inactive panels are hidden via CSS only (not the HTML
 * `hidden` attribute) so every control remains part of form submission.
 */
export function SectionTabs({
  tabs,
  defaultValue,
  value,
  onValueChange,
  className,
}: SectionTabsProps) {
  const visible = tabs.filter((tab) => !tab.hidden);
  const initial = defaultValue ?? visible[0]?.value ?? "tab-0";
  const isControlled = value !== undefined;
  const [internalTab, setInternalTab] = useState(initial);

  if (visible.length === 0) return null;

  const activeValue =
    isControlled && visible.some((tab) => tab.value === value)
      ? value!
      : isControlled
        ? initial
        : internalTab;

  const handleValueChange = (next: string) => {
    if (!isControlled) {
      setInternalTab(next);
    }
    onValueChange?.(next);
  };

  return (
    <Tabs
      value={activeValue}
      onValueChange={handleValueChange}
      className={cn("w-full", className)}
    >
      <TabsList className="w-full justify-start">
        {visible.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} id={`section-tab-${tab.value}`}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {visible.map((tab) => (
        <div
          key={tab.value}
          role="tabpanel"
          aria-labelledby={`section-tab-${tab.value}`}
          id={`section-tabpanel-${tab.value}`}
          className={cn("mt-4", activeValue !== tab.value && "hidden")}
        >
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
        </div>
      ))}
    </Tabs>
  );
}

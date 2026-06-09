"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ModuleExplanation({
  title,
  steps,
}: {
  title: string;
  steps: { label: string; value: string; detail?: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (!steps.length) return null;

  return (
    <div className="rounded-lg border bg-muted/30">
      <Button
        type="button"
        variant="ghost"
        className="flex w-full items-center justify-between px-4 py-3 h-auto"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-medium">{title}</span>
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>
      {open ? (
        <ol className="space-y-3 border-t px-4 py-3 text-sm">
          {steps.map((step, i) => (
            <li key={i} className="flex flex-col gap-0.5">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{step.label}</span>
                <span className="font-mono font-medium text-right">{step.value}</span>
              </div>
              {step.detail ? (
                <span className="text-xs text-muted-foreground">{step.detail}</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

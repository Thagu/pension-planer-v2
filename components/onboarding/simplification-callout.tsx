"use client";

import { Info } from "lucide-react";

import type { SimplificationNote } from "@/lib/onboarding/content";

export function SimplificationCallout({ note }: { note: SimplificationNote }) {
  return (
    <div
      className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30"
      role="note"
    >
      <div className="flex gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="min-w-0 space-y-2 text-sm">
          <p className="font-medium text-foreground">{note.title}</p>

          {note.intro ? (
            <p className="text-muted-foreground leading-relaxed">{note.intro}</p>
          ) : null}

          {note.items && note.items.length > 0 ? (
            <ul className="space-y-2 text-muted-foreground">
              {note.items.map((item) => (
                <li key={item.label} className="flex gap-2 leading-relaxed">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600/70 dark:bg-amber-400/70"
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium text-foreground">
                      {item.label}
                    </span>
                    {" — "}
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {note.body ? (
            <p className="text-muted-foreground leading-relaxed">{note.body}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import { Info } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function ProfileInheritanceNote({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 rounded-md border border-primary/15 bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

export function ProfileDefaultsPanel({
  title = "Aus Stammdaten (Standard)",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

export function ProfileDefaultItem({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">{value}</dd>
      {detail ? (
        <dd className="mt-0.5 text-xs text-muted-foreground">{detail}</dd>
      ) : null}
    </div>
  );
}

export function ScenarioAdjustmentsHeading() {
  return (
    <div className="space-y-1 pt-1">
      <p className="text-sm font-medium text-foreground">
        Optionale Szenario-Anpassungen
      </p>
      <p className="text-xs text-muted-foreground">
        Nur aktivieren, wenn dieser Wert vom Profil abweichen soll. Ohne
        Aktivierung gilt automatisch der Profilwert oben.
      </p>
    </div>
  );
}

export function ScenarioOverrideRow({
  id,
  checked,
  onCheckedChange,
  label,
  profileValue,
  children,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  profileValue: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 border-b border-border/50 pb-5 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={id} className="cursor-pointer font-normal leading-snug">
            {label}
          </Label>
          {!checked ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Profilwert: </span>
              <span className="font-medium text-foreground">{profileValue}</span>
            </p>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Szenario-Override aktiv
            </p>
          )}
        </div>
      </div>
      {checked && children ? <div className="ml-7">{children}</div> : null}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2 } from "lucide-react";

import { copyScenario } from "@/app/scenarios/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CopyScenarioFormProps = {
  sourceId: string;
  defaultName: string;
  /** Kompakte Darstellung in der Szenarien-Liste */
  compact?: boolean;
};

export function CopyScenarioForm({
  sourceId,
  defaultName,
  compact = false,
}: CopyScenarioFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`Kopie von ${defaultName}`);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const resetName = () => setName(`Kopie von ${defaultName}`);

  const handleOpen = () => {
    resetName();
    setError(null);
    setOpen(true);
  };

  const handleCancel = () => {
    setOpen(false);
    setError(null);
    resetName();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Bitte einen Namen für die Kopie angeben.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await copyScenario(sourceId, trimmed);
      } catch {
        setError("Kopieren fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant={compact ? "outline" : "secondary"}
        size="sm"
        onClick={handleOpen}
      >
        <Copy className="mr-1 h-4 w-4" />
        Kopieren
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? "mt-3 w-full space-y-2 rounded-md border bg-muted/20 p-3"
          : "flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-4"
      }
      onClick={(event) => event.stopPropagation()}
    >
      <div className={compact ? "grid gap-2" : "grid min-w-[240px] flex-1 gap-2"}>
        <Label htmlFor={`copy-name-${sourceId}`}>Name der Kopie</Label>
        <Input
          id={`copy-name-${sourceId}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="z. B. Frühpension — Variante B"
          required
          autoFocus
          disabled={pending}
        />
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Alle Szenario-Einstellungen werden übernommen; Stammdaten bleiben
            unverändert.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Copy className="mr-1 h-4 w-4" />
          )}
          Kopie erstellen
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={pending}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

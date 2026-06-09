import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { MasterDataSaveBanner } from "@/components/feedback/query-banner";
import { FederalBracketEditor } from "@/components/tax-reference/federal-bracket-editor";
import type { FederalBracketFormRow } from "@/components/tax-reference/federal-bracket-editor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadAllTaxFederalReferences } from "@/lib/tax/load-tax-reference";
import { buildDefaultFederalTaxAmounts } from "@/lib/tax/default-brackets";
import { parseTaxAmountsFromDb } from "@/lib/tax/types";
import { createClient } from "@/lib/supabase/server";
import { saveFederalTaxReference } from "./actions";

const MARITAL_STATUSES = ["single", "married"] as const;

async function FederalTaxReferenceContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const dbRows = await loadAllTaxFederalReferences(supabase);

  const rows: FederalBracketFormRow[] = MARITAL_STATUSES.map((maritalStatus) => {
    const dbRow = dbRows.find((r) => r.marital_status === maritalStatus);
    const dbAmounts = dbRow ? parseTaxAmountsFromDb(dbRow.tax_amounts) : null;
    const fallback = buildDefaultFederalTaxAmounts(maritalStatus);

    const taxAmounts: Record<string, number | ""> = {};
    for (const level of [50_000, 100_000, 250_000, 500_000, 1_000_000]) {
      const key = String(level);
      taxAmounts[key] = dbAmounts?.[key] ?? fallback[key] ?? "";
    }

    return {
      maritalStatus,
      taxAmounts,
      sourceNotes: dbRow?.source_notes ?? "",
      updatedAt: dbRow?.updated_at ?? null,
      fromDb: Boolean(dbAmounts),
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bundessteuer – Referenztabelle</CardTitle>
        <CardDescription>
          Effektive Steuerbeträge (CHF) auf Zusatzeinkommen ohne Lohn bei fünf
          Stützpunkten. Die Werte gelten global für alle Nutzer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={saveFederalTaxReference} className="space-y-6">
          <FederalBracketEditor rows={rows} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Speichern</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/master-data">Zurück zu Stammdaten</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function FederalTaxReferencePage() {
  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 md:px-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Globale Steuer-Referenz
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Bundessteuer</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Pflege die progressiven Stützpunkte für ledig und verheiratet. In der
            Berechnung wird zwischen den Beträgen linear interpoliert.
          </p>
        </div>

        <Suspense fallback={null}>
          <MasterDataSaveBanner />
        </Suspense>

        <Suspense
          fallback={
            <Card>
              <CardContent className="py-10 text-sm text-muted-foreground">
                Lade Referenztabelle…
              </CardContent>
            </Card>
          }
        >
          <FederalTaxReferenceContent />
        </Suspense>
      </div>
    </main>
  );
}

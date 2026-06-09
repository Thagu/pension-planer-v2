import Link from "next/link";
import { redirect } from "next/navigation";

import { calculateScenarioPension, formatCHF } from "@/lib/engine";
import { loadProfileForScenario } from "@/lib/profile/load-profile";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export async function ScenariosContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [{ data: scenarios }, profile] = await Promise.all([
    supabase
      .from("scenarios")
      .select("id, name, data, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    loadProfileForScenario(supabase, user.id),
  ]);

  const profileReady = profile != null;

  const monthlyByScenario = new Map<string, number>();
  if (profileReady && profile && scenarios) {
    for (const s of scenarios) {
      const result = calculateScenarioPension(
        profile,
        (s.data ?? {}) as Parameters<typeof calculateScenarioPension>[1],
      );
      monthlyByScenario.set(s.id, result.summary.monthlyTotalAtEmploymentEnd);
    }
  }

  return (
    <>
      {!profileReady ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Stammdaten unvollständig</CardTitle>
            <CardDescription>
              Bitte erfassen Sie mindestens Geburtsdatum und Bruttojahreslohn in
              den Stammdaten, bevor Sie ein Szenario berechnen können.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/master-data">Zu den Stammdaten</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {scenarios && scenarios.length > 0 ? (
        <div className="grid gap-3">
          {scenarios.map((s) => {
            const monthly = monthlyByScenario.get(s.id);
            return (
              <Link key={s.id} href={`/scenarios/${s.id}`}>
                <Card className="transition-colors hover:border-primary/40">
                  <CardHeader className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{s.name}</CardTitle>
                        <CardDescription>
                          {s.data?.description
                            ? String(s.data.description)
                            : "Keine Beschreibung"}
                          {" · "}
                          Aktualisiert:{" "}
                          {new Date(s.updated_at).toLocaleDateString("de-CH")}
                        </CardDescription>
                      </div>
                      {monthly != null ? (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            Monatliche Rente
                          </p>
                          <p className="font-mono text-lg font-semibold text-primary">
                            {formatCHF(monthly)}
                            <span className="text-sm font-normal text-muted-foreground">
                              /Mt.
                            </span>
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Noch keine Szenarien. Erstellen Sie Ihr erstes Szenario.
          </CardContent>
        </Card>
      )}
    </>
  );
}

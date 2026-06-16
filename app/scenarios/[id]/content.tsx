import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Home, Settings2 } from "lucide-react";

import { deleteScenario } from "@/app/scenarios/actions";
import { CopyScenarioForm } from "@/components/scenarios/copy-scenario-form";
import { ScenarioForm } from "@/components/scenarios/scenario-form";
import type { ScenarioRecord } from "@/components/scenarios/scenario-form";
import { loadHouseholdProfileForScenario } from "@/lib/profile/load-household-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export async function ScenarioDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [{ data: scenario }, household] = await Promise.all([
    supabase
      .from("scenarios")
      .select("id, name, data")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    loadHouseholdProfileForScenario(supabase, user.id),
  ]);

  if (!scenario) {
    notFound();
  }

  if (!household?.primary) {
    redirect("/master-data");
  }

  const initialScenario: ScenarioRecord = {
    id: scenario.id,
    name: scenario.name,
    data: (scenario.data ?? {}) as ScenarioRecord["data"],
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Szenario</Badge>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <Home className="mr-1 h-4 w-4" />
                Home
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/scenarios">Szenarien</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/master-data">
                <Settings2 className="mr-1 h-4 w-4" />
                Stammdaten
              </Link>
            </Button>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyScenarioForm sourceId={id} defaultName={scenario.name} />
          <form action={deleteScenario.bind(null, id)}>
            <Button type="submit" variant="destructive" size="sm">
              Löschen
            </Button>
          </form>
        </div>
      </div>

      <ScenarioForm
        profile={household.primary}
        household={household}
        initialScenario={initialScenario}
      />
    </>
  );
}

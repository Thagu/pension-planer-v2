import Link from "next/link";
import { redirect } from "next/navigation";

import { ScenarioForm } from "@/components/scenarios/scenario-form";
import { loadHouseholdProfileForScenario } from "@/lib/profile/load-household-profile";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export async function NewScenarioContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const household = await loadHouseholdProfileForScenario(supabase, user.id);

  if (!household?.primary) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Stammdaten erforderlich</CardTitle>
          <CardDescription>
            Geburtsdatum und Bruttojahreslohn fehlen in Ihrem Profil.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/master-data">Stammdaten erfassen</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScenarioForm profile={household.primary} household={household} />
  );
}

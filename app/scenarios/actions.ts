"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ScenarioOverrides } from "@/lib/engine";

export async function saveScenario(
  name: string,
  data: ScenarioOverrides & { description?: string },
  scenarioId?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    redirect("/scenarios/new?error=missing_name");
  }

  if (scenarioId) {
    const { error } = await supabase
      .from("scenarios")
      .update({ name: trimmedName, data })
      .eq("id", scenarioId)
      .eq("user_id", user.id);

    if (error) {
      redirect(`/scenarios/${scenarioId}?error=save_failed`);
    }

    revalidatePath("/scenarios");
    revalidatePath(`/scenarios/${scenarioId}`);
    redirect(`/scenarios/${scenarioId}?saved=1`);
  }

  const { data: created, error } = await supabase
    .from("scenarios")
    .insert({ user_id: user.id, name: trimmedName, data })
    .select("id")
    .single();

  if (error || !created) {
    redirect("/scenarios/new?error=save_failed");
  }

  revalidatePath("/scenarios");
  redirect(`/scenarios/${created.id}?saved=1`);
}

export async function deleteScenario(scenarioId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  await supabase
    .from("scenarios")
    .delete()
    .eq("id", scenarioId)
    .eq("user_id", user.id);

  revalidatePath("/scenarios");
  redirect("/scenarios");
}

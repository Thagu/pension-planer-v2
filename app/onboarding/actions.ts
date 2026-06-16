"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { persistMasterDataFromForm } from "@/app/master-data/actions";
import { ensureProfileExtensionColumns } from "@/lib/db/ensure-profile-columns";
import {
  buildFormDataFromOnboardingState,
  type OnboardingState,
} from "@/lib/onboarding/wizard-state";
import { isMissingProfileColumnError } from "@/lib/profile/extensions";
import { createClient } from "@/lib/supabase/server";

export async function skipOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  await ensureProfileExtensionColumns();

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        onboarding_skipped_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

  if (error && isMissingProfileColumnError(error.message)) {
    await ensureProfileExtensionColumns(true);
    await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          onboarding_skipped_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
  }

  revalidatePath("/");
  revalidatePath("/onboarding");
  redirect("/");
}

export async function completeOnboarding(
  state: OnboardingState,
): Promise<{ ok: true; scenarioId: string } | { ok: false; error: string }> {
  await ensureProfileExtensionColumns();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Nicht angemeldet." };
  }

  const trimmedName = state.scenarioName.trim();
  if (!trimmedName) {
    return { ok: false, error: "Bitte einen Szenario-Namen eingeben." };
  }

  if (!state.primary.birthDate.trim()) {
    return { ok: false, error: "Geburtsdatum Person 1 fehlt." };
  }

  const formData = buildFormDataFromOnboardingState(state);
  const persist = await persistMasterDataFromForm(formData, user.id, supabase);

  if (!persist.ok) {
    return { ok: false, error: persist.error };
  }

  const completedAt = new Date().toISOString();
  const { error: flagError } = await supabase
    .from("profiles")
    .update({
      onboarding_completed_at: completedAt,
      onboarding_skipped_at: null,
    })
    .eq("id", user.id);

  if (flagError && isMissingProfileColumnError(flagError.message)) {
    await ensureProfileExtensionColumns(true);
    await supabase
      .from("profiles")
      .update({
        onboarding_completed_at: completedAt,
        onboarding_skipped_at: null,
      })
      .eq("id", user.id);
  }

  const { data: created, error: scenarioError } = await supabase
    .from("scenarios")
    .insert({
      user_id: user.id,
      name: trimmedName,
      data: {},
    })
    .select("id")
    .single();

  if (scenarioError || !created) {
    return {
      ok: false,
      error: scenarioError?.message ?? "Szenario konnte nicht erstellt werden.",
    };
  }

  revalidatePath("/");
  revalidatePath("/master-data");
  revalidatePath("/scenarios");
  revalidatePath("/onboarding");

  return { ok: true, scenarioId: created.id as string };
}

export async function resetOnboardingForUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  await supabase
    .from("profiles")
    .update({
      onboarding_completed_at: null,
      onboarding_skipped_at: null,
    })
    .eq("id", user.id);

  revalidatePath("/");
  redirect("/onboarding");
}

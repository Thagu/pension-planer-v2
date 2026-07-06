import Link from "next/link";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import {
  onboardingStateFromProfile,
  shouldShowOnboarding,
} from "@/lib/onboarding/wizard-state";
import { loadPillar3aAccounts } from "@/lib/pillar3a/load-accounts";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ replay?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const params = await searchParams;
  const forceReplay = params.replay === "1";

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !forceReplay &&
    profile &&
    !shouldShowOnboarding(profile)
  ) {
    redirect("/");
  }

  const pillar3aRows = profile
    ? await loadPillar3aAccounts(
        supabase,
        user.id,
        profile.pillar3a_current_capital as number | null | undefined,
      )
    : [];
  const initialState = onboardingStateFromProfile(profile, {
    primary: pillar3aRows.filter(
      (row) => (row.person ?? "primary") === "primary",
    ),
    partner: pillar3aRows.filter((row) => row.person === "partner"),
  });

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="border-b bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Pension Planner
            </p>
            <h1 className="text-xl font-semibold tracking-tight">Einführung</h1>
          </div>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Startseite
          </Link>
        </div>
      </div>
      <OnboardingWizard initialState={initialState} />
    </main>
  );
}

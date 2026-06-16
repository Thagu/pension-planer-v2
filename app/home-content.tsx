import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Calculator,
  Landmark,
  LayoutDashboard,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { resetOnboardingForUser } from "@/app/onboarding/actions";
import { AuthButton } from "@/components/auth-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { calculateScenarioPension, formatCHF } from "@/lib/engine";
import { shouldShowOnboarding } from "@/lib/onboarding/wizard-state";
import { loadProfileForScenario } from "@/lib/profile/load-profile";
import { isProfileCompleteForScenario } from "@/lib/scenarios/profile";
import { createClient } from "@/lib/supabase/server";

export async function HomeContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 md:px-6">
        <div className="space-y-4 text-center md:text-left">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Pension Planner Schweiz
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Ihre Pension planen — modular und transparent
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            AHV, BVG, Säule 3a und freies Vermögen in einem Tool. Stammdaten
            erfassen, Szenarien vergleichen und die monatliche Rente schätzen.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/auth/sign-up">Kostenlos starten</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/auth/login">Anmelden</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5 text-primary" />}
            title="AHV"
            text="Altersrente nach Beitragsjahren und Einkommen"
          />
          <FeatureCard
            icon={<Building2 className="h-5 w-5 text-primary" />}
            title="BVG"
            text="Pensionskasse mit Kapitalbezug und Verzinsung"
          />
          <FeatureCard
            icon={<Landmark className="h-5 w-5 text-primary" />}
            title="Säule 3a"
            text="Mehrere Konten mit gestaffeltem Bezug"
          />
          <FeatureCard
            icon={<Wallet className="h-5 w-5 text-primary" />}
            title="Vermögen"
            text="Freies Vermögen inkl. Sparquote und Zuflüsse"
          />
        </div>
      </div>
    );
  }

  const [{ data: profileRow }, { data: scenarios }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("scenarios")
      .select("id, name, data, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  if (shouldShowOnboarding(profileRow)) {
    redirect("/onboarding");
  }

  const profileComplete = isProfileCompleteForScenario(profileRow);
  const scenarioProfile = profileComplete
    ? await loadProfileForScenario(supabase, user.id)
    : null;

  let latestMonthly: number | null = null;
  let latestScenarioName: string | null = null;
  if (scenarioProfile && scenarios && scenarios.length > 0) {
    const latest = scenarios[0];
    latestMonthly = calculateScenarioPension(
      scenarioProfile,
      (latest.data ?? {}) as Parameters<typeof calculateScenarioPension>[1],
    ).summary.monthlyTotal;
    latestScenarioName = latest.name;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Willkommen zurück
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Pension Planner
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <AuthButton />
      </div>

      {latestMonthly != null && latestScenarioName ? (
        <Card className="border-primary/25 bg-primary/5">
          <CardHeader className="pb-2">
            <CardDescription>Letztes Szenario</CardDescription>
            <CardTitle className="text-2xl font-mono">
              {formatCHF(latestMonthly)}
              <span className="text-base font-normal text-muted-foreground">
                /Mt.
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {latestScenarioName}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard
          href="/master-data"
          icon={<LayoutDashboard className="h-5 w-5" />}
          title="Stammdaten"
          description="Persönliche Angaben, BVG, 3a-Konten und Vermögen pflegen"
          cta="Stammdaten öffnen"
        />
        <NavCard
          href="/scenarios"
          icon={<Calculator className="h-5 w-5" />}
          title="Szenarien"
          description={
            profileComplete
              ? `${scenarios?.length ?? 0} Szenario(en) — What-if-Berechnungen`
              : "Zuerst Stammdaten vervollständigen"
          }
          cta="Szenarien ansehen"
        />
        <NavCard
          href="/scenarios/new"
          icon={<ArrowRight className="h-5 w-5" />}
          title="Neues Szenario"
          description="Pensionierung simulieren mit Overrides für AHV, BVG und 3a"
          cta="Szenario erstellen"
          disabled={!profileComplete}
        />
      </div>

      {!profileComplete ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Stammdaten vervollständigen</CardTitle>
            <CardDescription>
              Geburtsdatum und Bruttojahreslohn fehlen noch — ohne diese Angaben
              können keine Szenarien berechnet werden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/master-data">Zu den Stammdaten</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Einführung</CardTitle>
          <CardDescription>
            Assistent mit Erklärungen zu Sparquote, FI-Alter und Vereinfachungen
            erneut durchlaufen.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/onboarding?replay=1">Einführung wiederholen</Link>
          </Button>
          <form action={resetOnboardingForUser}>
            <Button type="submit" variant="ghost" size="sm">
              Wizard neu starten (Stammdaten behalten)
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="mb-1">{icon}</div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

function NavCard({
  href,
  icon,
  title,
  description,
  cta,
  disabled,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  disabled?: boolean;
}) {
  const content = (
    <Card
      className={`h-full transition-colors ${disabled ? "opacity-60" : "hover:border-primary/40"}`}
    >
      <CardHeader>
        <div className="mb-2 text-primary">{icon}</div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <span className="text-sm font-medium text-primary">{cta} →</span>
      </CardContent>
    </Card>
  );

  if (disabled) return content;
  return <Link href={href}>{content}</Link>;
}

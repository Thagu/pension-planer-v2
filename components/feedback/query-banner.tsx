"use client";

import { useSearchParams } from "next/navigation";

type BannerConfig = {
  param: string;
  value: string;
  className: string;
  message: string;
};

const successClass =
  "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";

const errorClass =
  "rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive";

export function QueryBanner({ banners }: { banners: BannerConfig[] }) {
  const searchParams = useSearchParams();

  for (const banner of banners) {
    if (searchParams.get(banner.param) === banner.value) {
      return <div className={banner.className}>{banner.message}</div>;
    }
  }

  return null;
}

export function MasterDataSaveBanner() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const detail = searchParams.get("detail");

  if (error === "save_failed") {
    return (
      <div className={errorClass} role="alert">
        <p className="font-medium">
          Speichern fehlgeschlagen. Bitte prüfe die Eingaben und versuche es erneut.
        </p>
        {detail ? (
          <p className="mt-2 text-xs leading-relaxed opacity-90">{detail}</p>
        ) : (
          <p className="mt-2 text-xs leading-relaxed opacity-90">
            Technische Details fehlen — prüfe die Server-Konsole oder führe die
            Supabase-Migrationen aus (Ordner{" "}
            <span className="font-mono">supabase/migrations</span>, insbesondere
            011 und 013).
          </p>
        )}
      </div>
    );
  }

  if (error === "tax_postal_code_required") {
    return (
      <div className={errorClass} role="alert">
        Steuerdomizil: Bitte Kanton und 4-stellige PLZ angeben.
      </div>
    );
  }

  if (error === "tax_postal_code_invalid") {
    return (
      <div className={errorClass} role="alert">
        Steuerdomizil: PLZ passt nicht zum Kanton oder Gemeinde konnte nicht
        ermittelt werden.
        {detail ? (
          <p className="mt-2 text-xs leading-relaxed opacity-90">{detail}</p>
        ) : null}
      </div>
    );
  }

  if (searchParams.get("saved") === "1") {
    return (
      <div className={successClass}>Stammdaten erfolgreich gespeichert.</div>
    );
  }

  return null;
}

export function ScenarioSavedBanner() {
  return (
    <QueryBanner
      banners={[
        {
          param: "saved",
          value: "1",
          className: successClass,
          message: "Szenario gespeichert.",
        },
      ]}
    />
  );
}

export function NewScenarioErrorBanner() {
  return (
    <QueryBanner
      banners={[
        {
          param: "error",
          value: "missing_name",
          className: errorClass,
          message: "Bitte geben Sie einen Namen für das Szenario ein.",
        },
        {
          param: "error",
          value: "save_failed",
          className: errorClass,
          message: "Speichern fehlgeschlagen.",
        },
      ]}
    />
  );
}

export function ScenarioDetailStatusBanner() {
  return (
    <QueryBanner
      banners={[
        {
          param: "saved",
          value: "1",
          className: `${successClass} mb-4`,
          message: "Szenario gespeichert.",
        },
        {
          param: "copied",
          value: "1",
          className: `${successClass} mb-4`,
          message: "Szenario-Kopie erstellt.",
        },
        {
          param: "error",
          value: "save_failed",
          className: `${errorClass} mb-4`,
          message: "Speichern fehlgeschlagen.",
        },
        {
          param: "error",
          value: "copy_missing_name",
          className: `${errorClass} mb-4`,
          message: "Bitte einen Namen für die Kopie angeben.",
        },
        {
          param: "error",
          value: "copy_failed",
          className: `${errorClass} mb-4`,
          message: "Kopieren fehlgeschlagen.",
        },
        {
          param: "error",
          value: "copy_not_found",
          className: `${errorClass} mb-4`,
          message: "Quell-Szenario nicht gefunden.",
        },
      ]}
    />
  );
}

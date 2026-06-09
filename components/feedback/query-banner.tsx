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
  return (
    <QueryBanner
      banners={[
        {
          param: "saved",
          value: "1",
          className: successClass,
          message: "Stammdaten erfolgreich gespeichert.",
        },
        {
          param: "error",
          value: "save_failed",
          className: errorClass,
          message:
            "Speichern fehlgeschlagen. Bitte prüfe die Eingaben und versuche es erneut.",
        },
        {
          param: "error",
          value: "tax_postal_code_required",
          className: errorClass,
          message:
            "Steuerdomizil: Bitte Kanton und 4-stellige PLZ angeben.",
        },
        {
          param: "error",
          value: "tax_postal_code_invalid",
          className: errorClass,
          message:
            "Steuerdomizil: PLZ passt nicht zum Kanton oder Gemeinde konnte nicht ermittelt werden.",
        },
      ]}
    />
  );
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
          param: "error",
          value: "save_failed",
          className: `${errorClass} mb-4`,
          message: "Speichern fehlgeschlagen.",
        },
      ]}
    />
  );
}

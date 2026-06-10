"use client";

import { Building2, Info, Landmark, ShieldCheck, Wallet } from "lucide-react";

import { formatCHF, type ScenarioPensionResult } from "@/lib/engine";
import { formatRatePercent } from "@/lib/format/numbers";
import { ModuleExplanation } from "./module-explanation";

export function PensionSummary({
  result,
  baseMonthlyTotal,
  retirementAge,
}: {
  result: ScenarioPensionResult;
  baseMonthlyTotal?: number;
  retirementAge: number;
}) {
  const diff =
    baseMonthlyTotal != null
      ? result.summary.monthlyTotalAtHorizon - baseMonthlyTotal
      : 0;

  const ahvActiveAtEmploymentEnd =
    retirementAge >= result.ahv.pensionStartAge;
  const bvgActiveAtEmploymentEnd =
    retirementAge >= result.bvg.pensionStartAge;
  const monthlyAhvNow = ahvActiveAtEmploymentEnd
    ? result.ahv.monthlyPension
    : 0;
  const monthlyBvgNow = bvgActiveAtEmploymentEnd
    ? result.bvg.monthlyPension
    : 0;

  const hasZeroBvgWithCapital =
    result.summary.projectedCapitalBvg > 0 &&
    result.bvg.monthlyPension === 0 &&
    result.bvg.payout.capitalWithdrawalPercent >= 0.999;

  const has3a = result.pillar3a.accounts.length > 0;
  const hasFreeAssetsFlow =
    result.freeAssets ||
    result.summary.totalCapitalInjectionsToFreeAssets > 0;

  return (
    <div className="space-y-5">
        <PillarRow
          icon={<ShieldCheck className="h-4 w-4 text-primary" />}
          label="AHV (1. Säule)"
          monthly={monthlyAhvNow}
          pendingNote={
            !ahvActiveAtEmploymentEnd
              ? `${formatCHF(result.ahv.monthlyPension)}/Mt. ab ${result.ahv.pensionStartAge} J.`
              : undefined
          }
          detail={`${formatCHF(result.ahv.yearlyPension)}/Jahr · Referenzalter ${result.ahv.referenceAge % 1 === 0 ? result.ahv.referenceAge : result.ahv.referenceAge.toFixed(1)} J. · ${result.ahv.contributionYears}/${result.ahv.maxContributionYears} Beitragsjahre`}
        />
        <PillarRow
          icon={<Building2 className="h-4 w-4 text-primary" />}
          label="BVG (2. Säule) – Rente"
          monthly={monthlyBvgNow}
          pendingNote={
            !bvgActiveAtEmploymentEnd
              ? `${formatCHF(result.bvg.monthlyPension)}/Mt. ab ${result.bvg.pensionStartAge} J.`
              : undefined
          }
          detail={
            result.bvg.payout.capitalWithdrawalPercent > 0
              ? `Kapitalbezug ${(result.bvg.payout.capitalWithdrawalPercent * 100).toFixed(0)}% → Vermögen ${formatCHF(result.summary.bvgCapitalToFreeAssets)} · Rente aus ${formatCHF(result.bvg.payout.capitalConvertedToPension)}`
              : `Guthaben ${formatCHF(result.summary.projectedCapitalBvg)} · UWS ${formatRatePercent(result.bvg.conversionRate, 1)}`
          }
        />
        {hasZeroBvgWithCapital ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            BVG-Rente ist 0, weil 100&nbsp;% Kapitalbezug gewählt wurde. Für
            volle Verrentung «Kapitalbezug» auf 0&nbsp;% setzen (Verrentet:
            100&nbsp;%).
          </p>
        ) : null}
        {has3a ? (
          <PillarRow
            icon={<Landmark className="h-4 w-4 text-primary" />}
            label="Säule 3a (gestaffelter Bezug)"
            monthly={0}
            detail={`${result.pillar3a.accounts.length} Konto(en) · Total ${formatCHF(result.summary.projectedCapitalPillar3a)} → freies Vermögen${result.pillar3a.scheduledWithdrawals.length > 1 ? ` über ${result.pillar3a.scheduledWithdrawals.length} Bezugsjahre` : ""}`}
            hideMonthly
          />
        ) : null}
        {hasFreeAssetsFlow ? (
          <PillarRow
            icon={<Wallet className="h-4 w-4 text-primary" />}
            label="Freies Vermögen (inkl. Kapitalbezüge)"
            monthly={result.summary.monthlyFreeAssets}
            detail={`Kapital ${formatCHF(result.summary.projectedCapitalFreeAssets)}${result.summary.bvgCapitalToFreeAssets > 0 ? ` · BVG ${formatCHF(result.summary.bvgCapitalToFreeAssets)}` : ""}${result.summary.pillar3aCapitalToFreeAssets > 0 ? ` · 3a ${formatCHF(result.summary.pillar3aCapitalToFreeAssets)}` : ""}`}
          />
        ) : null}

        <div className="border-t border-primary/20 pt-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total ab Erwerbsaufgabe ({retirementAge} J.)
              </p>
              <p className="text-3xl font-bold font-mono text-primary">
                {formatCHF(result.summary.monthlyTotalAtEmploymentEnd)}
                <span className="text-sm font-normal text-muted-foreground">
                  /Mt.
                </span>
              </p>
              {result.summary.monthlyTotalAtHorizon !==
              result.summary.monthlyTotalAtEmploymentEnd ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Ab Planungshorizont (alle Renten aktiv):{" "}
                  {formatCHF(result.summary.monthlyTotalAtHorizon)}/Mt.
                </p>
              ) : null}
            </div>
            {diff !== 0 ? (
              <span
                className={`text-sm font-mono font-semibold ${diff > 0 ? "text-emerald-600" : "text-red-600"}`}
              >
                {diff > 0 ? "+" : ""}
                {formatCHF(diff)}
              </span>
            ) : null}
          </div>
          {baseMonthlyTotal != null ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Basis (Profil ohne Szenario-Anpassungen):{" "}
              {formatCHF(baseMonthlyTotal)}/Mt.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <ModuleExplanation title="AHV – Rechenweg" steps={result.ahv.explanation} />
          <ModuleExplanation title="BVG – Rechenweg" steps={result.bvg.explanation} />
          {has3a ? (
            <ModuleExplanation
              title="Säule 3a – Rechenweg"
              steps={result.pillar3a.explanation}
            />
          ) : null}
          {result.freeAssets ? (
            <ModuleExplanation
              title="Freies Vermögen – Rechenweg"
              steps={result.freeAssets.explanation}
            />
          ) : null}
        </div>
    </div>
  );
}

function PillarRow({
  icon,
  label,
  monthly,
  detail,
  pendingNote,
  hideMonthly = false,
}: {
  icon: React.ReactNode;
  label: string;
  monthly: number;
  detail: string;
  pendingNote?: string;
  hideMonthly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      {!hideMonthly ? (
        <>
          <p className="text-xl font-bold font-mono">
            {formatCHF(monthly)}
            <span className="text-xs font-normal text-muted-foreground">/Mt.</span>
          </p>
          {pendingNote ? (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
              {pendingNote}
            </p>
          ) : null}
        </>
      ) : null}
      <p className={`text-xs text-muted-foreground ${hideMonthly ? "mt-1" : ""}`}>
        {detail}
      </p>
    </div>
  );
}

"use client";

import { formatCHF, NET_SALARY_ESTIMATE_FACTOR } from "@/lib/engine";
import {
  cashflowPhaseLabel,
  type HouseholdCashflowPhase,
} from "@/lib/engine/household-cashflow";
import type { CombinedWealthYearProjection } from "@/lib/household/types";

const PENSION_LINE_COLOR = "hsl(var(--chart-5))";

function TooltipRow({
  label,
  value,
  tone = "default",
  color,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "muted";
  color?: string;
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-destructive"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";

  return (
    <div className="flex justify-between gap-4">
      <dt style={color ? { color } : undefined}>{label}</dt>
      <dd className={`font-mono tabular-nums ${valueClass}`}>{value}</dd>
    </div>
  );
}

export type SimpleCashflowBreakdown = {
  netLiving: number;
  retirementTax: number;
  pensionIncome: number;
  employmentIncomeNet?: number;
  netWithdrawal: number;
  cashflowPhase?: HouseholdCashflowPhase;
};

export function cashflowFromCombinedRow(
  row: CombinedWealthYearProjection,
): SimpleCashflowBreakdown | null {
  if (row.cashflowPhase == null && (row.netLivingExpenses ?? 0) <= 0) {
    return null;
  }
  const netLiving = row.netLivingExpenses ?? 0;
  const grossNeed = row.annualGrossExpenses ?? 0;
  const retirementTax = Math.max(0, grossNeed - netLiving);
  return {
    netLiving,
    retirementTax,
    pensionIncome: row.annualPensionIncome,
    employmentIncomeNet: row.employmentIncomeNet,
    netWithdrawal: row.annualWithdrawal,
    cashflowPhase: row.cashflowPhase,
  };
}

export function cashflowFromFreeAssetsRow(
  point: {
    annualGrossExpenses: number;
    annualTotalTax: number;
    annualPensionIncome: number;
    annualWithdrawal: number;
  },
  inRetirement: boolean,
): SimpleCashflowBreakdown | null {
  if (!inRetirement || point.annualGrossExpenses <= 0) return null;
  return {
    netLiving: point.annualGrossExpenses,
    retirementTax: point.annualTotalTax,
    pensionIncome: point.annualPensionIncome,
    netWithdrawal: point.annualWithdrawal,
    cashflowPhase: "full_retirement",
  };
}

export function HouseholdCashflowBreakdown({
  cashflow,
  showPhaseBadge = true,
}: {
  cashflow: SimpleCashflowBreakdown;
  showPhaseBadge?: boolean;
}) {
  const phase = cashflow.cashflowPhase;

  return (
    <>
      {showPhaseBadge && phase && phase !== "accumulation" ? (
        <p className="text-[10px] font-medium text-primary">
          {cashflowPhaseLabel(phase)}
        </p>
      ) : null}

      <p className="border-t border-border/60 pt-2 text-[10px] font-medium uppercase tracking-wide text-foreground/70">
        Haushalts-Wasserfall
      </p>

      {cashflow.netLiving > 0 ? (
        <TooltipRow
          label={
            cashflow.cashflowPhase === "survivor"
              ? "Netto-Lebenshaltung (allein)"
              : "Netto-Lebenshaltung"
          }
          value={`−${formatCHF(cashflow.netLiving)}`}
          tone="negative"
        />
      ) : null}
      {cashflow.retirementTax > 0 ? (
        <TooltipRow
          label="+ Steuern (Ruhestand)"
          value={`−${formatCHF(cashflow.retirementTax)}`}
          tone="muted"
        />
      ) : null}
      {cashflow.pensionIncome > 0 ? (
        <TooltipRow
          label="− AHV/BVG-Rente"
          value={`+${formatCHF(cashflow.pensionIncome)}`}
          tone="positive"
          color={PENSION_LINE_COLOR}
        />
      ) : null}
      {(cashflow.employmentIncomeNet ?? 0) > 0 ? (
        <TooltipRow
          label={`− Lohn (geschätzt ${Math.round(NET_SALARY_ESTIMATE_FACTOR * 100)} % netto)`}
          value={`+${formatCHF(cashflow.employmentIncomeNet!)}`}
          tone="positive"
        />
      ) : null}
      {cashflow.netWithdrawal > 0 ? (
        <TooltipRow
          label="= Entnahme Vermögen"
          value={`−${formatCHF(cashflow.netWithdrawal)}`}
          tone="negative"
        />
      ) : (
        <TooltipRow label="= Entnahme Vermögen" value={formatCHF(0)} tone="muted" />
      )}
    </>
  );
}

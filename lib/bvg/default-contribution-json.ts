import { BVG_CONTRIBUTION_RATES } from "@/lib/engine/constants";
import { decimalRateToPercent } from "@/lib/format/numbers";

/** Standard BVG Gutschriften als JSON für Stammdaten (Prozent pro Altersband). */
export function defaultBvgContributionRatesJson(): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(BVG_CONTRIBUTION_RATES).map(([key, rate]) => [
        key,
        decimalRateToPercent(rate),
      ]),
    ),
    null,
    2,
  );
}

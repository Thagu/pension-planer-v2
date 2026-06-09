/**
 * ESTV Steuerrechner API (öffentlich, ohne API-Key)
 * @see https://swisstaxcalculator.estv.admin.ch
 */

const ESTV_API_BASE =
  "https://swisstaxcalculator.estv.admin.ch/delegate/ost-integration/v1/lg-proxy/operation/c3b67379_ESTV";

export const ESTV_LANGUAGE_DE = 1;
export const ESTV_RELATIONSHIP_SINGLE = 1;
export const ESTV_RELATIONSHIP_MARRIED = 2;
export const ESTV_CONFESSION_NONE = 5;
export const ESTV_GENDER_MALE = 1;

export type EstvCityResult = {
  TaxLocationID: number;
  ZipCode: string;
  BfsID: number;
  CantonID: number;
  BfsName: string;
  City: string;
  Canton: string;
};

export type EstvPensionCapitalTaxResult = {
  TaxChurch: number;
  TaxCity: number;
  TaxCanton: number;
  TaxFed: number;
  Location: EstvCityResult;
};

export type EstvTaxRates = {
  IncomeRateCity?: number;
  CapitalTaxRateCity?: number;
};

type EstvResponse<T> = {
  response: T;
};

async function estvPost<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${ESTV_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `ESTV-Steuerrechner Fehler (${response.status}): ${detail.slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as EstvResponse<T>;
  return json.response;
}

export function currentEstvTaxYear(): number {
  return new Date().getFullYear();
}

export async function searchEstvLocations(
  searchTerm: string,
  taxYear = currentEstvTaxYear(),
): Promise<EstvCityResult[]> {
  const results = await estvPost<EstvCityResult[]>("API_searchLocation", {
    Language: ESTV_LANGUAGE_DE,
    Search: searchTerm.trim(),
    TaxYear: taxYear,
  });
  return Array.isArray(results) ? results : [];
}

export async function calculateEstvPensionCapitalTax(params: {
  taxLocationId: number;
  capital: number;
  maritalStatus: "single" | "married";
  taxYear?: number;
  ageAtPayment?: number;
}): Promise<EstvPensionCapitalTaxResult> {
  const taxYear = params.taxYear ?? currentEstvTaxYear();
  const relationship =
    params.maritalStatus === "married"
      ? ESTV_RELATIONSHIP_MARRIED
      : ESTV_RELATIONSHIP_SINGLE;

  const results = await estvPost<EstvPensionCapitalTaxResult[]>(
    "API_calculateManyCapitalTaxes",
    {
      TaxYear: taxYear,
      TaxGroupID: params.taxLocationId,
      Relationship: relationship,
      Confession1: ESTV_CONFESSION_NONE,
      Confession2: ESTV_CONFESSION_NONE,
      Gender: ESTV_GENDER_MALE,
      AgeAtPayment: params.ageAtPayment ?? 65,
      Capital: Math.round(params.capital),
    },
  );

  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("ESTV lieferte keine Steuerberechnung");
  }

  return results[0];
}

export async function fetchEstvMunicipalitySteuerfuss(params: {
  taxLocationId: number;
  taxYear?: number;
}): Promise<number> {
  const taxYear = params.taxYear ?? currentEstvTaxYear();

  const result = await estvPost<{ TaxRates?: EstvTaxRates }>(
    "API_calculateDetailedTaxes",
    {
      TaxYear: taxYear,
      TaxLocationID: params.taxLocationId,
      Relationship: ESTV_RELATIONSHIP_SINGLE,
      Confession1: ESTV_CONFESSION_NONE,
      Confession2: ESTV_CONFESSION_NONE,
      Age1: 65,
      Age2: 65,
      RevenueType1: 0,
      Revenue1: 0,
      RevenueType2: 0,
      Revenue2: 0,
      Fortune: 0,
    },
  );

  const rate =
    result.TaxRates?.IncomeRateCity ?? result.TaxRates?.CapitalTaxRateCity;
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("ESTV lieferte keinen Gemeinde-Steuerfuss");
  }

  return rate;
}

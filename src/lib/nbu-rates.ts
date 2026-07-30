import "server-only";

export interface NbuRates {
  UAH: number;
  USD: number;
  EUR: number;
}

interface NbuApiRow {
  cc: string;
  rate: number;
}

/** UAH per 1 unit of currency, from the National Bank of Ukraine's public
 *  open-data API. Updates once/day on the bank's side; cached here to match. */
export async function fetchNbuRates(): Promise<NbuRates> {
  const res = await fetch("https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json", {
    next: { revalidate: 24 * 60 * 60 },
  });
  if (!res.ok) {
    throw new Error(`NBU exchange rate fetch failed: ${res.status}`);
  }
  const rows: NbuApiRow[] = await res.json();
  const usd = rows.find((r) => r.cc === "USD")?.rate;
  const eur = rows.find((r) => r.cc === "EUR")?.rate;
  if (!usd || !eur) {
    throw new Error("NBU response missing USD/EUR rates");
  }
  return { UAH: 1, USD: usd, EUR: eur };
}

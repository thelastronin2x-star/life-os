export type MacroRegion = "US" | "EU" | "JP";
export type MacroCurrency = "USD" | "EUR" | "JPY";
export type MacroImportance = "high" | "medium" | "low";
export type MacroProvider = "businessquant" | "fxmacrodata";

export interface MacroEvent {
  id: string;
  region: MacroRegion;
  currency: MacroCurrency;
  title: string;
  importance: MacroImportance;
  scheduledAt: string;
  previous?: string;
  actual?: string;
  sourceUrl?: string;
  affectedMarkets: string[];
  provider: MacroProvider;
}

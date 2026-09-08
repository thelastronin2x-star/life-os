export type VoiceSection = "finance" | "work" | "calendar" | "health";

export type VoiceHealthMetric = "water";

/** What the voice classifier hands back — a flat, mostly-optional field set
 *  rather than a per-section union: the four domains share little enough
 *  shape that a union would just be four near-duplicate interfaces, and the
 *  result sheet already reads only the fields relevant to `section`. */
export interface VoiceClassifyResult {
  section: VoiceSection;
  action: string;
  confidence: number;
  title: string;
  amount?: number;
  categoryName?: string;
  instrumentSymbol?: string;
  direction?: "LONG" | "SHORT";
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  healthMetric?: VoiceHealthMetric;
  healthValue?: number;
}

export interface VoiceClassifyResponse {
  heard: string;
  result: VoiceClassifyResult | null;
}

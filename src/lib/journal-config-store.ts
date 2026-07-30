"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CURRENCY_PAIRS, getContractMultiplier, findCurrencyPair } from "./currency-pairs";
import { normalizeSymbol } from "./instrument-symbol";
import type { Trade } from "./journal-store";

export type AssetType = "forex" | "metals" | "indices" | "crypto" | "custom";

export interface JournalInstrument {
  id: string;
  symbol: string;
  assetType: AssetType;
  isCustom: boolean;
  /** Only set (and used) for custom instruments — standard ones derive their
   *  multiplier from the shared currency-pairs pip-value table. */
  contractMultiplier?: number;
}

export interface JournalTag {
  id: string;
  name: string;
  isCustom: boolean;
}

export interface JournalSession {
  id: string;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string;
  timezoneLabel: string;
  isCustom: boolean;
}

const SEED_SYMBOLS = ["EUR/USD", "XAU/USD", "GBP/USD", "GBP/JPY", "USD/JPY"];

function seedInstruments(): JournalInstrument[] {
  const standard: JournalInstrument[] = CURRENCY_PAIRS.filter((p) => SEED_SYMBOLS.includes(p.symbol)).map(
    (p) => ({
      id: `instr-${p.symbol.replace("/", "")}`,
      symbol: p.symbol,
      assetType: p.symbol.startsWith("XAU") || p.symbol.startsWith("XAG") ? "metals" : "forex",
      isCustom: false,
    })
  );
  return [
    ...standard,
    { id: "instr-us30", symbol: "US30 (Dow Jones)", assetType: "indices", isCustom: true, contractMultiplier: 1 },
  ];
}

/** Curated non-forex instruments offered as one-tap quick-adds in the library
 *  screen (in addition to the full CURRENCY_PAIRS reference table). */
export const QUICK_ADD_INDICES = [
  "US30 (Dow Jones)",
  "NAS100 (Nasdaq)",
  "SPX500 (S&P 500)",
  "GER40 (DAX)",
  "UK100 (FTSE)",
  "JPN225 (Nikkei)",
];

export const QUICK_ADD_CRYPTO = ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD"];

function seedTags(): JournalTag[] {
  return ["OB", "FVG", "CHoCH", "BOS", "Breaker Block", "Liquidity Grab"].map((name) => ({
    id: `tag-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    isCustom: false,
  }));
}

function seedSessions(): JournalSession[] {
  return [
    { id: "sess-london", name: "Лондон", startTime: "08:00", endTime: "17:00", timezoneLabel: "GMT+3", isCustom: false },
    { id: "sess-ny", name: "Нью-Йорк", startTime: "15:00", endTime: "00:00", timezoneLabel: "GMT+3", isCustom: false },
    { id: "sess-asia", name: "Азія", startTime: "01:00", endTime: "09:00", timezoneLabel: "GMT+3", isCustom: false },
  ];
}

interface JournalConfigState {
  instruments: JournalInstrument[];
  tags: JournalTag[];
  sessions: JournalSession[];

  addInstrument: (i: Omit<JournalInstrument, "id" | "isCustom">) => string;
  removeInstrument: (id: string) => void;

  addTag: (name: string) => void;
  removeTag: (id: string) => void;

  addSession: (s: Omit<JournalSession, "id" | "isCustom">) => void;
  removeSession: (id: string) => void;
}

export const useJournalConfigStore = create<JournalConfigState>()(
  persist(
    (set) => ({
      instruments: seedInstruments(),
      tags: seedTags(),
      sessions: seedSessions(),

      addInstrument: (i) => {
        const id = crypto.randomUUID();
        set((s) => ({ instruments: [...s.instruments, { ...i, id, isCustom: true }] }));
        return id;
      },
      removeInstrument: (id) =>
        set((s) => ({ instruments: s.instruments.filter((i) => i.id !== id) })),

      addTag: (name) =>
        set((s) => ({ tags: [...s.tags, { id: crypto.randomUUID(), name, isCustom: true }] })),
      removeTag: (id) => set((s) => ({ tags: s.tags.filter((t) => t.id !== id) })),

      addSession: (sess) =>
        set((s) => ({
          sessions: [...s.sessions, { ...sess, id: crypto.randomUUID(), isCustom: true }],
        })),
      removeSession: (id) =>
        set((s) => ({ sessions: s.sessions.filter((sess) => sess.id !== id) })),
    }),
    { name: "life-os-journal-config" }
  )
);

/** $ P&L per unit of raw price movement per 1.0 lot for this instrument. */
export function getInstrumentMultiplier(instrument: JournalInstrument): number {
  if (instrument.isCustom) return instrument.contractMultiplier ?? 1;
  const pair = findCurrencyPair(instrument.symbol);
  return pair ? getContractMultiplier(pair) : 1;
}

export interface AmbiguousInstrumentPair {
  /** The instrument whose symbol is a prefix of the other's — the one
   *  loose `startsWith` matching used to incorrectly attract trades meant
   *  for `longer`, if `longer` was created first. */
  shorter: JournalInstrument;
  longer: JournalInstrument;
  /** Trades currently pointing at `longer` — some of these may genuinely
   *  belong to `shorter`'s real market, but which ones can't be determined
   *  without the original broker symbol (not recorded before this fix). */
  longerTradeCount: number;
}

/** Diagnostic-only pass over EXISTING data — deliberately does not move or
 *  reassign anything. Before this fix, two genuinely different crypto
 *  markets (e.g. "ETH" and "ETHW") could only end up as separate
 *  instruments in the first place if the loose `startsWith` match sometimes
 *  failed to collapse them — so a pair like this existing side by side is
 *  concrete evidence the ambiguity was real, not proof of which specific
 *  trades under the longer instrument actually belong to the shorter one.
 *  Trades ingested before `sourceSymbol` existed have no way to recover
 *  that answer, so this surfaces the pairs for manual review instead of
 *  guessing — see journal-instrument-matching-prompt.md. */
export function findAmbiguousInstrumentPairs(
  instruments: JournalInstrument[],
  trades: Trade[]
): AmbiguousInstrumentPair[] {
  const crypto = instruments.filter((i) => i.assetType === "crypto");
  const pairs: AmbiguousInstrumentPair[] = [];

  for (const shorter of crypto) {
    const shorterNorm = normalizeSymbol(shorter.symbol);
    for (const longer of crypto) {
      if (shorter.id === longer.id) continue;
      const longerNorm = normalizeSymbol(longer.symbol);
      if (longerNorm.length > shorterNorm.length && longerNorm.startsWith(shorterNorm)) {
        pairs.push({
          shorter,
          longer,
          longerTradeCount: trades.filter((t) => t.instrumentId === longer.id).length,
        });
      }
    }
  }

  return pairs;
}

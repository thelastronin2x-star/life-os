import { useJournalConfigStore } from "./journal-config-store";
import { normalizeSymbol, baseAssetDisplaySymbol } from "./instrument-symbol";

/** Finds (or creates) the journal instrument for a raw crypto broker symbol
 *  — exact match on the normalized symbol, never a loose prefix match (see
 *  journal-instrument-matching-prompt.md — "ETH" used to incorrectly match
 *  an existing "ETHW/USD" instrument). Reads the store fresh via `getState`
 *  on every call rather than a snapshot passed in by the caller, so
 *  resolving several symbols in a row within the same sync batch always
 *  sees instruments created earlier in that same batch, instead of each
 *  creating its own duplicate. */
export function resolveCryptoInstrumentId(rawSymbol: string): string {
  const normalized = normalizeSymbol(rawSymbol);
  const { instruments, addInstrument } = useJournalConfigStore.getState();
  const existing = instruments.find((i) => normalizeSymbol(i.symbol) === normalized);
  if (existing) return existing.id;
  return addInstrument({ symbol: baseAssetDisplaySymbol(rawSymbol), assetType: "crypto", contractMultiplier: 1 });
}

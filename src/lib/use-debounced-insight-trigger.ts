"use client";

import { useEffect, useRef } from "react";

export const DEFAULT_DEBOUNCE_MS = 4 * 60 * 1000; // 4 minutes of quiet before an automatic insight actually fires

/**
 * Debounces automatic proactive insight generation so a burst of data
 * changes (e.g. adding 10 calendar events back-to-back) produces one API
 * call once things go quiet, not one call per change. How long "quiet"
 * means is caller-supplied — each data source has its own natural cadence
 * (see the per-domain use-*-insight-sync.ts files), so this hook doesn't
 * hardcode one.
 *
 * `signature` should be the freshly-computed staleness signature for this
 * context; `enabled` should be true only while it actually differs from the
 * cached one (the caller already knows this, and for sources with a cooldown
 * floor on top of staleness — e.g. finance — the caller factors that in
 * before passing `enabled`). Every time `signature` changes while enabled,
 * the timer restarts. If the component unmounts (app closed) before the
 * timer fires, nothing is lost — the next mount recomputes the same
 * signature mismatch and starts a fresh timer, since staleness is derived
 * from persisted data rather than tracked as its own flag.
 *
 * Does not apply to direct user requests (typed chat messages, "generate
 * report now") — those call the assistant immediately, bypassing this hook
 * entirely.
 */
export function useDebouncedInsightTrigger(
  signature: string,
  enabled: boolean,
  onFire: () => void,
  ms: number = DEFAULT_DEBOUNCE_MS
) {
  const onFireRef = useRef(onFire);

  useEffect(() => {
    onFireRef.current = onFire;
  }, [onFire]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => onFireRef.current(), ms);
    return () => clearTimeout(timer);
  }, [signature, enabled, ms]);
}

"use client";

import { useEffect, useState } from "react";
import type { MacroEvent } from "@/lib/macro/types";

export interface MacroEventsState {
  items: MacroEvent[];
  loading: boolean;
  error: boolean;
}

/** Reads the server-side cache (never calls BusinessQuant/FXMacroData
 *  directly — see api/macro/events/route.ts). Fetches once on mount; the
 *  underlying cache only changes once a day (api/macro/refresh's cron),
 *  so there's nothing to re-fetch on. */
export function useMacroEvents(): MacroEventsState {
  const [state, setState] = useState<MacroEventsState>({ items: [], loading: true, error: false });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/macro/events")
      .then((res) => {
        if (!res.ok) throw new Error("fetch_failed");
        return res.json() as Promise<{ items: MacroEvent[] }>;
      })
      .then((data) => {
        if (!cancelled) setState({ items: data.items, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ items: [], loading: false, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

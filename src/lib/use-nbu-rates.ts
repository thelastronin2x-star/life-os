"use client";

import { useEffect, useState } from "react";
import type { NbuRates } from "./nbu-rates";

type Status = "loading" | "ready" | "error";

interface RatesState {
  rates: NbuRates | null;
  status: Status;
}

/** Only a SUCCESSFUL result is cached for the session. A failure used to be
 *  cached exactly the same way, which meant one transient hiccup (offline for
 *  a moment on load, a cold-start timeout, NBU briefly unreachable) poisoned
 *  the whole session: every later render read `status: "error"` and never
 *  refetched. That was invisible but expensive — convertCurrency returns null
 *  without rates, and every sum that swallows null (category spend, income,
 *  expense) then quietly renders as 0 instead of the real amount. */
let cache: RatesState | null = null;
/** Shared so N components mounting at once make one request, not N. */
let inFlight: Promise<RatesState> | null = null;

function loadRates(): Promise<RatesState> {
  if (inFlight) return inFlight;
  inFlight = fetch("/api/finance/nbu-rates")
    .then((res) => res.json())
    .then((data: { rates?: NbuRates; error?: string }) => {
      const next: RatesState = data.rates ? { rates: data.rates, status: "ready" } : { rates: null, status: "error" };
      if (next.status === "ready") cache = next;
      return next;
    })
    .catch((): RatesState => ({ rates: null, status: "error" }))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** UAH per 1 unit of USD/EUR, from the National Bank of Ukraine. Used to
 *  convert non-default-currency accounts into one combined total balance. */
export function useNbuRates(): RatesState {
  const [state, setState] = useState<RatesState>(cache ?? { rates: null, status: "loading" });

  useEffect(() => {
    let cancelled = false;

    function attempt() {
      if (cancelled || cache) return;
      loadRates().then((next) => {
        if (!cancelled) setState(next);
      });
    }

    if (cache) {
      setState(cache);
    } else {
      attempt();
    }

    // A failed first load leaves the whole screen showing zeros, so retry
    // whenever the app comes back to the foreground — the same pattern the
    // Monobank sync and the service-worker update check already use, and the
    // point at which a transient network problem has most likely resolved.
    function onVisible() {
      if (document.visibilityState === "visible") attempt();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return state;
}

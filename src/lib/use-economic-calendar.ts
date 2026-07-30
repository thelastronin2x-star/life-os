"use client";

import { useEffect, useState } from "react";
import type { CalendarEventDto } from "@/app/api/work/economic-calendar/route";

export type EconomicCalendarStatus = "loading" | "ready" | "not-configured" | "no-credits" | "error";

interface CalendarState {
  events: CalendarEventDto[];
  status: EconomicCalendarStatus;
}

let cache: CalendarState | null = null;

export function useEconomicCalendar(): CalendarState {
  const [state, setState] = useState<CalendarState>(cache ?? { events: [], status: "loading" });

  useEffect(() => {
    if (cache) return;
    let cancelled = false;

    fetch("/api/work/economic-calendar")
      .then((res) => res.json())
      .then((data: { configured: boolean; events: CalendarEventDto[]; error?: string }) => {
        if (cancelled) return;
        const status: EconomicCalendarStatus = !data.configured
          ? "not-configured"
          : data.error === "no_credits"
            ? "no-credits"
            : data.error
              ? "error"
              : "ready";
        cache = { events: data.events ?? [], status };
        setState(cache);
      })
      .catch(() => {
        if (cancelled) return;
        cache = { events: [], status: "error" };
        setState(cache);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

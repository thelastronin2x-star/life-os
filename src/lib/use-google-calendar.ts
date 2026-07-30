"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarEvent } from "@/app/api/calendar/events/route";

type Status = "loading" | "disconnected" | "connected";

export function useGoogleCalendar() {
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/calendar/status");
    const data = await res.json();
    if (data.connected) {
      setStatus("connected");
      setEmail(data.email ?? null);
      const evRes = await fetch("/api/calendar/events");
      if (evRes.ok) {
        const evData = await evRes.json();
        setEvents(evData.events ?? []);
      }
    } else {
      setStatus("disconnected");
      setEmail(null);
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after an internal await
    refresh();
  }, [refresh]);

  const disconnect = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh();
  }, [refresh]);

  return { status, email, events, refresh, disconnect };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { WeatherPayload } from "@/app/api/weather/route";

/** Kyiv. Used until the user grants location, and kept as the answer if they
 *  decline — a weather widget showing *somewhere* plausible is more useful
 *  than an empty box demanding a permission the user already said no to. */
const FALLBACK = { lat: 50.45, lon: 30.523, label: "Київ" };

const COORDS_KEY = "life-os-weather-coords";

interface Coords {
  lat: number;
  lon: number;
  label: string;
}

type Status = "loading" | "ready" | "error";

function readStoredCoords(): Coords | null {
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Coords;
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lon)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Current conditions plus the next few hours for wherever the device is.
 *
 *  Location is resolved once and remembered: asking the browser on every
 *  mount re-prompts on some platforms and costs a GPS fix on others, for a
 *  number that doesn't meaningfully change between two openings of the app.
 *  Refreshing it is a deliberate action (see `locate`), not a side effect of
 *  rendering. */
export function useWeather(enabled: boolean) {
  const [coords, setCoords] = useState<Coords | null>(() => (enabled ? (readStoredCoords() ?? FALLBACK) : null));
  const [data, setData] = useState<WeatherPayload | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!enabled || !coords) return;
    let cancelled = false;

    fetch(`/api/weather?lat=${coords.lat}&lon=${coords.lon}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((payload: WeatherPayload) => {
        if (cancelled) return;
        setData(payload);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, coords]);

  /** Asks the browser for a real position. Called from a tap, never
   *  automatically — an unprompted permission dialog on the Home screen is
   *  the fastest way to get it denied permanently. */
  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: Coords = {
          lat: Number(pos.coords.latitude.toFixed(3)),
          lon: Number(pos.coords.longitude.toFixed(3)),
          label: "Поточне місце",
        };
        try {
          localStorage.setItem(COORDS_KEY, JSON.stringify(next));
        } catch {
          // Private mode / storage full — the coords still work for this
          // session, they just won't be remembered.
        }
        setStatus("loading");
        setCoords(next);
      },
      () => {
        // Declined or unavailable: stay on the fallback rather than blanking
        // a widget that was already showing something useful.
      },
      { timeout: 8000, maximumAge: 30 * 60 * 1000 }
    );
  }, []);

  return { data, status, label: coords?.label ?? FALLBACK.label, locate, usingFallback: coords?.label === FALLBACK.label };
}

import { NextRequest, NextResponse } from "next/server";

/** Open-Meteo: free, no API key, no attribution requirement — which is why
 *  it's used here instead of a keyed provider. Proxied through our own route
 *  rather than called from the browser so the response can be cached once for
 *  everyone on the same coordinates instead of per device, and so swapping
 *  providers later never touches client code. */
const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

// Open-Meteo updates roughly hourly; caching for 30 minutes keeps the widget
// current without hammering them every time Home mounts.
const REVALIDATE_SECONDS = 30 * 60;

export interface WeatherPayload {
  current: { temp: number; code: number; isDay: boolean };
  today: { min: number; max: number };
  /** Every hour of the local day, 00:00 through 23:00, in order.
   *
   *  The widget draws the shape of the day rather than a strip of upcoming
   *  hours, and a shape needs the hours already behind you: without them the
   *  morning low is missing and the curve starts halfway up with no
   *  explanation. Trimming to "what's still ahead" is the widget's decision to
   *  make visually (it dims the past), not the API's to make by deletion. */
  day: { hour: number; temp: number; code: number }[];
  /** Local hour at the location right now — which point on the curve is
   *  "you are here". Computed server-side because the device clock may be in
   *  a different timezone than the coordinates being forecast. */
  nowHour: number;
}

interface OpenMeteoResponse {
  current?: { temperature_2m: number; weather_code: number; is_day: number; time?: string };
  daily?: { temperature_2m_min: number[]; temperature_2m_max: number[] };
  hourly?: { time: string[]; temperature_2m: number[]; weather_code: number[] };
}

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));

  // Rejected rather than defaulted: silently returning some other city's
  // weather would look like working data and be impossible to notice.
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "invalid_coordinates" }, { status: 400 });
  }

  const url =
    `${ENDPOINT}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    "&current=temperature_2m,weather_code,is_day" +
    "&daily=temperature_2m_min,temperature_2m_max" +
    "&hourly=temperature_2m,weather_code" +
    "&forecast_days=1&timezone=auto";

  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) {
      return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
    }
    const data: OpenMeteoResponse = await res.json();
    if (!data.current || !data.daily || !data.hourly) {
      return NextResponse.json({ error: "unexpected_response" }, { status: 502 });
    }

    // Open-Meteo returns local times as bare "YYYY-MM-DDTHH:mm" with no zone
    // (timezone=auto puts them in the *location's* zone). Parsing that with
    // `new Date()` would reinterpret it in the server's zone and shift the
    // whole day, so the hour is read off the string directly.
    const localHour = (t: string) => Number(t.slice(11, 13));

    const day: WeatherPayload["day"] = data.hourly.time.map((t, i) => ({
      hour: localHour(t),
      temp: Math.round(data.hourly!.temperature_2m[i]),
      code: data.hourly!.weather_code[i],
    }));

    const nowHour = data.current.time ? localHour(data.current.time) : new Date().getHours();

    const payload: WeatherPayload = {
      current: {
        temp: Math.round(data.current.temperature_2m),
        code: data.current.weather_code,
        isDay: data.current.is_day === 1,
      },
      today: {
        min: Math.round(data.daily.temperature_2m_min[0]),
        max: Math.round(data.daily.temperature_2m_max[0]),
      },
      day,
      nowHour,
    };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("Weather fetch failed", e);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}

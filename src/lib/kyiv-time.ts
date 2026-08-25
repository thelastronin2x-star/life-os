/** Server functions run in UTC (Vercel's Node runtime), but every reminder
 *  time a user picks in the UI is a Ukraine wall-clock time — the client
 *  never sends a timezone, it just uses the browser's local time
 *  everywhere. This app is Ukrainian-only (see manifest.ts's lang: "uk",
 *  holidays.ts), so hardcoding Europe/Kyiv here — rather than threading a
 *  timezone through the sync payload for a single-timezone user base — is a
 *  deliberate, scoped assumption, not an oversight. */
const KYIV_TZ = "Europe/Kyiv";

function timeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return (asUtc - date.getTime()) / 60_000;
}

/** "2026-08-20" + "09:00", interpreted as Kyiv wall-clock time, resolved to
 *  the correct UTC instant (accounting for EU DST — the offset is looked up
 *  at the target date, not "now", so a reminder in a different DST period
 *  than today still resolves correctly). */
export function kyivDateTimeToUtc(dateKey: string, time: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const naiveUtc = Date.UTC(y, m - 1, d, h, min);
  const offsetMinutes = timeZoneOffsetMinutes(KYIV_TZ, new Date(naiveUtc));
  return new Date(naiveUtc - offsetMinutes * 60_000);
}

/** Today's date as Kyiv sees it, not the server's own UTC date — matters
 *  right around midnight, where the two can differ by a day. Used to key
 *  "did we already send today's bedtime reminder" so that check doesn't
 *  drift a date off from what the user's own clock shows. */
export function kyivTodayDateKey(): string {
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone: KYIV_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return dtf.format(new Date()); // en-CA formats as YYYY-MM-DD
}

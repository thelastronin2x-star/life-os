import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bedtimeReminders, calendarReminderItems, pushSubscriptions, sentReminderLog, waterReminders } from "@/lib/db/schema";
import { expandRecurringEvents } from "@/lib/recurrence";
import { kyivDateTimeToUtc, kyivTodayDateKey } from "@/lib/kyiv-time";
import { computeReminderTimes, shouldSkipReminder, minutesOfHHMM } from "@/lib/water-reminders";
import { sendPush, type PushPayload } from "@/lib/push-send";
import type { CalendarItem, ReminderOption } from "@/lib/calendar-store";

// web-push/pg need Node APIs — not available on Edge.
export const runtime = "nodejs";

// Mirrors MINUTES_BEFORE in use-reminder-notifications.ts (that file is
// "use client" and can't be imported here) — keep the two in sync if the
// reminder options ever change.
const MINUTES_BEFORE: Record<Exclude<ReminderOption, "none">, number> = {
  "10min": 10,
  "1hour": 60,
  day: 24 * 60,
};

// Wide enough to always contain "today" through "day before" for a
// tomorrow-anchored note, comfortably more than the ~5min gap between
// QStash ticks — expanding a slightly wider window than strictly needed
// costs nothing since occurrences outside the actual fire window are just
// filtered out below.
const LOOKAHEAD_DAYS = 3;

/** Whether `fireAt` falls inside "now, or up to 6 minutes ago" — a window
 *  slightly wider than the 5-minute QStash schedule so a tick that runs a
 *  little late never skips an occurrence, while sentReminderLog's unique
 *  constraint (not this window) is what actually prevents a double-send if
 *  two ticks both see the same occurrence as due. */
function isWithinTick(fireAt: Date, now: number): boolean {
  return fireAt.getTime() <= now && now - fireAt.getTime() < 6 * 60_000;
}

/** Claims one occurrence via the dedup table and, only if this call won the
 *  race, pushes to every active subscription for that device. Shared by
 *  both the calendar-reminder loop and the bedtime-reminder loop below —
 *  same "insert into sentReminderLog, ON CONFLICT DO NOTHING, send only if
 *  the insert actually landed" shape either way. */
async function claimAndSend(itemId: string, occurrenceKey: string, deviceId: string, payload: PushPayload): Promise<number> {
  const inserted = await db
    .insert(sentReminderLog)
    .values({ itemId, occurrenceKey })
    .onConflictDoNothing({ target: [sentReminderLog.itemId, sentReminderLog.occurrenceKey] })
    .returning({ id: sentReminderLog.id });
  if (inserted.length === 0) return 0; // already sent by another tick/retry

  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.deviceId, deviceId));
  await Promise.all(subs.map((sub) => sendPush(sub, payload)));
  return subs.length;
}

async function sendCalendarReminders(now: number): Promise<number> {
  const rangeStart = new Date(now - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db.select().from(calendarReminderItems);
  let sent = 0;

  for (const row of rows) {
    const reminder = row.reminder as Exclude<ReminderOption, "none">;
    const minutesBefore = MINUTES_BEFORE[reminder];
    if (!minutesBefore) continue;

    const fakeItem: CalendarItem = {
      id: row.id,
      date: row.date,
      kind: row.kind as CalendarItem["kind"],
      title: row.title,
      time: row.time ?? undefined,
      category: "personal",
      reminder,
      recurrence: (row.recurrence as CalendarItem["recurrence"]) ?? null,
    };

    const occurrences = expandRecurringEvents(fakeItem, rangeStart, rangeEnd);

    for (const occurrence of occurrences) {
      // Notes have no time-of-day — "day before" means the whole day
      // before, so a fixed 09:00 stands in for "start of day" the same way
      // the client's own note-reminder branch just compares dates, not
      // times (use-reminder-notifications.ts).
      const eventInstant = kyivDateTimeToUtc(occurrence.date, occurrence.time ?? "09:00");
      const fireAt = new Date(eventInstant.getTime() - minutesBefore * 60_000);
      if (!isWithinTick(fireAt, now)) continue;

      // Says WHEN, not just "today"/"tomorrow" — a bare "Сьогодні" on a push
      // that arrived an hour before the event doesn't say anything the
      // notification's arrival time didn't already say. Notes have no
      // time (kind === "note"), so they keep the plain day-only wording.
      const body =
        minutesBefore >= 60 * 24
          ? occurrence.time
            ? `Завтра о ${occurrence.time}`
            : "Завтра"
          : minutesBefore >= 60
            ? occurrence.time
              ? `Сьогодні о ${occurrence.time}`
              : "Сьогодні"
            : `Починається через ${minutesBefore} хв`;

      const occurrenceKey = `${row.id}|${fireAt.toISOString()}`;
      sent += await claimAndSend(row.id, occurrenceKey, row.deviceId, { title: occurrence.title, body, url: "/calendar" });
    }
  }

  return sent;
}

/** One push per device per day, at their own targetBedtime — deep-links
 *  into /health/sleep?action=start rather than relying on a notification
 *  action button, because iOS Safari ignores custom notification actions
 *  entirely (confirmed on the WebKit bug tracker, wwdc2022-10098): the only
 *  thing a tap can reliably do on iOS is open the app at a URL, so that URL
 *  has to carry the whole intent. The sleep page reads `action=start` and
 *  calls the same startSleep() the manual button uses.
 *
 *  Gated on sleepState === "idle": if the person already started their own
 *  session (manually, ahead of the reminder), sending "time to sleep" would
 *  be a stale nag about something that already happened. */
async function sendSleepReminders(now: number): Promise<number> {
  const rows = await db.select().from(bedtimeReminders);
  const today = kyivTodayDateKey();
  let sent = 0;

  for (const row of rows) {
    if (!row.targetBedtime || row.sleepState !== "idle") continue;
    const fireAt = kyivDateTimeToUtc(today, row.targetBedtime);
    if (!isWithinTick(fireAt, now)) continue;

    sent += await claimAndSend(`bedtime:${row.deviceId}`, today, row.deviceId, {
      title: "Час лягати спати",
      body: "Тапни, щоб почати відстеження сну",
      url: "/health/sleep?action=start",
    });
  }

  return sent;
}

/** Symmetric to sendSleepReminders, gated the other way: sleepState ===
 *  "sleeping", so this never fires for a session that was never started.
 *  Deduped by `sessionStartedAt` rather than by calendar date — a
 *  session-scoped key sidesteps having to decide which day a reminder
 *  crossing midnight "belongs to". Same reason the fire instant is anchored
 *  to the session's own start date, not "today": if targetWakeTime is
 *  earlier in the clock than the bedtime was, it means the next morning,
 *  not the same day the person went to sleep. */
async function sendWakeReminders(now: number): Promise<number> {
  const rows = await db.select().from(bedtimeReminders);
  let sent = 0;

  for (const row of rows) {
    if (!row.targetWakeTime || row.sleepState !== "sleeping" || !row.sessionStartedAt) continue;

    const sessionStartedAt = row.sessionStartedAt;

    // The wall-clock date the session STARTED on, in Kyiv time (not UTC) —
    // reuses the same offset math as kyivDateTimeToUtc/kyivTodayDateKey.
    const startDateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(sessionStartedAt);
    let fireAt = kyivDateTimeToUtc(startDateKey, row.targetWakeTime);
    if (fireAt.getTime() <= sessionStartedAt.getTime()) {
      fireAt = new Date(fireAt.getTime() + 24 * 60 * 60 * 1000);
    }
    if (!isWithinTick(fireAt, now)) continue;

    const occurrenceKey = sessionStartedAt.toISOString();
    sent += await claimAndSend(`wake:${row.deviceId}`, occurrenceKey, row.deviceId, {
      title: "Час прокидатись",
      body: "Тапни, щоб завершити сон",
      url: "/health/sleep?action=stop",
    });
  }

  return sent;
}

/** Up to `remindersPerDay` pushes a day, evenly spread across the device's
 *  own active window (see water-reminders.ts) — each skipped silently via
 *  shouldSkipReminder if intake is already ahead of the pace-adjusted
 *  expectation for that time of day. `row.todayAmountMl` is only trusted
 *  when `row.todayDate` matches today's Kyiv date; a device that goes
 *  untouched overnight would otherwise keep reading as "already caught up"
 *  on yesterday's numbers and silently skip every reminder all day. */
async function sendWaterReminders(now: number): Promise<number> {
  const rows = await db.select().from(waterReminders);
  const today = kyivTodayDateKey();
  let sent = 0;

  for (const row of rows) {
    if (row.remindersPerDay <= 0) continue;
    const reminderTimes = computeReminderTimes(row.remindersPerDay, row.activeStart, row.activeEnd);

    for (const time of reminderTimes) {
      const fireAt = kyivDateTimeToUtc(today, time);
      if (!isWithinTick(fireAt, now)) continue;

      const todayAmountMl = row.todayDate === today ? row.todayAmountMl : 0;
      const todayGoalMl = row.todayGoalMl > 0 ? row.todayGoalMl : 2000;
      if (shouldSkipReminder(todayAmountMl, todayGoalMl, minutesOfHHMM(time), row.activeStart, row.activeEnd)) {
        continue;
      }

      const occurrenceKey = `${today}|${time}`;
      sent += await claimAndSend(`water:${row.deviceId}`, occurrenceKey, row.deviceId, {
        title: "Час випити води",
        body: "Тапни, щоб додати 250 мл",
        url: "/health/water?action=add250",
      });
    }
  }

  return sent;
}

/** Once a month, on the 1st (Kyiv wall-clock date) — a nudge to fill in
 *  Фінанси's MonthlyCheckIn (see finance-store.ts), which is otherwise
 *  fully manual with no other prompt to keep it current. Not gated by any
 *  per-device state row (unlike sleep, there's nothing to check besides
 *  "did we already send this month") — every device with an active push
 *  subscription gets one, deduped by `checkin:<deviceId>` + the month key
 *  so a QStash tick landing anywhere on the 1st (there will be several)
 *  only ever sends once. */
async function sendCheckInReminders(): Promise<number> {
  const todayKey = kyivTodayDateKey();
  if (!todayKey.endsWith("-01")) return 0;
  const monthKey = todayKey.slice(0, 7);

  const subs = await db.select({ deviceId: pushSubscriptions.deviceId }).from(pushSubscriptions);
  const deviceIds = [...new Set(subs.map((s) => s.deviceId))];

  let sent = 0;
  for (const deviceId of deviceIds) {
    sent += await claimAndSend(`checkin:${deviceId}`, monthKey, deviceId, {
      title: "Час місячного фінансового чек-іну",
      body: "Онови заощадження, дохід і витрати за місяць — займе хвилину",
      url: "/balance?action=checkin",
    });
  }
  return sent;
}

/** Once a quarter (1 Jan/Apr/Jul/Oct, Kyiv wall-clock date) — a nudge to
 *  retake Фінанси's financial-literacy quiz (see finance-quiz.ts), the 8th
 *  dashboard card. Same unconditional-per-device shape as
 *  sendCheckInReminders above (nothing to check per device besides "did we
 *  already send this quarter"), just a 3-month cadence instead of monthly —
 *  deduped by `quiz:<deviceId>` + a quarter key so repeated 1st-of-the-
 *  quarter ticks only ever send once. */
async function sendQuizReminders(): Promise<number> {
  const todayKey = kyivTodayDateKey();
  if (!todayKey.endsWith("-01")) return 0;
  const month = Number(todayKey.slice(5, 7));
  if (![1, 4, 7, 10].includes(month)) return 0;
  const quarterKey = `${todayKey.slice(0, 4)}-Q${Math.ceil(month / 3)}`;

  const subs = await db.select({ deviceId: pushSubscriptions.deviceId }).from(pushSubscriptions);
  const deviceIds = [...new Set(subs.map((s) => s.deviceId))];

  let sent = 0;
  for (const deviceId of deviceIds) {
    sent += await claimAndSend(`quiz:${deviceId}`, quarterKey, deviceId, {
      title: "Перевір фінансові знання",
      body: "Короткий тест на 5 питань — освіжи ключові поняття",
      url: "/balance?action=quiz",
    });
  }
  return sent;
}

async function handler() {
  const now = Date.now();
  const [calendarSent, sleepSent, wakeSent, waterSent, checkInSent, quizSent] = await Promise.all([
    sendCalendarReminders(now),
    sendSleepReminders(now),
    sendWakeReminders(now),
    sendWaterReminders(now),
    sendCheckInReminders(),
    sendQuizReminders(),
  ]);
  return NextResponse.json({ ok: true, sent: calendarSent + sleepSent + wakeSent + waterSent + checkInSent + quizSent });
}

export const POST = verifySignatureAppRouter(handler);

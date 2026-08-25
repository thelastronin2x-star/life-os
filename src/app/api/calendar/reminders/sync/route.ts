import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { db } from "@/lib/db/client";
import { calendarReminderItems } from "@/lib/db/schema";

interface SyncBody {
  id?: string;
  title?: string;
  date?: string;
  time?: string | null;
  kind?: "event" | "note";
  reminder?: "none" | "10min" | "1hour" | "day";
  recurrence?: unknown;
}

/** Called from calendar-store.ts on every add/update/remove — never a bulk
 *  sync of the whole calendar, only the items /api/push/send-reminders
 *  actually needs. `reminder: "none"` and a missing id both mean "delete",
 *  covering an item losing its reminder and an item being removed outright
 *  with the same code path. */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as SyncBody;
  if (!body.id) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.reminder || body.reminder === "none") {
    await db.delete(calendarReminderItems).where(eq(calendarReminderItems.id, body.id));
    return NextResponse.json({ ok: true });
  }

  if (!body.title || !body.date || !body.kind) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const deviceId = await getOrCreateDeviceId();
  const values = {
    deviceId,
    title: body.title,
    date: body.date,
    time: body.time ?? null,
    kind: body.kind,
    reminder: body.reminder,
    recurrence: body.recurrence ?? null,
    updatedAt: new Date(),
  };

  await db
    .insert(calendarReminderItems)
    .values({ id: body.id, ...values })
    .onConflictDoUpdate({ target: calendarReminderItems.id, set: values });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { db } from "@/lib/db/client";
import { pushSubscriptions } from "@/lib/db/schema";
import { sendPush } from "@/lib/push-send";

// web-push/pg need Node APIs — not available on Edge.
export const runtime = "nodejs";

/** The "manual tap" confirmation path — deliberately not scheduled, not
 *  deduped, not logged: it's one immediate push for one deliberate action
 *  (tapping "Лягти спати"/"Прокинувся" with your own thumb), not a
 *  server-derived reminder. No `url` deep-link, unlike send-reminders —
 *  there's no action tapping this notification should trigger, it's just a
 *  fact landing on the lock screen for a second in case the app gets
 *  backgrounded right after. */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { title?: string; body?: string };
  if (!body.title) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const deviceId = await getOrCreateDeviceId();
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.deviceId, deviceId));

  await Promise.all(subs.map((sub) => sendPush(sub, { title: body.title!, body: body.body ?? "" })));

  return NextResponse.json({ ok: true, sent: subs.length });
}

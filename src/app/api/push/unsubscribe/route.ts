import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { db } from "@/lib/db/client";
import { pushSubscriptions } from "@/lib/db/schema";

/** Removes only this device's own subscription rows — deliberately scoped
 *  by (deviceId, endpoint) together, not deviceId alone, so one browser
 *  can't accidentally wipe another's subscription if a deviceId were ever
 *  reused. Called from the client's own "turn off notifications" toggle,
 *  not from any account/logout flow (there isn't one) — see subscribeToPush
 *  in push-client.ts for the matching unsubscribe() call on the browser
 *  side. */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { endpoint?: string };
  const deviceId = await getOrCreateDeviceId();

  if (body.endpoint) {
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.deviceId, deviceId), eq(pushSubscriptions.endpoint, body.endpoint)));
  } else {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.deviceId, deviceId));
  }

  return NextResponse.json({ ok: true });
}

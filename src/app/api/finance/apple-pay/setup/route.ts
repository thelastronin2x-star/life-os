import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { applePayTokens } from "@/lib/db/schema";
import { getOrCreateDeviceId } from "@/lib/device-session";

export const runtime = "nodejs";

/** Cookie-authenticated (this is a normal browser call from the settings
 *  screen, unlike /receive) — returns the same token every time it's called
 *  for a device rather than rotating it, so re-visiting the setup screen
 *  doesn't invalidate a Shortcut the user already built. */
export async function POST() {
  const deviceId = await getOrCreateDeviceId();

  const existing = await db.select().from(applePayTokens).where(eq(applePayTokens.deviceId, deviceId));
  if (existing.length > 0) {
    return NextResponse.json({ token: existing[0].token });
  }

  const token = randomUUID();
  await db.insert(applePayTokens).values({ deviceId, token });
  return NextResponse.json({ token });
}

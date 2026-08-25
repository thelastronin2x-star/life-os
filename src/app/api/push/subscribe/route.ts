import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { db } from "@/lib/db/client";
import { pushSubscriptions } from "@/lib/db/schema";

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SubscribeBody;
  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const deviceId = await getOrCreateDeviceId();

  await db
    .insert(pushSubscriptions)
    .values({ id: crypto.randomUUID(), deviceId, endpoint, p256dh, auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { deviceId, p256dh, auth },
    });

  return NextResponse.json({ ok: true });
}

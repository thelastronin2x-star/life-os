import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { db } from "@/lib/db/client";
import { bedtimeReminders } from "@/lib/db/schema";

interface SyncBody {
  targetBedtime: string | null;
  targetWakeTime: string | null;
  sleepState: "idle" | "sleeping";
  sessionStartedAt: string | null;
}

/** Always a full-snapshot upsert, never a delete — unlike the old
 *  bedtime-only version of this route. A disabled reminder is just `null`
 *  on its own field now, not row-absence, because the row also carries the
 *  live sleepState/sessionStartedAt that has to persist regardless of
 *  whether either reminder is configured. See health-store.ts's
 *  syncSleepSchedule for the client side of this. */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as SyncBody;
  const deviceId = await getOrCreateDeviceId();

  const values = {
    targetBedtime: body.targetBedtime ?? null,
    targetWakeTime: body.targetWakeTime ?? null,
    sleepState: body.sleepState === "sleeping" ? "sleeping" : "idle",
    sessionStartedAt: body.sessionStartedAt ? new Date(body.sessionStartedAt) : null,
    updatedAt: new Date(),
  };

  await db
    .insert(bedtimeReminders)
    .values({ deviceId, ...values })
    .onConflictDoUpdate({ target: bedtimeReminders.deviceId, set: values });

  return NextResponse.json({ ok: true });
}

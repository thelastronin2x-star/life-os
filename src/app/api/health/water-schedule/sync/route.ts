import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { db } from "@/lib/db/client";
import { waterReminders } from "@/lib/db/schema";

interface SyncBody {
  remindersPerDay: number;
  activeStart: string;
  activeEnd: string;
  todayAmountMl: number;
  todayGoalMl: number;
  todayDate: string;
}

/** Always a full-snapshot upsert — see health-store.ts's syncWaterSchedule
 *  for the client side and the schema.ts comment on waterReminders for why
 *  today's intake/goal ride along with the reminder settings themselves. */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as SyncBody;
  const deviceId = await getOrCreateDeviceId();

  const values = {
    remindersPerDay: Math.max(0, Math.min(12, Math.trunc(body.remindersPerDay) || 0)),
    activeStart: body.activeStart || "09:00",
    activeEnd: body.activeEnd || "22:00",
    todayAmountMl: Math.max(0, Math.trunc(body.todayAmountMl) || 0),
    todayGoalMl: Math.max(0, Math.trunc(body.todayGoalMl) || 0),
    todayDate: body.todayDate,
    updatedAt: new Date(),
  };

  await db
    .insert(waterReminders)
    .values({ deviceId, ...values })
    .onConflictDoUpdate({ target: waterReminders.deviceId, set: values });

  return NextResponse.json({ ok: true });
}

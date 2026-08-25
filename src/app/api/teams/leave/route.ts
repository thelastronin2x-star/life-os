import { NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { leaveTeam } from "@/lib/teams/db";

export async function POST() {
  const deviceId = await getOrCreateDeviceId();
  await leaveTeam(deviceId);
  return NextResponse.json({ ok: true });
}

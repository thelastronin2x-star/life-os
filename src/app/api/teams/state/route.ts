import { NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { getTeamState } from "@/lib/teams/db";

export async function GET() {
  const deviceId = await getOrCreateDeviceId();
  const state = await getTeamState(deviceId);
  return NextResponse.json({ state });
}

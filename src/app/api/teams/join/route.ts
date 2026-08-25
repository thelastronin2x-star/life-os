import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { joinTeam } from "@/lib/teams/db";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<{ code: string; displayName: string }>;
  const code = body.code?.trim();
  const displayName = body.displayName?.trim();
  if (!code || !displayName) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const deviceId = await getOrCreateDeviceId();
  const result = await joinTeam({ code, displayName, deviceId });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409 });
  }
  return NextResponse.json({ teamId: result.teamId });
}

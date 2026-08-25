import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { setRival } from "@/lib/teams/db";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<{ code: string }>;
  if (!body.code?.trim()) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }

  const deviceId = await getOrCreateDeviceId();
  const result = await setRival(deviceId, body.code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409 });
  }
  return NextResponse.json({ ok: true });
}

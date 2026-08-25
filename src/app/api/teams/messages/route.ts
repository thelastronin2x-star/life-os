import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { postMessage } from "@/lib/teams/db";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<{ text: string }>;
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "empty_text" }, { status: 400 });
  }

  const deviceId = await getOrCreateDeviceId();
  const message = await postMessage(deviceId, body.text);
  if (!message) {
    return NextResponse.json({ error: "not_in_team" }, { status: 409 });
  }
  return NextResponse.json({ message });
}

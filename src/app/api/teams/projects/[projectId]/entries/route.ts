import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { addProjectEntry } from "@/lib/teams/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const body = (await request.json()) as Partial<{ text: string }>;
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "empty_text" }, { status: 400 });
  }

  const deviceId = await getOrCreateDeviceId();
  const entry = await addProjectEntry(deviceId, projectId, body.text);
  if (!entry) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ entry });
}

import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { addDeckCard } from "@/lib/teams/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const body = (await request.json()) as Partial<{ front: string; back: string }>;
  if (!body.front?.trim() || !body.back?.trim()) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const deviceId = await getOrCreateDeviceId();
  const card = await addDeckCard(deviceId, projectId, body.front, body.back);
  if (!card) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ card });
}

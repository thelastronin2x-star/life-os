import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { updateProject } from "@/lib/teams/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const body = (await request.json()) as Partial<{ status: string | null; data: Record<string, unknown> }>;

  const deviceId = await getOrCreateDeviceId();
  const ok = await updateProject(deviceId, projectId, { status: body.status, data: body.data });
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

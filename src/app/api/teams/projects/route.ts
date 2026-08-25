import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { createProject } from "@/lib/teams/db";

const VALID_KINDS = new Set(["note", "session", "parts_project", "shared_deck"]);

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<{ kind: string; name: string; status: string }>;
  if (!body.kind || !VALID_KINDS.has(body.kind) || !body.name?.trim()) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const deviceId = await getOrCreateDeviceId();
  const project = await createProject(deviceId, {
    kind: body.kind as "note" | "session" | "parts_project" | "shared_deck",
    name: body.name,
    status: body.status,
  });
  if (!project) {
    return NextResponse.json({ error: "not_in_team" }, { status: 409 });
  }
  return NextResponse.json({ project });
}

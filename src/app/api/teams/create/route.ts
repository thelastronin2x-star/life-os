import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { createTeam } from "@/lib/teams/db";
import type { TeamProfile } from "@/lib/teams/types";

interface CreateBody {
  name: string;
  profile: TeamProfile;
  displayName: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<CreateBody>;
  const name = body.name?.trim();
  const displayName = body.displayName?.trim();
  const profile: TeamProfile = body.profile === "student" || body.profile === "it" ? body.profile : "trader";

  if (!name || !displayName) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const deviceId = await getOrCreateDeviceId();
  try {
    const teamId = await createTeam({ name, profile, deviceId, displayName });
    return NextResponse.json({ teamId });
  } catch (e) {
    if (e instanceof Error && e.message === "already_in_team") {
      return NextResponse.json({ error: "already_in_team" }, { status: 409 });
    }
    throw e;
  }
}

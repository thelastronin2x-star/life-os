import { NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { awardTradeClosedXp } from "@/lib/teams/db";

/** Fire-and-forget from the client whenever a trade is closed (see
 *  journal-store.ts). No-ops silently if the device isn't in a team —
 *  this is a bonus for team members, not a required step in closing a
 *  trade, so it must never surface as an error to the trader. */
export async function POST() {
  const deviceId = await getOrCreateDeviceId();
  await awardTradeClosedXp(deviceId);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pendingApplePayTransactions } from "@/lib/db/schema";
import { getOrCreateDeviceId } from "@/lib/device-session";

export const runtime = "nodejs";

/** Deletes a pending row once the client has turned it into a real
 *  localStorage Transaction — called whether the user actually picked a
 *  category or tapped "Категоризувати пізніше" (see
 *  ApplePayCategorizeSheet), since either way the transaction now exists
 *  locally and the server copy is done being useful. Scoped to the
 *  requester's own deviceId so one device can't resolve another's row. */
export async function POST(request: NextRequest) {
  const deviceId = await getOrCreateDeviceId();
  const body = (await request.json()) as { pendingId?: string };
  if (!body.pendingId) {
    return NextResponse.json({ error: "missing_pending_id" }, { status: 400 });
  }

  await db
    .delete(pendingApplePayTransactions)
    .where(and(eq(pendingApplePayTransactions.id, body.pendingId), eq(pendingApplePayTransactions.deviceId, deviceId)));

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pendingApplePayTransactions } from "@/lib/db/schema";
import { getOrCreateDeviceId } from "@/lib/device-session";

export const runtime = "nodejs";

/** Cookie-authenticated — read both on the push-tap deep link
 *  (?action=applepay) and as a best-effort fallback poll on every normal
 *  app open, same "device has no other way to hear about server state"
 *  reasoning as checkAndGenerateAutoReports elsewhere in this app. */
export async function GET() {
  const deviceId = await getOrCreateDeviceId();
  const rows = await db
    .select()
    .from(pendingApplePayTransactions)
    .where(eq(pendingApplePayTransactions.deviceId, deviceId));

  return NextResponse.json({
    pending: rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      merchant: r.merchant,
      date: r.transactionDate,
    })),
  });
}

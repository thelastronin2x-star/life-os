import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { applePayTokens, pendingApplePayTransactions, pushSubscriptions } from "@/lib/db/schema";
import { sendPush } from "@/lib/push-send";
import { kyivTodayDateKey } from "@/lib/kyiv-time";

export const runtime = "nodejs";

interface ReceiveBody {
  token: string;
  amount: number;
  merchant: string;
  date?: string; // "YYYY-MM-DD", defaults to today (Kyiv) — Shortcuts fires right after the payment
}

/** No cookie auth — this is called by the user's own Shortcuts automation
 *  (an anonymous HTTP POST, see applePayTokens' own doc comment), never by
 *  the browser. The dedup unique index on pendingApplePayTransactions is
 *  what actually prevents a double-fired Shortcuts trigger from creating two
 *  pending rows — this route just lets the insert's conflict tell it that
 *  already happened, no application-level duplicate-check needed. */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<ReceiveBody>;
  const amount = Number(body.amount);
  const merchant = String(body.merchant ?? "").trim();

  if (!body.token || !Number.isFinite(amount) || amount <= 0 || !merchant) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const [tokenRow] = await db.select().from(applePayTokens).where(eq(applePayTokens.token, body.token));
  if (!tokenRow) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const transactionDate = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : kyivTodayDateKey();

  const inserted = await db
    .insert(pendingApplePayTransactions)
    .values({ id: randomUUID(), deviceId: tokenRow.deviceId, amount, merchant, transactionDate })
    .onConflictDoNothing({
      target: [
        pendingApplePayTransactions.deviceId,
        pendingApplePayTransactions.amount,
        pendingApplePayTransactions.merchant,
        pendingApplePayTransactions.transactionDate,
      ],
    })
    .returning({ id: pendingApplePayTransactions.id });

  if (inserted.length === 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.deviceId, tokenRow.deviceId));
  await Promise.all(
    subs.map((sub) =>
      sendPush(sub, {
        title: "Категоризувати покупку",
        body: `${merchant} · ${amount.toFixed(0)}₴`,
        url: "/balance?action=applepay",
      })
    )
  );

  return NextResponse.json({ ok: true });
}

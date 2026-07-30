import { NextRequest, NextResponse } from "next/server";
import { getStoredToken } from "@/lib/monobank";
import { monobankBankSource } from "@/lib/monobank-bank-source";
import { BankSourceError } from "@/lib/bank-source";

const MAX_RANGE_SECONDS = 31 * 24 * 60 * 60 + 60 * 60; // 31 days + 1 hour, per Monobank's own limit

export async function POST(request: NextRequest) {
  const token = await getStoredToken();
  if (!token) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const accountId = typeof body?.accountId === "string" ? body.accountId : "";
  const from = Number(body?.from);
  const to = Number(body?.to);

  if (!accountId || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }
  if (to - from > MAX_RANGE_SECONDS) {
    return NextResponse.json({ error: "range_too_large" }, { status: 400 });
  }

  try {
    const transactions = await monobankBankSource.fetchStatement(token, accountId, from, to);
    return NextResponse.json({ transactions });
  } catch (e) {
    if (e instanceof BankSourceError && e.status === 429) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    console.error("Monobank statement fetch failed", e);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}

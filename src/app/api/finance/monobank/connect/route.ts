import { NextRequest, NextResponse } from "next/server";
import { BankSourceError } from "@/lib/bank-source";
import { completeMonobankConnection } from "@/lib/monobank-connect";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  try {
    const { accounts } = await completeMonobankConnection(token, request.nextUrl.origin);
    return NextResponse.json({ accounts });
  } catch (e) {
    if (e instanceof BankSourceError && e.status === 403) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    console.error("Monobank connect failed", e);
    return NextResponse.json({ error: "connect_failed" }, { status: 502 });
  }
}

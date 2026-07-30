import { NextResponse } from "next/server";
import { getStoredToken } from "@/lib/monobank";
import { monobankBankSource } from "@/lib/monobank-bank-source";
import { BankSourceError } from "@/lib/bank-source";

export async function GET() {
  const token = await getStoredToken();
  if (!token) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  try {
    const accounts = await monobankBankSource.fetchAccounts(token);
    return NextResponse.json({ accounts });
  } catch (e) {
    if (e instanceof BankSourceError && e.status === 429) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    console.error("Monobank accounts fetch failed", e);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}

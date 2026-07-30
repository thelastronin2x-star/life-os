import { NextRequest, NextResponse } from "next/server";
import { getStoredSession } from "@/lib/monobank";
import { migrateLocalTransactions } from "@/lib/db/local-migration";
import type { Transaction } from "@/lib/finance-store";

const MAX_TRANSACTIONS = 200_000; // generous upper bound against a malformed/huge request body

export async function POST(request: NextRequest) {
  const session = await getStoredSession();
  if (!session?.userId) {
    // No server-side identity yet — this app only creates one via the
    // Monobank connect flow today (see monobank-server-ledger-prompt.md's
    // own "what NOT to do" — no standalone auth is being added here).
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const transactions: unknown = body?.transactions;
  if (!Array.isArray(transactions) || transactions.length > MAX_TRANSACTIONS) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const valid = transactions.every(
    (t) =>
      t &&
      typeof t.id === "string" &&
      typeof t.type === "string" &&
      typeof t.amount === "number" &&
      typeof t.accountId === "string" &&
      typeof t.title === "string"
  );
  if (!valid) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const result = await migrateLocalTransactions(session.userId, transactions as Transaction[]);
    return NextResponse.json(result);
  } catch (e) {
    console.error("Local data migration failed", e);
    return NextResponse.json({ error: "migration_failed" }, { status: 502 });
  }
}

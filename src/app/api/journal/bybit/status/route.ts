import { NextResponse } from "next/server";
import { getStoredSession } from "@/lib/bybit";

export async function GET() {
  const session = await getStoredSession();
  return NextResponse.json({ connected: Boolean(session) });
}

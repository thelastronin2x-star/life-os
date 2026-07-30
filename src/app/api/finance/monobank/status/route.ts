import { NextResponse } from "next/server";
import { getStoredToken } from "@/lib/monobank";

export async function GET() {
  const token = await getStoredToken();
  return NextResponse.json({ connected: Boolean(token) });
}
